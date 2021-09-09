import fs from 'fs';
import { rm as rmSync, writeFile } from 'fs/promises';
import marked from 'marked';
import minimatch from 'minimatch';
import open from 'open';
import { Sketch } from 'p5-analysis';
import path from 'path';
import { sourceViewTemplate } from '../server/globals';
import {
  createDirectoryListing,
  defaultDirectoryExclusions
} from '../server/createDirectoryListing';
import { die, pathIsInDirectory, stringToOptions } from '../utils';

// TODO: copy the static icons into the build directory

type Options = {
  options: string;
  output: string;
  theme: string;
  dryRun?: boolean;
  open?: boolean;
  verbose?: boolean;
};

const directoryExclusions = [...defaultDirectoryExclusions, 'build'];

export default async function build(source: string, options: Options) {
  const output = options.output;
  const hrstart = process.hrtime.bigint();

  if (
    pathIsInDirectory(output, source) &&
    !directoryExclusions.some(pattern => minimatch(output, pattern))
  ) {
    die('The output directory cannot be inside the source directory');
  }
  if (pathIsInDirectory(source, output)) {
    die('The source directory cannot be inside the output directory');
  }

  if (!options.dryRun && fs.existsSync(output)) {
    fs.readdirSync(output)
      .filter(file => !file.startsWith('.'))
      .map(file => path.join(output, file))
      .forEach(file =>
        fs.statSync(file).isDirectory()
          ? rmSync(file, { recursive: true })
          : fs.unlinkSync(file)
      );
  }

  const actions = createActions(source, output);
  const count = await runActions(actions, options);
  const rootIndex = path.join(output, 'index.html');
  const elapsed = Number(process.hrtime.bigint() - hrstart) / 1e9;
  console.log(
    `p5 build wrote ${count} files to directory ${output} in ${elapsed.toFixed(2)}ms`
  );
  if (options.open) {
    open(rootIndex);
  } else {
    console.log(`Open file://${path.resolve(rootIndex)} to view`);
  }
}

type Action = (
  | { kind: 'copyDir'; source: string }
  | { kind: 'copyFile'; source: string }
  | { kind: 'mkdir'; source: string }
  | { kind: 'convertMarkdown'; source: string }
  | { kind: 'createIndex'; dir: string; path: string }
  | { kind: 'createSketchHtml'; sketch: Sketch }
  | { kind: 'createSourceView'; source: string }
) & { outputFile: string };

type ActionIterator = AsyncIterableIterator<Action>;

function Action(
  kind: 'convertMarkdown' | 'copyDir' | 'copyFile' | 'mkdir',
  source: string,
  outputFile: string
): Action {
  return { kind, source, outputFile };
}

function createActions(file: string, output: string): ActionIterator {
  return visit(file, output);

  async function* visit(source: string, output: string): ActionIterator {
    if (fs.statSync(source).isDirectory()) {
      yield* visitDir(source, output);
    } else {
      yield Action('copyFile', source, output);
      if (source.endsWith('.md')) {
        yield Action('convertMarkdown', source, output + '.html');
      }
    }
  }

  async function* visitDir(dir: string, output: string): ActionIterator {
    const { sketches, allFiles } = await Sketch.analyzeDirectory(dir, {
      exclusions: directoryExclusions
    });
    yield Action('mkdir', dir, output);

    const scriptOnlySketches = sketches.filter(sk => sk.sketchType === 'javascript');
    // TODO: check for collisions when choosing the output file path
    for (const sketch of scriptOnlySketches) {
      const outputFile = path
        .join(output, sketch.scriptFile)
        .replace(/\.js$/i, '.html');
      yield { kind: 'createSketchHtml', sketch, outputFile };
    }

    const subdirectorySketches = sketches.filter(sk => sk.dir !== dir);
    for (const sketch of subdirectorySketches) {
      yield Action(
        'copyDir',
        sketch.dir,
        path.join(output, path.relative(dir, sketch.dir))
      );
    }

    // Do this after the directories are copied
    for (const sketch of sketches) {
      const outputFile = path
        .join(output, path.relative(dir, sketch.scriptFilePath))
        .replace(/\.js$/i, '.js.html');
      yield { kind: 'createSourceView', source: sketch.scriptFilePath, outputFile };
    }

    for (const file of allFiles) {
      yield* visit(path.join(dir, file), path.join(output, file));
    }

    if (!allFiles.find(file => /^index\.html?$/i.test(file))) {
      // Generate the index from the target, rather than the source, so that it
      // will refer to generated HTML files instead of the bare JavaScript
      // sketches.
      const outputFile = path.join(output, 'index.html');
      // construct the listing from the output directory, because it contains
      // the generated sketch HTML files
      yield {
        kind: 'createIndex',
        dir,
        outputFile,
        path: path.basename(dir)
      };
    }
  }
}

async function runActions(actions: ActionIterator, options: Options) {
  let filesCreated = 0;
  for await (const action of actions) {
    if (options.verbose || options.dryRun) {
      const args = actionMessageArgs(action);
      if (args) console.log(...args);
    }
    if (!options.dryRun) {
      const { filesCreated: n } = await runAction(action);
      filesCreated += n;
    }
  }
  return filesCreated;

  function actionMessageArgs(action: Action) {
    const { outputFile } = action;
    switch (action.kind) {
      case 'copyDir':
        return ['Copy directory', action.source, '->', outputFile];
      case 'copyFile':
        return ['Copy file', action.source, '->', outputFile];
      case 'convertMarkdown':
        return ['Convert', action.source, '->', outputFile];
      case 'createIndex':
        return ['Generate directory listing', outputFile];
      case 'createSketchHtml':
        return ['Generate sketch HTML', action.sketch.scriptFile, '->', outputFile];
      case 'createSourceView':
        return ['Create source view', action.source, '->', outputFile];
      case 'mkdir':
        if (!fs.existsSync(outputFile)) {
          return ['Create directory', outputFile];
        }
        break;
    }
  }

  async function runAction(action: Action) {
    const { outputFile } = action;
    let filesCreated = 0;
    switch (action.kind) {
      case 'copyDir':
        fs.cpSync(action.source, outputFile, { recursive: true });
        filesCreated += fs.readdirSync(action.source).length; // FIXME
        break;
      case 'copyFile':
        fs.copyFileSync(action.source, outputFile);
        filesCreated += 1;
        break;
      case 'convertMarkdown': {
        const html = marked(fs.readFileSync(action.source, 'utf-8'));
        fs.writeFileSync(outputFile, html);
        filesCreated += 1;
        break;
      }
      case 'createIndex': {
        const { dir, path } = action;
        fs.rmSync(outputFile, { force: true });
        const templateOptions = stringToOptions(options.options);
        const html = await createDirectoryListing(dir, path, {
          staticMode: true,
          templateName: options.theme,
          templateOptions
        });
        await writeFile(outputFile, html);
        filesCreated += 1;
        break;
      }
      case 'createSketchHtml': {
        const { sketch } = action;
        const html = await sketch.getHtmlContent();
        await writeFile(outputFile, html);
        filesCreated += 1;
        break;
      }
      case 'createSourceView': {
        const source = fs.readFileSync(action.source, 'utf-8');
        const title = path.basename(action.source);
        const html = sourceViewTemplate({ source, title });
        await writeFile(outputFile, html);
        filesCreated += 1;
        break;
      }
      case 'mkdir':
        fs.mkdirSync(outputFile, { recursive: true });
        break;
    }
    return { filesCreated };
  }
}

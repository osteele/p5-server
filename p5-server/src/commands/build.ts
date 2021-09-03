// TODO: copy the static icons into the build directory

import fs from 'fs';
import { rm as rmSync } from 'fs/promises';
import { writeFile } from 'fs/promises';
import { Sketch } from 'p5-analysis';
import path from 'path';
import { createDirectoryListing } from '../server/directoryListing';
import { die } from '../utils';

type Options = {
  output: string;
  dryRun?: boolean;
  verbose?: boolean;
  template: string;
};

export default async function build(source: string, options: Options) {
  const output = options.output;

  if (!path.relative(output, source).startsWith('..' + path.sep)) {
    die('The source directory cannot be inside the output directory');
  }
  if (!path.relative(source, output).startsWith('..' + path.sep)) {
    die('The output directory cannot be inside the source directory');
  }
  const actions = createActions(source, output);
  if (!options.dryRun) {
    fs.readdirSync(output)
      .filter(file => !file.startsWith('.'))
      .map(file => path.join(output, file))
      .forEach(file =>
        fs.statSync(file).isDirectory()
          ? rmSync(file, { recursive: true })
          : fs.unlinkSync(file)
      );
  }
  const count = await runActions(actions, options);
  console.log(`${count} files written to ${output}`);
}

type Action = (
  | { kind: 'copyFile'; source: string }
  | { kind: 'mkdir'; source: string }
  | { kind: 'generateIndex'; dir: string; path: string }
  | { kind: 'generateHtml'; sketch: Sketch }
) & { outputFile: string };

type ActionIterator = AsyncIterableIterator<Action>;

function Action(
  kind: 'copyFile' | 'mkdir',
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
    }
  }

  async function* visitDir(dir: string, output: string): ActionIterator {
    const { sketches, allFiles } = await Sketch.analyzeDirectory(dir);
    yield Action('mkdir', dir, output);
    const scriptOnlySketches = sketches.filter(s => s.sketchType === 'javascript');
    // TODO: check for collisions when choosing the output file path
    for (const sketch of scriptOnlySketches) {
      const outputFile = path
        .join(output, sketch.scriptFile)
        .replace(/\.js$/i, '.html');
      yield { kind: 'generateHtml', sketch, outputFile };
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
        kind: 'generateIndex',
        dir: output,
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
      case 'copyFile':
        return ['Copy', action.source, '->', outputFile];
      case 'generateIndex':
        return ['Generate directory listing', outputFile];
      case 'generateHtml': {
        const sketch = action.sketch;
        return ['Generate sketch HTML', sketch.scriptFile, '->', outputFile];
      }
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
      case 'copyFile':
        fs.copyFileSync(action.source, outputFile);
        filesCreated += 1;
        break;
      case 'generateIndex': {
        const { dir, path } = action;
        fs.rmSync(outputFile, { force: true });
        const html = await createDirectoryListing(dir, path, options.template);
        await writeFile(outputFile, html);
        filesCreated += 1;
        break;
      }
      case 'generateHtml': {
        const { sketch } = action;
        const html = await sketch.getHtmlContent();
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

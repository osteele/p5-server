// TODO: copy the static icons into the build directory

import fs from 'fs';
import { Sketch } from 'p5-analysis';
import path from 'path/posix';
import { createDirectoryListing } from '../server/directory-listing';
import { die } from '../utils';

export default async function build(
  source: string,
  options: { output?: string; dryRun?: boolean; verbose?: boolean }
): Promise<void> {
  const output = options.output || 'build';
  function verbose(...args: any[]) {
    if (options.verbose || options.dryRun) console.log(...args);
  }

  if (!path.relative(output, source).startsWith('..' + path.sep)) {
    die('The source directory cannot be inside the output directory');
  }
  if (!path.relative(source, output).startsWith('..' + path.sep)) {
    die('The output directory cannot be inside the source directory');
  }
  for await (const action of visit(source, output)) {
    const { outputFile } = action;
    switch (action.kind) {
      case 'copyFile':
        verbose('Copy', action.source, '->', outputFile);
        if (!options.dryRun) {
          fs.copyFileSync(action.source, outputFile);
        }
        break;
      case 'generateIndex': {
        const src = action.source;
        verbose('Generate index', outputFile);
        if (!options.dryRun) {
          fs.rmSync(outputFile, { force: true });
          const html = await createDirectoryListing(path.basename(src), path.dirname(src));
          fs.writeFileSync(outputFile, html);
        }
        break;
      }
      case 'generateHtml': {
        const sketch = action.sketch;
        verbose('Generate', sketch.scriptFile, '->', outputFile);
        if (!options.dryRun) {
          const html = sketch.getHtmlContent();
          fs.writeFileSync(outputFile, html);
        }
        break;
      }
      case 'mkdir':
        if (!fs.existsSync(outputFile)) {
          verbose('Create directory', outputFile);
        }
        if (!options.dryRun) {
          fs.mkdirSync(outputFile, { recursive: true });
        }
        break;
    }
  }

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
    const scriptOnlySketches = sketches.filter(s => !s.htmlFile);
    // TODO: check for collisions when choosing the output file path
    for (const sketch of scriptOnlySketches) {
      yield {
        kind: 'generateHtml',
        sketch,
        outputFile: path.join(output, sketch.scriptFile).replace(/\.js$/i, '.html')
      };
    }
    for (const file of allFiles) {
      yield* visit(path.join(dir, file), path.join(output, file));
    }
    if (!allFiles.find(file => /^index\.html?$/i.test(file))) {
      // Generate the index from the target, rather than the source, so that it
      // will refer to generated HTML files instead of the bare JavaScript
      // sketches.
      yield Action('generateIndex', output, path.join(output, 'index.html'));
    }
  }
}

type ActionTypes = 'copyFile' | 'mkdir' | 'generateIndex';

type Action =
  | { kind: 'copyFile'; source: string; outputFile: string }
  | { kind: 'mkdir'; source: string; outputFile: string }
  | { kind: 'generateIndex'; source: string; outputFile: string }
  | { kind: 'generateHtml'; sketch: Sketch; outputFile: string };

type ActionIterator = AsyncIterableIterator<Action>;

function Action(kind: ActionTypes, source: string, outputFile: string): Action {
  return { kind, source, outputFile };
}

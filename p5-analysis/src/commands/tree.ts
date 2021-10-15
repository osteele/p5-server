import fs from 'fs';
import path from 'path';
import { Sketch } from '..';
import {
  AsyncTreeInputIterable,
  dedentSymbol,
  indentSymbol,
  printTree,
} from './helpers/printTree';

export default async function tree(
  file: string,
  options: { descriptions: boolean; level?: number }
) {
  const depth = options.level || Infinity;
  const iter = sketchTreeIter(file, { depth, printDescriptions: options.descriptions });
  await printTree(iter);
}

function sketchTreeIter(
  file: string,
  { depth, printDescriptions }: { depth: number; printDescriptions: boolean }
): AsyncTreeInputIterable<string> {
  return visit(file, depth) as AsyncTreeInputIterable<string>;

  async function* visit(file: string, depth: number): AsyncIterable<string | symbol> {
    if (fs.statSync(file).isDirectory()) {
      yield* visitDir(file, depth - 1);
    } else if (await Sketch.isSketchFile(file)) {
      const sketch = await Sketch.fromFile(file);
      yield* visitSketch(sketch, depth - 1);
    } else {
      yield path.basename(file);
    }
  }

  // Recursively visit directory
  async function* visitDir(dir: string, depth: number): AsyncIterable<string | symbol> {
    const { sketches, unassociatedFiles } = await Sketch.analyzeDirectory(dir);
    yield* ['📁' + path.basename(dir), indentSymbol];
    if (depth >= 0) {
      for (const sketch of sketches.sort((a, b) => a.name.localeCompare(b.name))) {
        yield* visitSketch(sketch, depth - 1);
      }
      const files = [...unassociatedFiles]
        .map(f => path.join(dir, f))
        .sort((a, b) => a.localeCompare(b))
        .sort(
          (a, b) =>
            Number(fs.statSync(b).isDirectory()) - Number(fs.statSync(a).isDirectory())
        );
      for (const file of files) {
        yield* visit(file, depth - 1);
      }
    }
    yield dedentSymbol;
  }

  // Recursively visit sketch
  async function* visitSketch(
    sketch: Sketch,
    depth: number
  ): AsyncIterable<string | symbol> {
    const mainFile = sketch.files.length === 1 ? ` (${sketch.mainFile})` : '';
    const description =
      printDescriptions && sketch.description
        ? ` - ${sketch.description.replace(/\s*\n\s*/g, ' ')}`
        : '';
    yield* ['🎨' + `${sketch.name}${mainFile}${description}`, indentSymbol];
    if (depth >= 0 && sketch.files.length > 1) {
      yield* sketch.files;
    }
    yield dedentSymbol;
  }
}

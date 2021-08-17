import fs from 'fs';
import { Sketch } from 'p5-analysis';
import path from 'path/posix';

import { dedentSymbol, indentSymbol, printTree, AsyncTreeInputIterable } from '../printTree';

export default async function tree(file: string, options: { level?: number }) {
  const depth = options.level || Infinity;
  const iter = sketchTreeIter(file, depth);
  await printTree(iter);
}

function sketchTreeIter(file: string, depth: number): AsyncTreeInputIterable<string> {
  return visit(file, depth) as AsyncTreeInputIterable<string>;

  async function* visit(file: string, depth: number): AsyncIterable<string | symbol> {
    if (fs.statSync(file).isDirectory()) {
      yield* visitDir(file, depth - 1);
    } else if (Sketch.isSketchHtmlFile(file) || Sketch.isSketchScriptFile(file)) {
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
        .sort((a, b) => Number(fs.statSync(b).isDirectory()) - Number(fs.statSync(a).isDirectory()));
      for (const file of files) {
        yield* visit(file, depth - 1);
      }
    }
    yield dedentSymbol;
  }

  // Recursively visit sketch
  async function* visitSketch(sketch: Sketch, depth: number): AsyncIterable<string | symbol> {
    yield* ['🎨' + `${sketch.name} (${sketch.mainFile})`, indentSymbol];
    if (depth >= 0 && sketch.files.length > 1) {
      yield* sketch.files;
    }
    yield dedentSymbol;
  }
}

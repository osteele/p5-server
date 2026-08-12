import fs from 'node:fs';
import path from 'node:path';
import { Script, Sketch } from '../index.js';

type Diagnostic = {
  location: string;
  message: string;
};

export async function formatSketchAnalysis(name: string): Promise<string> {
  const sketch = await Sketch.fromFile(name);
  const diagnostics = collectDiagnostics(sketch);
  const lines = [
    `Sketch: ${sketch.title}`,
    '',
    `Main file: ${path.resolve(sketch.mainFilePath)}`,
    `Sketch type: ${sketch.structureType}`,
    `Description: ${sketch.description?.replace(/\s*\n\s*/g, ' ') ?? 'None'}`,
  ];
  if (sketch.htmlFilePath) {
    lines.push(`HTML file: ${path.resolve(sketch.htmlFilePath)}`);
  }
  lines.push(`Script file: ${path.resolve(sketch.scriptFilePath)}`);
  lines.push(
    '',
    `Files used by the sketch (${sketch.files.length}):`,
    ...sketch.files.map((file) => {
      const filePath = path.resolve(sketch.dir, file);
      return `  - ${filePath}${fs.existsSync(filePath) ? '' : ' (missing)'}`;
    }),
    '',
    `Additional libraries (${sketch.libraries.length}):`,
    ...(sketch.libraries.length
      ? sketch.libraries.map((library) => {
          const source = library.importPath ? `: ${library.importPath}` : '';
          return `  - ${library.name}${source}`;
        })
      : ['  None']),
    '',
    `Diagnostics (${diagnostics.length}):`,
    ...(diagnostics.length
      ? diagnostics.map(
          ({ location, message }) => `  - ${message} (${location})`
        )
      : ['  None'])
  );
  return `${lines.join('\n')}\n`;
}

function collectDiagnostics(sketch: Sketch): Diagnostic[] {
  const diagnostics: Diagnostic[] = [];
  for (const filename of sketch.files) {
    const filePath = path.resolve(sketch.dir, filename);
    if (!fs.existsSync(filePath)) {
      diagnostics.push({
        location: filePath,
        message: 'Referenced file does not exist',
      });
      continue;
    }
    if (!filename.endsWith('.js')) continue;
    for (const error of Script.fromFile(filePath).getErrors()) {
      const loc = (
        error as SyntaxError & {
          loc?: { column: number; line: number };
        }
      ).loc;
      diagnostics.push({
        location: loc ? `${filePath}:${loc.line}:${loc.column}` : filePath,
        message: error.message,
      });
    }
  }
  return diagnostics;
}

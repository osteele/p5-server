import path from 'node:path';
import { formatSketchAnalysis } from '../src/commands/analyze-sketch';

test('formatSketchAnalysis includes computed sketch properties', async () => {
  const source = './tests/testdata/circles.js';
  const output = await formatSketchAnalysis(source);

  expect(output).toContain('Sketch: Circles');
  expect(output).toContain(`Main file: ${path.resolve(source)}`);
  expect(output).toContain('Sketch type: script');
  expect(output).toContain('Files used by the sketch (1):');
  expect(output).toContain(`  - ${path.resolve(source)}`);
  expect(output).toContain('Additional libraries (0):\n  None');
  expect(output).toContain('Diagnostics (0):\n  None');
});

test('formatSketchAnalysis reports missing associated files', async () => {
  const source = './tests/testdata/html-includes/index.html';
  const output = await formatSketchAnalysis(source);

  expect(output).toContain(
    `${path.resolve('./tests/testdata/html-includes/cat.png')} (missing)`
  );
  expect(output).toContain('Referenced file does not exist');
});

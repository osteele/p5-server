import path from 'node:path';
import render, { formatRenderReport } from '../src/commands/renderCommand';

test('render reports static failures before opening a browser', async () => {
  const source = '../p5-analysis/tests/testdata/html-includes/index.html';
  const report = await render(source, {});

  expect(report.success).toBe(false);
  expect(report.browser).toBeUndefined();
  expect(report.errors.map(({ text }) => text)).toContain(
    'Referenced file does not exist'
  );

  const output = formatRenderReport(report);
  expect(output).toContain(`Render failed: ${path.resolve(source)}`);
  expect(output).toContain('Browser: Not started');
  expect(output).toContain('Errors (3):');
});

test('render formats invalid options as a readable report', async () => {
  const report = await render('examples/circles.js', { frame: 'later' });
  const output = formatRenderReport(report);

  expect(report.success).toBe(false);
  expect(output).toContain('Frame: 1 requested; not reached');
  expect(output).toContain(
    'frame must be a non-negative integer; received later'
  );
});

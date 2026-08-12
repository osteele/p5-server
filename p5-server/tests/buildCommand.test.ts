import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import build from '../src/commands/buildCommand';

test('build waits for old output to be removed before writing new output', async () => {
  const tempDir = fs.mkdtempSync(
    path.join(os.tmpdir(), 'p5-server-build-test-')
  );
  const source = path.join(tempDir, 'source');
  const output = path.join(tempDir, 'output');
  fs.mkdirSync(path.join(source, 'assets'), { recursive: true });
  fs.writeFileSync(path.join(source, 'assets', 'current.txt'), 'current');
  fs.mkdirSync(path.join(output, 'assets'), { recursive: true });
  fs.writeFileSync(path.join(output, 'assets', 'stale.txt'), 'stale');

  try {
    await build(source, { options: '', output, theme: 'grid' });

    expect(fs.existsSync(path.join(output, 'assets', 'current.txt'))).toBe(
      true
    );
    expect(fs.existsSync(path.join(output, 'assets', 'stale.txt'))).toBe(false);
  } finally {
    fs.rmSync(tempDir, { force: true, recursive: true });
  }
});

test('build rejects colliding generated and source paths', async () => {
  const tempDir = fs.mkdtempSync(
    path.join(os.tmpdir(), 'p5-server-build-test-')
  );
  const source = path.join(tempDir, 'source');
  const output = path.join(tempDir, 'output');
  fs.mkdirSync(source);
  fs.writeFileSync(path.join(source, 'notes.md'), '# Notes');
  fs.writeFileSync(path.join(source, 'notes.md.html'), 'existing');

  try {
    await expect(
      build(source, { options: '', output, theme: 'grid' })
    ).rejects.toThrow(/Build output collision.*notes\.md\.html/);
    expect(fs.existsSync(output)).toBe(false);
  } finally {
    fs.rmSync(tempDir, { force: true, recursive: true });
  }
});

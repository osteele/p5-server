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
  fs.writeFileSync(path.join(output, '.keep'), 'preserved');

  try {
    await build(source, { options: '', output, theme: 'grid' });

    expect(fs.existsSync(path.join(output, 'assets', 'current.txt'))).toBe(
      true
    );
    expect(fs.existsSync(path.join(output, 'assets', 'stale.txt'))).toBe(false);
    expect(fs.readFileSync(path.join(output, '.keep'), 'utf-8')).toBe(
      'preserved'
    );
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

test('build rejects output collisions that differ only by case', async () => {
  const tempDir = fs.mkdtempSync(
    path.join(os.tmpdir(), 'p5-server-build-case-test-')
  );
  const source = path.join(tempDir, 'source');
  const output = path.join(tempDir, 'output');
  fs.mkdirSync(source);
  fs.writeFileSync(
    path.join(source, 'Demo.js'),
    'function setup() { createCanvas(10, 10); }'
  );
  fs.writeFileSync(path.join(source, 'demo.html'), 'static sentinel');

  try {
    await expect(
      build(source, { options: '', output, theme: 'grid' })
    ).rejects.toThrow(/Build output collision/i);
    expect(fs.existsSync(output)).toBe(false);
  } finally {
    fs.rmSync(tempDir, { force: true, recursive: true });
  }
});

test('build rejects canonically equivalent Unicode output collisions', async () => {
  const tempDir = fs.mkdtempSync(
    path.join(os.tmpdir(), 'p5-server-build-unicode-test-')
  );
  const source = path.join(tempDir, 'source');
  const output = path.join(tempDir, 'output');
  fs.mkdirSync(source);
  fs.writeFileSync(
    path.join(source, '\u00e9.js'),
    'function setup() { createCanvas(10, 10); }'
  );
  fs.writeFileSync(path.join(source, 'e\u0301.html'), 'static sentinel');

  try {
    await expect(
      build(source, { options: '', output, theme: 'grid' })
    ).rejects.toThrow(/Build output collision/);
    expect(fs.existsSync(output)).toBe(false);
  } finally {
    fs.rmSync(tempDir, { force: true, recursive: true });
  }
});

test('build rejects output collisions hidden by Windows trailing dots', async () => {
  const tempDir = fs.mkdtempSync(
    path.join(os.tmpdir(), 'p5-server-build-trailing-dot-test-')
  );
  const source = path.join(tempDir, 'source');
  const output = path.join(tempDir, 'output');
  fs.mkdirSync(source);
  fs.writeFileSync(
    path.join(source, 'Demo.js'),
    'function setup() { createCanvas(10, 10); }'
  );
  fs.writeFileSync(path.join(source, 'Demo.html.'), 'static sentinel');

  try {
    await expect(
      build(source, { options: '', output, theme: 'grid' })
    ).rejects.toThrow(/Build output collision/);
    expect(fs.existsSync(output)).toBe(false);
  } finally {
    fs.rmSync(tempDir, { force: true, recursive: true });
  }
});

test('build keeps generated pages for nested script-only sketches in their directories', async () => {
  const tempDir = fs.mkdtempSync(
    path.join(os.tmpdir(), 'p5-server-build-nested-script-test-')
  );
  const source = path.join(tempDir, 'source');
  const output = path.join(tempDir, 'output');
  fs.mkdirSync(path.join(source, 'demo'), { recursive: true });
  fs.writeFileSync(
    path.join(source, 'demo', 'sketch.js'),
    'function setup() { createCanvas(10, 10); }'
  );

  try {
    await build(source, { options: '', output, theme: 'grid' });

    expect(fs.existsSync(path.join(output, 'demo', 'sketch.html'))).toBe(true);
    expect(fs.existsSync(path.join(output, 'sketch.html'))).toBe(false);
    expect(fs.readFileSync(path.join(output, 'index.html'), 'utf-8')).toContain(
      'demo/sketch.html'
    );
  } finally {
    fs.rmSync(tempDir, { force: true, recursive: true });
  }
});

test('build preflights generated files against descendants copied from sketch directories', async () => {
  const tempDir = fs.mkdtempSync(
    path.join(os.tmpdir(), 'p5-server-build-copy-collision-test-')
  );
  const source = path.join(tempDir, 'source');
  const output = path.join(tempDir, 'output');
  fs.mkdirSync(path.join(source, 'demo'), { recursive: true });
  fs.writeFileSync(
    path.join(source, 'demo', 'sketch.js'),
    'function setup() { createCanvas(10, 10); }'
  );
  fs.writeFileSync(
    path.join(source, 'demo', 'sketch.js.html'),
    'static sentinel'
  );

  try {
    await expect(
      build(source, { options: '', output, theme: 'grid' })
    ).rejects.toThrow(/Build output collision.*sketch\.js\.html/);
    expect(fs.existsSync(output)).toBe(false);
    expect(
      fs.readFileSync(path.join(source, 'demo', 'sketch.js.html'), 'utf-8')
    ).toBe('static sentinel');
  } finally {
    fs.rmSync(tempDir, { force: true, recursive: true });
  }
});

test('build rejects Windows reserved device names before publishing', async () => {
  const tempDir = fs.mkdtempSync(
    path.join(os.tmpdir(), 'p5-server-build-device-name-test-')
  );
  const source = path.join(tempDir, 'source');
  const output = path.join(tempDir, 'output');
  fs.mkdirSync(source);
  fs.writeFileSync(
    path.join(source, 'CON.js'),
    'function setup() { createCanvas(10, 10); }'
  );

  try {
    await expect(
      build(source, { options: '', output, theme: 'grid' })
    ).rejects.toThrow(/reserved device name/);
    expect(fs.existsSync(output)).toBe(false);
  } finally {
    fs.rmSync(tempDir, { force: true, recursive: true });
  }
});

test('build recursively excludes private and dependency files in sketch directories', async () => {
  const tempDir = fs.mkdtempSync(
    path.join(os.tmpdir(), 'p5-server-build-filter-test-')
  );
  const source = path.join(tempDir, 'source');
  const output = path.join(tempDir, 'output');
  const sketch = path.join(source, 'example');
  fs.mkdirSync(path.join(sketch, 'node_modules', 'dependency'), {
    recursive: true,
  });
  fs.mkdirSync(path.join(sketch, '.git'));
  fs.writeFileSync(
    path.join(sketch, 'sketch.js'),
    'function setup() { createCanvas(10, 10); }'
  );
  fs.writeFileSync(path.join(sketch, '.env'), 'SECRET=value');
  fs.writeFileSync(path.join(sketch, '.git', 'config'), 'private');
  fs.writeFileSync(
    path.join(sketch, 'node_modules', 'dependency', 'index.js'),
    'dependency'
  );

  try {
    await build(source, { options: '', output, theme: 'grid' });

    expect(fs.existsSync(path.join(output, 'example', 'sketch.js'))).toBe(true);
    expect(fs.existsSync(path.join(output, 'example', '.env'))).toBe(false);
    expect(fs.existsSync(path.join(output, 'example', '.git'))).toBe(false);
    expect(fs.existsSync(path.join(output, 'example', 'node_modules'))).toBe(
      false
    );
  } finally {
    fs.rmSync(tempDir, { force: true, recursive: true });
  }
});

test('build rejects an output-directory symlink without changing its target', async () => {
  const tempDir = fs.mkdtempSync(
    path.join(os.tmpdir(), 'p5-server-build-output-link-test-')
  );
  const source = path.join(tempDir, 'source');
  const target = path.join(tempDir, 'target');
  const output = path.join(tempDir, 'output');
  fs.mkdirSync(source);
  fs.mkdirSync(target);
  fs.writeFileSync(path.join(source, 'asset.txt'), 'source');
  fs.writeFileSync(path.join(target, 'keep.txt'), 'keep');
  fs.symlinkSync(target, output);

  try {
    await expect(
      build(source, { options: '', output, theme: 'grid' })
    ).rejects.toThrow(/symbolic link/);
    expect(fs.readFileSync(path.join(target, 'keep.txt'), 'utf-8')).toBe(
      'keep'
    );
    expect(fs.existsSync(path.join(target, 'asset.txt'))).toBe(false);
  } finally {
    fs.rmSync(tempDir, { force: true, recursive: true });
  }
});

test('build rejects source symlinks instead of publishing their targets', async () => {
  const tempDir = fs.mkdtempSync(
    path.join(os.tmpdir(), 'p5-server-build-source-link-test-')
  );
  const source = path.join(tempDir, 'source');
  const outside = path.join(tempDir, 'outside');
  const output = path.join(tempDir, 'output');
  fs.mkdirSync(source);
  fs.mkdirSync(outside);
  fs.writeFileSync(path.join(outside, 'secret.txt'), 'secret');
  fs.symlinkSync(outside, path.join(source, 'linked'));

  try {
    await expect(
      build(source, { options: '', output, theme: 'grid' })
    ).rejects.toThrow(/symbolic link/);
    expect(fs.existsSync(output)).toBe(false);
  } finally {
    fs.rmSync(tempDir, { force: true, recursive: true });
  }
});

test('build rejects generated output paths that escape the output directory', async () => {
  const tempDir = fs.mkdtempSync(
    path.join(os.tmpdir(), 'p5-server-build-escape-test-')
  );
  const source = path.join(tempDir, 'source');
  const output = path.join(tempDir, 'output');
  const outsideScript = path.join(tempDir, 'outside.js');
  const escapedOutput = path.join(tempDir, 'outside.js.html');
  fs.mkdirSync(source);
  fs.writeFileSync(
    path.join(source, 'index.html'),
    '<script src="https://cdn.jsdelivr.net/npm/p5@2.3/lib/p5.min.js"></script><script src="../outside.js"></script>'
  );
  fs.writeFileSync(outsideScript, 'function setup() { createCanvas(10, 10); }');
  fs.writeFileSync(escapedOutput, 'keep');

  try {
    await expect(
      build(source, { options: '', output, theme: 'grid' })
    ).rejects.toThrow(/escapes the build output directory/);
    expect(fs.readFileSync(outsideScript, 'utf-8')).toContain('createCanvas');
    expect(fs.readFileSync(escapedOutput, 'utf-8')).toBe('keep');
    expect(fs.existsSync(output)).toBe(false);
  } finally {
    fs.rmSync(tempDir, { force: true, recursive: true });
  }
});

test('failed builds preserve the previous output', async () => {
  const tempDir = fs.mkdtempSync(
    path.join(os.tmpdir(), 'p5-server-build-atomic-test-')
  );
  const source = path.join(tempDir, 'source');
  const output = path.join(tempDir, 'output');
  fs.mkdirSync(source);
  fs.mkdirSync(output);
  fs.writeFileSync(path.join(source, 'asset.txt'), 'new');
  fs.writeFileSync(path.join(output, 'keep.txt'), 'old');

  try {
    await expect(
      build(source, { options: '', output, theme: 'missing-theme' })
    ).rejects.toThrow();
    expect(fs.readFileSync(path.join(output, 'keep.txt'), 'utf-8')).toBe('old');
    expect(fs.existsSync(path.join(output, 'asset.txt'))).toBe(false);
  } finally {
    fs.rmSync(tempDir, { force: true, recursive: true });
  }
});

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import convert from '../src/commands/convertSketch';

describe('convert to folder', () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'p5-convert-folder-test-'));
  });

  afterEach(() => {
    fs.rmSync(tempDir, { force: true, recursive: true });
  });

  test('preserves nested associated file paths', async () => {
    const script = path.join(tempDir, 'demo.js');
    fs.mkdirSync(path.join(tempDir, 'assets'));
    fs.writeFileSync(
      script,
      'function setup() { createCanvas(10, 10); loadImage("assets/cat.png"); }'
    );
    fs.writeFileSync(path.join(tempDir, 'assets', 'cat.png'), 'cat');

    await convert(script, { to: 'folder' });

    expect(fs.existsSync(path.join(tempDir, 'demo', 'demo.js'))).toBe(true);
    expect(
      fs.readFileSync(path.join(tempDir, 'demo', 'assets', 'cat.png'), 'utf-8')
    ).toBe('cat');
  });

  test('rejects associated files outside the sketch before moving anything', async () => {
    const sketchesDir = path.join(tempDir, 'sketches');
    const sharedDir = path.join(tempDir, 'shared');
    fs.mkdirSync(sketchesDir);
    fs.mkdirSync(sharedDir);
    const script = path.join(sketchesDir, 'demo.js');
    const asset = path.join(sharedDir, 'cat.png');
    fs.writeFileSync(
      script,
      'function setup() { createCanvas(10, 10); loadImage("../shared/cat.png"); }'
    );
    fs.writeFileSync(asset, 'cat');

    await expect(convert(script, { to: 'folder' })).rejects.toThrow(
      /escapes the sketch directory/
    );
    expect(fs.existsSync(script)).toBe(true);
    expect(fs.existsSync(asset)).toBe(true);
    expect(fs.existsSync(path.join(sketchesDir, 'demo'))).toBe(false);
  });

  test('rejects a non-empty destination before moving anything', async () => {
    const script = path.join(tempDir, 'demo.js');
    fs.writeFileSync(script, 'function setup() { createCanvas(10, 10); }');
    fs.mkdirSync(path.join(tempDir, 'demo'));
    fs.writeFileSync(path.join(tempDir, 'demo', 'keep.txt'), 'keep');

    await expect(convert(script, { to: 'folder' })).rejects.toThrow(
      /not empty/
    );
    expect(fs.existsSync(script)).toBe(true);
    expect(
      fs.readFileSync(path.join(tempDir, 'demo', 'keep.txt'), 'utf-8')
    ).toBe('keep');
  });
});

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

  test('rejects associated files reached through a symlink', async () => {
    const script = path.join(tempDir, 'demo.js');
    const outside = path.join(tempDir, 'outside');
    fs.mkdirSync(outside);
    fs.writeFileSync(path.join(outside, 'cat.png'), 'cat');
    fs.symlinkSync(outside, path.join(tempDir, 'assets'));
    fs.writeFileSync(
      script,
      'function setup() { createCanvas(10, 10); loadImage("assets/cat.png"); }'
    );

    await expect(convert(script, { to: 'folder' })).rejects.toThrow(
      /symbolic link/
    );
    expect(fs.existsSync(script)).toBe(true);
    expect(fs.readFileSync(path.join(outside, 'cat.png'), 'utf-8')).toBe('cat');
    expect(fs.existsSync(path.join(tempDir, 'demo'))).toBe(false);
  });

  test('rejects a destination-directory symlink', async () => {
    const script = path.join(tempDir, 'demo.js');
    const outside = path.join(tempDir, 'outside');
    fs.mkdirSync(outside);
    fs.writeFileSync(script, 'function setup() { createCanvas(10, 10); }');
    fs.symlinkSync(outside, path.join(tempDir, 'demo'));

    await expect(convert(script, { to: 'folder' })).rejects.toThrow(
      /symbolic link/
    );
    expect(fs.existsSync(script)).toBe(true);
    expect(fs.readdirSync(outside)).toEqual([]);
  });

  test('rejects a sketch directory that is itself a symlink', async () => {
    const outside = path.join(tempDir, 'outside');
    const linked = path.join(tempDir, 'linked');
    fs.mkdirSync(outside);
    const script = path.join(outside, 'demo.js');
    fs.writeFileSync(script, 'function setup() { createCanvas(10, 10); }');
    fs.symlinkSync(outside, linked);

    await expect(
      convert(path.join(linked, 'demo.js'), { to: 'folder' })
    ).rejects.toThrow(/symbolic link/);
    expect(fs.existsSync(script)).toBe(true);
    expect(fs.existsSync(path.join(outside, 'demo'))).toBe(false);
  });

  test('rejects parent-child target collisions without dirtying the target', async () => {
    const script = path.join(tempDir, 'demo.js');
    const assets = path.join(tempDir, 'assets');
    const target = path.join(tempDir, 'demo');
    fs.mkdirSync(assets);
    fs.mkdirSync(target);
    fs.writeFileSync(
      script,
      'function setup() { createCanvas(10, 10); loadImage("assets"); loadImage("assets/cat.png"); }'
    );
    fs.writeFileSync(path.join(assets, 'cat.png'), 'cat');

    await expect(convert(script, { to: 'folder' })).rejects.toThrow(
      /conflicting target paths/
    );
    expect(fs.existsSync(script)).toBe(true);
    expect(fs.readFileSync(path.join(assets, 'cat.png'), 'utf-8')).toBe('cat');
    expect(fs.readdirSync(target)).toEqual([]);
  });

  test('rejects target collisions that differ only by case', async () => {
    const html = path.join(tempDir, 'demo.html');
    fs.writeFileSync(
      html,
      '<head><link href="Index.html"></head><script src="https://cdn.jsdelivr.net/npm/p5@2.3/lib/p5.min.js"></script><script src="sketch.js"></script>'
    );
    fs.writeFileSync(path.join(tempDir, 'Index.html'), 'associated sentinel');
    fs.writeFileSync(
      path.join(tempDir, 'sketch.js'),
      'function setup() { createCanvas(10, 10); }'
    );

    await expect(convert(html, { to: 'folder' })).rejects.toThrow(
      /Multiple sketch files map/
    );
    expect(fs.existsSync(html)).toBe(true);
    expect(fs.readFileSync(path.join(tempDir, 'Index.html'), 'utf-8')).toBe(
      'associated sentinel'
    );
    expect(fs.existsSync(path.join(tempDir, 'demo'))).toBe(false);
  });

  test('rejects canonically equivalent parent-child target collisions', async () => {
    const script = path.join(tempDir, 'demo.js');
    const assets = path.join(tempDir, 'caf\u00e9');
    const canonicallyEquivalentAssets = path.join(tempDir, 'cafe\u0301');
    fs.mkdirSync(assets);
    fs.writeFileSync(path.join(assets, 'cat.png'), 'cat');
    if (!fs.existsSync(canonicallyEquivalentAssets)) {
      fs.mkdirSync(canonicallyEquivalentAssets);
      fs.writeFileSync(
        path.join(canonicallyEquivalentAssets, 'cat.png'),
        'equivalent cat'
      );
    }
    fs.writeFileSync(
      script,
      'function setup() { createCanvas(10, 10); loadImage("caf\u00e9"); loadImage("cafe\u0301/cat.png"); }'
    );

    await expect(convert(script, { to: 'folder' })).rejects.toThrow(
      /conflicting target paths/
    );
    expect(fs.existsSync(script)).toBe(true);
    expect(fs.readFileSync(path.join(assets, 'cat.png'), 'utf-8')).toBe('cat');
    expect(fs.existsSync(path.join(tempDir, 'demo'))).toBe(false);
  });

  test('rejects target collisions hidden by Windows trailing dots', async () => {
    const html = path.join(tempDir, 'demo.html');
    fs.writeFileSync(
      html,
      '<head><link href="index.html."></head><script src="https://cdn.jsdelivr.net/npm/p5@2.3/lib/p5.min.js"></script><script src="sketch.js"></script>'
    );
    fs.writeFileSync(path.join(tempDir, 'index.html.'), 'associated sentinel');
    fs.writeFileSync(
      path.join(tempDir, 'sketch.js'),
      'function setup() { createCanvas(10, 10); }'
    );

    await expect(convert(html, { to: 'folder' })).rejects.toThrow(
      /Multiple sketch files map/
    );
    expect(fs.existsSync(html)).toBe(true);
    expect(fs.readFileSync(path.join(tempDir, 'index.html.'), 'utf-8')).toBe(
      'associated sentinel'
    );
    expect(fs.existsSync(path.join(tempDir, 'demo'))).toBe(false);
  });

  test('rejects Windows reserved device target names before moving anything', async () => {
    const script = path.join(tempDir, 'CON.js');
    fs.writeFileSync(script, 'function setup() { createCanvas(10, 10); }');

    await expect(convert(script, { to: 'folder' })).rejects.toThrow(
      /reserved device name/
    );
    expect(fs.existsSync(script)).toBe(true);
    expect(fs.existsSync(path.join(tempDir, 'CON'))).toBe(false);
  });
});

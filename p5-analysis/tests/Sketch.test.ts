import fs from 'fs';
import path from 'path';
import rimraf from 'rimraf';
import { Sketch, SketchStructureType } from '../src';

const testfilesPath = './tests/testdata';

/* f`foo/bar` == `${testfilesPath}/foo/bar` */
function f(strings: TemplateStringsArray) {
  return path.join(testfilesPath, ...strings.flatMap(s => s.split('/')));
}

test('Sketch.fromHtmlFile', async () => {
  const sketch = await Sketch.fromHtmlFile(f`Sketch.analyzeDirectory/sketch.html`);
  expect(sketch.structureType).toBe('html');
  expect(sketch.name).toBe('sketch');
  expect(sketch.title).toBe('HTML-based sketch');
  expect(sketch.dir).toBe(f`Sketch.analyzeDirectory`);
  expect(sketch.htmlFile).toBe('sketch.html');
  expect(sketch.mainFile).toBe('sketch.html');
  expect(sketch.scriptFile).toBe('script.js');
});

test('Sketch.fromScriptFile', async () => {
  const sketch = await Sketch.fromScriptFile(f`circles.js`);
  expect(sketch.structureType).toBe('script');
  expect(sketch.name).toBe('circles');
  expect(sketch.title).toBe('Circles');
  expect(sketch.dir).toBe(f``);
  expect(sketch.htmlFile).toBe(null);
  expect(sketch.mainFile).toBe('circles.js');
  expect(sketch.scriptFile).toBe('circles.js');
});

test('Sketch.isSketchHtmlFile', async () => {
  expect(await Sketch.isSketchHtmlFile(f`Sketch.analyzeDirectory/sketch.html`)).toBe(
    true
  );
  expect(await Sketch.isSketchHtmlFile(f`missing-file.html`)).toBe(false);

  expect(fs.existsSync(f`circles.js`)).toBe(true);
  expect(await Sketch.isSketchHtmlFile(f`circles.js`)).toBe(false);

  expect(fs.existsSync(f`non-sketch.html`)).toBe(true);
  expect(await Sketch.isSketchHtmlFile(f`non-sketch.html`)).toBe(false);
});

describe('Sketch.isSketchScriptFile', () => {
  const g = (strings: TemplateStringsArray) =>
    path.join(
      testfilesPath,
      'Sketch.isSketchScriptFile',
      ...strings.flatMap(s => s.split('/'))
    );

  test('recognizes sketch scripts', async () => {
    expect(await Sketch.isSketchScriptFile(f`circles.js`)).toBe(true);
  });

  test.skip('recognizes sketch script modules', async () => {
    expect(await Sketch.isSketchScriptFile(g`instance-mode.js`)).toBe(true);
  });

  test('rejects missing files', async () => {
    expect(await Sketch.isSketchScriptFile(f`missing-file.js`)).toBe(false);
  });

  test("rejects sketches that don't define setup()", async () => {
    expect(await Sketch.isSketchScriptFile(g`without-setup.js`)).toBe(false);
  });

  test("rejects sketches that don't call createCanvas()", async () => {
    expect(await Sketch.isSketchScriptFile(g`without-create-canvas.js`)).toBe(false);
  });
});

test('Sketch.analyzeDirectory', async () => {
  const { sketches, allFiles, unassociatedFiles } = await Sketch.analyzeDirectory(
    f`Sketch.analyzeDirectory`
  );
  expect(sketches.length).toBe(4);
  expect(allFiles.length).toBe(6);
  expect(unassociatedFiles).toEqual(['collection', 'loose.js']);
});

describe('Sketch.isSketchDir', () => {
  const testfileDir = f`Sketch.analyzeDirectory`;

  test('recognizes script-only sketch', async () =>
    expect(
      await Sketch.isSketchDir(path.join(testfileDir, 'js-only-sketch'))
    ).toBeInstanceOf(Sketch));

  test('recognizes directory that contains script and HTML', async () =>
    expect(
      await Sketch.isSketchDir(path.join(testfileDir, 'sketch-dir'))
    ).toBeInstanceOf(Sketch));

  test('rejects missing directory', async () =>
    expect(
      await Sketch.isSketchDir(path.join(testfileDir, 'missing-dir'))
    ).toBeFalsy());

  test('rejects directory containing more than one sketch', async () =>
    expect(await Sketch.isSketchDir(path.join(testfileDir, 'collection'))).toBeFalsy());
});

test('Sketch.files', async () => {
  const sketch = await Sketch.fromDirectory(f`html-includes`);
  expect([...sketch.files].sort()).toEqual(
    ['index.html', 'sketch.js', 'test.css', 'data.json', 'cat.png'].sort()
  );
});

test('Sketch.libraries', async () => {
  let sketch = await Sketch.fromScriptFile(f`library-inference/loadSound.js`);
  expect(sketch.libraries.map(lib => lib.name)).toEqual(['p5.sound']);

  sketch = await Sketch.fromFile(f`Sketch.convert/uninferred-library/index.html`);
  expect(sketch.libraries.map(lib => lib.name)).toEqual(['p5.sound']);

  sketch = await Sketch.fromFile(f`Sketch.convert/explicit-imports.html`);
  expect(sketch.libraries.map(lib => lib.name)).toEqual(['p5.sound', 'ml5.js', 'RiTa']);

  sketch = await Sketch.fromFile(`${testfilesPath}/html-includes/index.html`);
  expect(sketch.libraries.map(l => l.name)).toEqual([]);

  sketch = await Sketch.fromFile(`${testfilesPath}/explicit-imports.html`);
  expect(sketch.libraries.map(l => l.name)).toEqual(['p5.sound', 'ml5.js', 'RiTa']);
});

test('Sketch.description', async () => {
  const testfileDir = f`descriptions`;
  async function description(file: string) {
    const sketch = await Sketch.fromFile(path.join(testfileDir, file));
    return sketch.description?.replace(/\s+/g, ' ');
  }

  await expect(description('single-line-description.js')).resolves.toBe(
    'sketch description'
  );
  await expect(description('multi-line-description.js')).resolves.toBe(
    'sketch description'
  );
  await expect(description('single-line-block-description.js')).resolves.toBe(
    'sketch description'
  );
  await expect(description('multi-line-block-description.js')).resolves.toBe(
    'sketch description'
  );
  await expect(description('html-description.html')).resolves.toBe(
    'sketch description'
  );
});

describe('Sketch.generate', () => {
  const testfileDir = f`Sketch.generate`;
  const outputDir = path.join(testfileDir, 'output');

  beforeEach(() => {
    rimraf.sync(outputDir);
    fs.mkdirSync(outputDir);
  });

  test('with default options', () => testSketchGeneration('test.js', {}, 'default'));

  describe('with options:', () => {
    test('comments=true', () =>
      testSketchGeneration('test.js', { comments: true }, 'comments'));
    test('preload=true', () =>
      testSketchGeneration('test.js', { preload: true }, 'preload'));
    test('windowResized=true', () =>
      testSketchGeneration('test.js', { windowResized: true }, 'windowResized'));
    test('draw=false', () =>
      testSketchGeneration('test.js', { draw: false }, 'no-draw'));
    test('examples=false', () =>
      testSketchGeneration('test.js', { examples: false }, 'no-examples'));
  });

  test('html output', () => testSketchGeneration('test.html', {}, 'html'));

  async function testSketchGeneration(
    outputName: string,
    options: Record<string, boolean>,
    snapshotName: string
  ) {
    const sketch = Sketch.create(`${outputDir}/${outputName}`);
    await sketch.generate(false, options);
    expectDirectoriesEqual(
      outputDir,
      path.join(testfileDir, 'snapshots', snapshotName)
    );
  }
});

describe('Sketch.convert', () => {
  const testfileDir = path.join(testfilesPath, 'Sketch.convert');
  const outputDir = path.join(testfileDir, 'output');

  beforeEach(() => {
    rimraf.sync(outputDir);
    fs.mkdirSync(outputDir);
  });

  describe('script -> html', () => {
    test('simple case', () => testConvert('sketch.js', { type: 'html' }, 'html'));
    // TODO: test the description
    // TODO: remove the description from the js file?

    test('html file already exists', () =>
      testConvert(
        'collision/sketch.js',
        { type: 'html' },
        { exception: /html already exists/ }
      ));

    test('library', () =>
      testConvert('use-sound-library.js', { type: 'html' }, 'use-sound-library'));
  });

  describe('html -> script', () => {
    test('simple case', () =>
      testConvert(['sketch.html', 'sketch.js'], { type: 'script' }, 'script'));
    // TODO: add the description to the script file?

    test('library', () =>
      testConvert(
        'use-sound-library/index.html',
        { type: 'script' },
        'use-sound-library-js'
      ));

    test('uninferred library', () =>
      testConvert(
        'uninferred-library/index.html',
        { type: 'script' },
        {
          exception:
            'index.html contains libraries that are not implied by sketch.js: p5.sound'
        }
      ));

    test('added inferred library', () =>
      testConvert(
        'add-implied-library/index.html',
        { type: 'script' },
        { exception: 'sketch.js implies libraries that are not in index.html' }
      ));

    // TODO: error if html file includes custom css?
    // TODO: error if html file includes extra structure?

    test('inline scripts', () =>
      testConvert(
        'inline-script.html',
        { type: 'script' },
        { exception: /contains an inline script/ }
      ));

    test('multiple scripts', () =>
      testConvert(
        'multiple-scripts.html',
        { type: 'script' },
        { exception: /contains multiple script tags/ }
      ));

    test('missing scripts', () =>
      testConvert(
        'missing-script.html',
        { type: 'script' },
        { exception: /refers to a script file that does not exist/ }
      ));
  });

  async function testConvert(
    filePath: string | string[],
    options: { type: SketchStructureType },
    expectation: string | { exception: string | RegExp }
  ) {
    let mainFile = filePath instanceof Array ? filePath[0] : filePath;
    let snapshotRelDir = path.join(
      'snapshots',
      typeof expectation === 'string' ? expectation : path.dirname(mainFile)
    );
    if (filePath instanceof Array) {
      filePath.forEach(file => {
        fs.copyFileSync(path.join(testfileDir, file), path.join(outputDir, file));
      });
      mainFile = filePath[0];
      // if the file is in a directory, copy all the files
    } else if (filePath.indexOf(path.sep) !== -1) {
      const srcDir = filePath.split(path.sep)[0];
      copyDirectory(path.join(testfileDir, srcDir), outputDir);
      mainFile = filePath
        .split(path.sep)
        .slice(1)
        .join(path.sep);
      if (typeof expectation !== 'string') snapshotRelDir = srcDir;
    } else {
      fs.copyFileSync(path.join(testfileDir, filePath), path.join(outputDir, filePath));
    }
    async function convert() {
      const sketch = await Sketch.fromFile(path.join(outputDir, mainFile!));
      try {
        await sketch.convert(options);
      } catch (e) {
        throw String(e);
      }
    }
    if (expectation instanceof Object) {
      await expect(convert()).rejects.toMatch(expectation.exception);
    } else {
      await convert();
    }
    if (snapshotRelDir !== 'snapshots') {
      expectDirectoriesEqual(outputDir, path.join(testfileDir, snapshotRelDir));
    }
  }
});

function copyDirectory(src: string, dst: string) {
  fs.mkdirSync(dst, { recursive: true });
  fs.readdirSync(src).forEach(file => {
    const srcPath = path.join(src, file);
    const dstPath = path.join(dst, file);
    if (fs.statSync(srcPath).isDirectory()) {
      copyDirectory(srcPath, dstPath);
    } else {
      fs.copyFileSync(srcPath, dstPath);
    }
  });
}

function expectDirectoriesEqual(a: string, b: string) {
  if (process.env.JEST_UPDATE_FILE_SNAPSHOTS) {
    fs.cpSync(a, b, {
      recursive: true,
      filter: (src: string) => !src.startsWith('.')
    });
  }
  let aFiles = getDirectoryJson(a);
  let bFiles = getDirectoryJson(b);
  try {
    expect(aFiles).toEqual(bFiles);
  } catch (e) {
    throw new Error(`${e.message} while comparing ${a} to ${b}`);
  }
}

type ValueOrArray<T> = T | Array<ValueOrArray<T>>;
type DirectoryJson = ValueOrArray<string>;

function getDirectoryJson(dir: string): DirectoryJson {
  expect(fs.statSync(dir).isDirectory()).toBe(true);
  return fs
    .readdirSync(dir)
    .filter(name => !name.startsWith('.'))
    .map(name => {
      const file = path.join(dir, name);
      return [
        name,
        fs.statSync(file).isDirectory()
          ? getDirectoryJson(file)
          : fs.readFileSync(file, 'utf-8')
      ];
    });
}

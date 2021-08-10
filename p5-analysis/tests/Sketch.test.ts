import fs from 'fs';
import path from 'path';
import rimraf from 'rimraf';
import { Sketch, SketchType } from '../src/Sketch';

const testfilesPath = './tests/testdata';

/* f`foo/bar` == `${testfilesPath}/foo/bar` */
function f(strings: TemplateStringsArray) {
  return path.join(testfilesPath, ...strings.flatMap(s => s.split('/')));
}

test('Sketch.fromHtmlFile', () => {
  const sketch = Sketch.fromHtmlFile(f`Sketch.analyzeDirectory/sketch.html`);
  expect(sketch.sketchType === 'html');
  expect(sketch.name).toBe('sketch');
  expect(sketch.title).toBe('HTML-based sketch');
  expect(sketch.dir).toBe(f`Sketch.analyzeDirectory`);
  expect(sketch.htmlFile).toBe('sketch.html');
  expect(sketch.mainFile).toBe('sketch.html');
  expect(sketch.scriptFile).toBe('script.js');
});

test('Sketch.fromScriptFile', () => {
  const sketch = Sketch.fromScriptFile(f`circles.js`);
  expect(sketch.sketchType === 'javascript');
  expect(sketch.name).toBe('circles');
  expect(sketch.title).toBe('Circles');
  expect(sketch.dir).toBe(f``);
  expect(sketch.htmlFile).toBe(null);
  expect(sketch.mainFile).toBe('circles.js');
  expect(sketch.scriptFile).toBe('circles.js');
});

test('Sketch.isSketchHtmlFile', () => {
  expect(Sketch.isSketchHtmlFile(f`Sketch.analyzeDirectory/sketch.html`)).toBe(true);
  expect(Sketch.isSketchHtmlFile(f`missing-file.html`)).toBe(false);

  expect(fs.existsSync(f`circles.js`)).toBe(true);
  expect(Sketch.isSketchHtmlFile(f`circles.js`)).toBe(false);

  expect(fs.existsSync(f`non-sketch.html`)).toBe(true);
  expect(Sketch.isSketchHtmlFile(f`non-sketch.html`)).toBe(false);
});

test('Sketch.isSketchScriptFile', () => {
  expect(Sketch.isSketchScriptFile(f`circles.js`)).toBe(true);
  expect(Sketch.isSketchScriptFile(f`missing-file.js`)).toBe(false);

  expect(fs.existsSync(f`Sketch.analyzeDirectory/loose.js`)).toBe(true);
  expect(Sketch.isSketchScriptFile(f`Sketch.analyzeDirectory/loose.js`)).toBe(false);
});

test('Sketch.analyzeDirectory', () => {
  const { sketches, allFiles, unaffiliatedFiles } = Sketch.analyzeDirectory(f`Sketch.analyzeDirectory`);
  expect(sketches.length).toBe(4);
  expect(allFiles.length).toBe(6);
  expect(unaffiliatedFiles).toEqual(['collection', 'loose.js']);
});

test('Sketch.isSketchDir', () => {
  const testfileDir = f`Sketch.analyzeDirectory`;
  expect(Sketch.isSketchDir(path.join(testfileDir, 'js-only-sketch'))).toBeInstanceOf(Sketch);
  expect(Sketch.isSketchDir(path.join(testfileDir, 'sketch-dir'))).toBeInstanceOf(Sketch);
  expect(Sketch.isSketchDir(path.join(testfileDir, 'missing-dir'))).toBeFalsy();
  expect(Sketch.isSketchDir(path.join(testfileDir, 'collection'))).toBeFalsy();
});

test('Sketch.files', () => {
  const sketch = Sketch.fromDirectory(f`html-includes`);
  expect(sketch.files.sort()).toEqual(['index.html', 'sketch.js', 'test.css', 'data.json', 'cat.png'].sort());
});

test('Sketch.libraries', () => {
  let sketch = Sketch.fromScriptFile(f`library-inference/loadSound.js`);
  expect(sketch.libraries.map(lib => lib.name)).toEqual(['p5.sound']);

  sketch = Sketch.fromFile(f`Sketch.convert/uninferred-library/index.html`);
  expect(sketch.libraries.map(lib => lib.name)).toEqual(['p5.sound']);

  sketch = Sketch.fromFile(f`Sketch.convert/explicit-imports.html`);
  expect(sketch.libraries.map(lib => lib.name)).toEqual(['p5.sound', 'ml5.js', 'Rita']);
});

test('Sketch.description', () => {
  const testfileDir = f`descriptions`;
  expect(Sketch.fromFile(path.join(testfileDir, 'single-line-description.js')).description).toBe('sketch description');
  expect(Sketch.fromFile(path.join(testfileDir, 'multi-line-description.js')).description!.replace(/\s+/g, ' ')).toBe(
    'sketch description'
  );
  expect(Sketch.fromFile(path.join(testfileDir, 'single-line-block-description.js')).description).toBe(
    'sketch description'
  );
  expect(
    Sketch.fromFile(path.join(testfileDir, 'multi-line-block-description.js')).description!.replace(/\s+/g, ' ')
  ).toBe('sketch description');
  expect(Sketch.fromFile(path.join(testfileDir, 'html-description.html')).description).toBe('sketch description');
});

describe('Sketch.generate', () => {
  const testfileDir = f`Sketch.generate`;
  const outputDir = path.join(testfileDir, 'output');

  beforeEach(() => {
    rimraf.sync(outputDir);
    fs.mkdirSync(outputDir);
  });

  test('default options', () => testGenerate('test.js', {}, 'default'));
  test('comments', () => testGenerate('test.js', { comments: true }, 'comments'));
  test('preload', () => testGenerate('test.js', { preload: true }, 'preload'));
  test('windowResized', () => testGenerate('test.js', { windowResized: true }, 'windowResized'));
  test('no-draw', () => testGenerate('test.js', { draw: false }, 'no-draw'));
  test('no-examples', () => testGenerate('test.js', { examples: false }, 'no-examples'));
  test('html', () => testGenerate('test.html', {}, 'html'));

  async function testGenerate(outputName: string, options: Record<string, boolean>, snapshotName: string) {
    const sketch = Sketch.create(`${outputDir}/${outputName}`);
    await sketch.generate(false, options);
    expectDirectoriesEqual(outputDir, path.join(testfileDir, 'snapshots', snapshotName));
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
    test('simple case', () => {
      testSketchConvert('sketch.js', { type: 'html' }, 'html');
      // TODO: test the description
      // TODO: remove the description from the js file?
    });

    test('html file already exists', () => {
      testSketchConvert('collision/sketch.js', { type: 'html' }, { exception: /html already exists/ });
    });

    test('library', () => {
      testSketchConvert('use-sound-library.js', { type: 'html' }, 'use-sound-library');
    });
  });

  describe('html -> script', () => {
    test('simple case', () => {
      testSketchConvert(['sketch.html', 'sketch.js'], { type: 'javascript' }, 'script');
      // TODO: add the description to the script file?
    });

    test('library', () => {
      testSketchConvert('use-sound-library/index.html', { type: 'javascript' }, 'use-sound-library-js');
    });

    test('uninferred library', () => {
      testSketchConvert(
        'uninferred-library/index.html',
        { type: 'javascript' },
        {
          exception: 'index.html contains libraries that are not implied by sketch.js: p5.sound'
        }
      );
    });

    test('added inferred library', () => {
      testSketchConvert(
        'add-implied-library/index.html',
        { type: 'javascript' },
        { exception: 'sketch.js implies libraries that are not in index.html' }
      );
    });

    // TODO: error if html file includes custom css?
    // TODO: error if html file includes extra structure?

    test('inline scripts', () => {
      testSketchConvert('inline-script.html', { type: 'javascript' }, { exception: /contains an inline script/ });
    });

    test('multiple scripts', () => {
      testSketchConvert(
        'multiple-scripts.html',
        { type: 'javascript' },
        { exception: /contains multiple script tags/ }
      );
    });

    test('multiple scripts', () => {
      testSketchConvert(
        'missing-script.html',
        { type: 'javascript' },
        { exception: /refers to a script file that does not exist/ }
      );
    });
  });

  function testSketchConvert(
    filePath: string | string[],
    options: { type: SketchType },
    expectation: string | { exception: string | RegExp }
  ) {
    let mainFile = filePath instanceof Array ? filePath[0] : filePath;
    let snapshotRelDir = path.join('snapshots', typeof expectation === 'string' ? expectation : path.dirname(mainFile));
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
    const convert = () => Sketch.fromFile(path.join(outputDir, mainFile!)).convert(options);
    if (expectation instanceof Object) {
      expect(convert).toThrow(expectation.exception);
    } else {
      convert();
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
      return [name, fs.statSync(file).isDirectory() ? getDirectoryJson(file) : fs.readFileSync(file, 'utf-8')];
    });
}

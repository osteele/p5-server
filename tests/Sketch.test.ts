import fs from "fs";
import path from "path";
import rimraf from "rimraf";
import { Sketch, SketchType } from "../src/models/Sketch";

const testfilesPath = './tests/testdata';

/** Template tag to convert tf`foo/bar` to `${testfilesPath}/foo/bar` */
function tf(strings: TemplateStringsArray) {
  return path.join(testfilesPath, ...strings.flatMap(s => s.split('/')));
}

test('Sketch.fromHtmlFile', () => {
  const sketch = Sketch.fromHtmlFile(tf`Sketch.analyzeDirectory/sketch.html`);
  expect(sketch.sketchType === 'html');
  expect(sketch.name).toBe('HTML-based sketch');
  expect(sketch.dirPath).toBe(tf`Sketch.analyzeDirectory`);
  expect(sketch.htmlPath).toBe('sketch.html');
  expect(sketch.mainFile).toBe('sketch.html');
  expect(sketch.scriptPath).toBe('script.js');
});

test('Sketch.fromJsFile', () => {
  const sketch = Sketch.fromScriptFile(tf`circles.js`);
  expect(sketch.sketchType === 'javascript');
  expect(sketch.name).toBe('circles');
  expect(sketch.dirPath).toBe(tf``);
  expect(sketch.htmlPath).toBe(null);
  expect(sketch.mainFile).toBe('circles.js');
  expect(sketch.scriptPath).toBe('circles.js');
});

test('Sketch.isSketchHtmlFile', () => {
  expect(Sketch.isSketchHtmlFile(tf`Sketch.analyzeDirectory/sketch.html`)).toBe(true);
  expect(Sketch.isSketchHtmlFile(tf`missing-file.html`)).toBe(false);

  expect(fs.existsSync(tf`circles.js`)).toBe(true);
  expect(Sketch.isSketchHtmlFile(tf`circles.js`)).toBe(false);

  expect(fs.existsSync(tf`non-sketch.html`)).toBe(true);
  expect(Sketch.isSketchHtmlFile(tf`non-sketch.html`)).toBe(false);
});

test('Sketch.isSketchScriptFile', () => {
  expect(Sketch.isSketchScriptFile(tf`circles.js`)).toBe(true);
  expect(Sketch.isSketchScriptFile(tf`missing-file.js`)).toBe(false);

  expect(fs.existsSync(tf`Sketch.analyzeDirectory/loose.js`)).toBe(true);
  expect(Sketch.isSketchScriptFile(tf`Sketch.analyzeDirectory/loose.js`)).toBe(false);
});

test('Sketch.analyzeDirectory', () => {
  const { sketches, allFiles, unaffiliatedFiles } = Sketch.analyzeDirectory(tf`Sketch.analyzeDirectory`);
  expect(sketches.length).toBe(4);
  expect(allFiles.length).toBe(6);
  expect(unaffiliatedFiles).toEqual(['collection', 'loose.js']);
});

test('Sketch.isSketchDir', () => {
  const testfileDir = tf`Sketch.analyzeDirectory`;
  expect(Sketch.isSketchDir(path.join(testfileDir, 'js-only-sketch'))).toBeInstanceOf(Sketch);
  expect(Sketch.isSketchDir(path.join(testfileDir, 'sketch-dir'))).toBeInstanceOf(Sketch);
  expect(Sketch.isSketchDir(path.join(testfileDir, 'missing-dir'))).toBeFalsy();
  expect(Sketch.isSketchDir(path.join(testfileDir, 'collection'))).toBeFalsy();
});

test('Sketch.files', () => {
  const sketch = Sketch.fromDirectory(tf`html-includes`);
  expect(sketch.files.sort()).toEqual(
    ['index.html', 'sketch.js', 'test.css', 'data.json', 'cat.png'].sort());
});

test('Sketch.libraries', () => {
  let sketch = Sketch.fromScriptFile(tf`implicit-imports/speech.js`);
  expect(sketch.libraries.map(lib => lib.name)).toEqual(['p5.speech']);

  sketch = Sketch.fromFile(tf`Sketch.convert/uninferred-library/index.html`);
  expect(sketch.libraries.map(lib => lib.name)).toEqual(['p5.sound']);
});

test('Sketch.description', () => {
  const testfileDir = tf`descriptions`;
  expect(Sketch.fromFile(path.join(testfileDir, 'single-line-description.js')).description).toBe('sketch description');
  expect(Sketch.fromFile(path.join(testfileDir, 'multi-line-description.js')).description!.replace(/\s+/g, ' ')).toBe('sketch description');
  expect(Sketch.fromFile(path.join(testfileDir, 'single-line-block-description.js')).description).toBe('sketch description');
  expect(Sketch.fromFile(path.join(testfileDir, 'multi-line-block-description.js')).description!.replace(/\s+/g, ' ')).toBe('sketch description');
  expect(Sketch.fromFile(path.join(testfileDir, 'html-description.html')).description).toBe('sketch description');
});

describe('Sketch.generate', () => {
  const testfileDir = tf`Sketch.generate`;
  const outputDir = path.join(testfileDir, 'output');

  beforeEach(() => {
    rimraf.sync(outputDir);
    fs.mkdirSync(outputDir);
  });

  test('default options', () => {
    testSketchGenerate('test.js', {}, 'default');
  });
  test('comments', () => {
    testSketchGenerate('test.js', { comments: true }, 'comments');
  });
  test('preload', () => {
    testSketchGenerate('test.js', { preload: true }, 'preload');
  });
  test('windowResized', () => {
    testSketchGenerate('test.js', { windowResized: true }, 'windowResized');
  });
  test('no-draw', () => {
    testSketchGenerate('test.js', { draw: false }, 'no-draw');
  });
  test('no-examples', () => {
    testSketchGenerate('test.js', { examples: false }, 'no-examples');
  });
  test('html', () => {
    testSketchGenerate('test.html', {}, 'html');
  });

  function testSketchGenerate(outputName: string, options: Record<string, boolean>, snapshotName: string) {
    const sketch = Sketch.create(`${outputDir}/${outputName}`);
    sketch.generate(false, options);
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
      testSketchConvert('uninferred-library/index.html', { type: 'javascript' },
        { exception: "index.html contains libraries that are not implied by sketch.js: p5.sound" });
    });

    test('added inferred library', () => {
      testSketchConvert('add-implied-library/index.html', { type: 'javascript' },
        { exception: "sketch.js implies libraries that are not in index.html" });
    });

    // TODO: error if html file includes an inline script
    // TODO: error if html file includes multiple scripts
    // TODO: error if html file includes custom css
    // TODO: error if html file includes extra structure
    test.skip('multiple scripts', () => {
      testSketchConvert('multiple-scripts/index.html', { type: 'javascript' }, { exception: /multiple scripts/ });
    });
  });

  function testSketchConvert(filePath: string | string[], options: { type: SketchType }, expectation: string | { exception: string | RegExp }) {
    let mainFile = filePath instanceof Array ? filePath[0] : filePath;
    let snapshotRelDir = path.join('snapshots',
      typeof expectation === 'string' ? expectation : path.dirname(mainFile));
    if (filePath instanceof Array) {
      filePath.forEach(file => {
        fs.copyFileSync(path.join(testfileDir, file), path.join(outputDir, file));
      });
      mainFile = filePath[0];
      // if the file is in a directory, copy all the files
    } else if (filePath.indexOf(path.sep) !== -1) {
      const srcDir = filePath.split(path.sep)[0];
      copyDirectory(path.join(testfileDir, srcDir), outputDir);
      mainFile = filePath.split(path.sep).slice(1).join(path.sep);
      if (typeof expectation !== 'string') snapshotRelDir = srcDir;
    } else {
      fs.copyFileSync(path.join(testfileDir, filePath), path.join(outputDir, filePath));
      // mainFile = filePath;
    }
    const convert = () => Sketch.fromFile(path.join(outputDir, mainFile!)).convert(options);
    if (expectation instanceof Object) {
      expect(convert).toThrow(expectation.exception);
    } else {
      convert();
    }
    expectDirectoriesEqual(outputDir, path.join(testfileDir, snapshotRelDir));
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
  return fs.readdirSync(dir)
    .filter(name => !name.startsWith('.'))
    .map(name => {
      const file = path.join(dir, name);
      return [name, fs.statSync(file).isDirectory()
        ? getDirectoryJson(dir)
        : fs.readFileSync(file, 'utf-8')];
    });
}

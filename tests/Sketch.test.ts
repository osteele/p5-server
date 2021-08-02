import fs from "fs";
import path from "path";
import rimraf from "rimraf";
import util from 'util';
import { Sketch } from "../src/models/Sketch";

const rimrafP = util.promisify(rimraf);

const testfilesPath = './tests/testdata';


test('Sketch.fromHtmlFile', () => {
  const sketch = Sketch.fromHtmlFile(`${testfilesPath}/directory-analysis/sketch.html`);
  expect(sketch.name).toBe('HTML-based sketch');
  expect(sketch.dirPath).toBe(`${testfilesPath}/directory-analysis`);
  expect(sketch.htmlPath).toBe('sketch.html');
  expect(sketch.mainFile).toBe('sketch.html');
  expect(sketch.scriptPath).toBe('script.js');
});

test('Sketch.fromJsFile', () => {
  const sketch = Sketch.fromScriptFile(`${testfilesPath}/circles.js`);
  expect(sketch.name).toBe('circles');
  expect(sketch.dirPath).toBe(testfilesPath);
  expect(sketch.htmlPath).toBe(null);
  expect(sketch.mainFile).toBe('circles.js');
  expect(sketch.scriptPath).toBe('circles.js');
});

test('Sketch.isSketchHtmlFile', () => {
  expect(Sketch.isSketchHtmlFile(`${testfilesPath}/directory-analysis/sketch.html`)).toBe(true);
  expect(Sketch.isSketchHtmlFile(`${testfilesPath}/missing-file.html`)).toBe(false);

  expect(fs.existsSync(`${testfilesPath}/circles.js`)).toBe(true);
  expect(Sketch.isSketchHtmlFile(`${testfilesPath}/circles.js`)).toBe(false);

  expect(fs.existsSync(`${testfilesPath}/non-sketch.html`)).toBe(true);
  expect(Sketch.isSketchHtmlFile(`${testfilesPath}/non-sketch.html`)).toBe(false);
});

test('Sketch.isSketchScriptFile', () => {
  expect(Sketch.isSketchScriptFile(`${testfilesPath}/circles.js`)).toBe(true);
  expect(Sketch.isSketchScriptFile(`${testfilesPath}/missing-file.js`)).toBe(false);

  expect(fs.existsSync(`${testfilesPath}/directory-analysis/loose.js`)).toBe(true);
  expect(Sketch.isSketchScriptFile(`${testfilesPath}/directory-analysis/loose.js`)).toBe(false);
});

test('Sketch.analyzeDirectory', () => {
  const { sketches, allFiles, unaffiliatedFiles } = Sketch.analyzeDirectory(`${testfilesPath}/directory-analysis`);
  expect(sketches.length).toBe(4);
  expect(allFiles.length).toBe(6);
  expect(unaffiliatedFiles).toEqual(['collection', 'loose.js']);
});

test('Sketch.isSketchDir', () => {
  const testfileDir = path.join(testfilesPath, 'directory-analysis');
  expect(Sketch.isSketchDir(path.join(testfileDir, 'js-only-sketch'))).toBeInstanceOf(Sketch);
  expect(Sketch.isSketchDir(path.join(testfileDir, 'sketch-dir'))).toBeInstanceOf(Sketch);
  expect(Sketch.isSketchDir(path.join(testfileDir, 'missing-dir'))).toBeFalsy();
  expect(Sketch.isSketchDir(path.join(testfileDir, 'collection'))).toBeFalsy();
});

test('Sketch.files', () => {
  const sketch = Sketch.fromDirectory(`${testfilesPath}/html-includes`);
  expect(sketch.files.sort()).toEqual(
    ['index.html', 'sketch.js', 'test.css', 'data.json', 'cat.png'].sort());
});

test('Sketch.description', () => {
  const testfileDir = path.join(testfilesPath, 'descriptions');
  expect(Sketch.fromFile(path.join(testfileDir, 'single-line-description.js')).description).toBe('sketch description');
  expect(Sketch.fromFile(path.join(testfileDir, 'multi-line-description.js')).description!.replace(/\s+/g, ' ')).toBe('sketch description');
  expect(Sketch.fromFile(path.join(testfileDir, 'single-line-block-description.js')).description).toBe('sketch description');
  expect(Sketch.fromFile(path.join(testfileDir, 'multi-line-block-description.js')).description!.replace(/\s+/g, ' ')).toBe('sketch description');
  expect(Sketch.fromFile(path.join(testfileDir, 'html-description.html')).description).toBe('sketch description');
});

describe('Sketch.generation', () => {
  const testfileDir = path.join(testfilesPath, 'generation');
  const outputDir = path.join(testfileDir, 'output');

  beforeEach(async () => {
    await rimrafP(outputDir);
    fs.mkdirSync(outputDir);
  });

  test('default options', () => {
    testGeneration('test.js', {}, 'default');
  });
  test('comments', () => {
    testGeneration('test.js', { comments: true }, 'comments');
  });
  test('preload', () => {
    testGeneration('test.js', { preload: true }, 'preload');
  });
  test('windowResized', () => {
    testGeneration('test.js', { windowResized: true }, 'windowResized');
  });
  test('no-draw', () => {
    testGeneration('test.js', { draw: false }, 'no-draw');
  });
  test('no-examples', () => {
    testGeneration('test.js', { examples: false }, 'no-examples');
  });
  test('html', () => {
    testGeneration('test.html', {}, 'html');
  });

  function testGeneration(outputName: string, options: Record<string, boolean>, golden: string) {
    const sketch = Sketch.create(`${outputDir}/${outputName}`);
    sketch.generate(false, options);
    expectDirectoriesEqual(outputDir, path.join(testfileDir, 'golden', golden));
  }
});

describe('Sketch.conversion', () => {
  const testfileDir = path.join(testfilesPath, 'conversion');
  const outputDir = path.join(testfileDir, 'output');

  beforeEach(async () => {
    await rimrafP(outputDir);
    fs.mkdirSync(outputDir);
  });

  describe('script -> html', () => {
    test('simple case', () => {
      testSketchConvert('sketch.js', { type: 'html' }, 'html');
      // TODO: test library imports
      // TODO: test the description
      // TODO: remove the description form the js file
    });

    test('html file already exists', () => {
      testSketchConvert('collision/sketch.js', { type: 'html' }, { exception: /html already exists/ });
    });
  });

  describe('html -> script', () => {
    test('simple case', () => {
      testSketchConvert(['sketch.html', 'sketch.js'], { type: 'javascript' }, 'script');
      // TODO: error if html file has custom css or other structure
      // TODO: error if the html file includes multiple scripts
      // TODO: error if html file includes uninferred libraries
      // TODO: add the description?
    });
  });

  function testSketchConvert(filePath: string | string[], options: any, expectation: string | { exception: string | RegExp }) {
    let mainFile = filePath instanceof Array ? filePath[0] : filePath;
    let snapshotName = path.join('golden',
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
      snapshotName = srcDir;
    } else {
      fs.copyFileSync(path.join(testfileDir, filePath), path.join(outputDir, filePath));
      mainFile = filePath;
    }
    const convert = () => Sketch.fromFile(path.join(outputDir, mainFile!)).convert(options);
    if (expectation instanceof Object) {
      expect(convert).toThrow(expectation.exception);
    } else {
      convert();
    }
    expectDirectoriesEqual(outputDir, path.join(testfileDir, snapshotName));
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
  expect(aFiles).toEqual(bFiles);
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

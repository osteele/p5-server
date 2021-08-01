import { Sketch } from "../src/models/Sketch";
import fs from "fs";
import rimraf from "rimraf";

const testData = './tests/testdata';

test('Sketch.fromHtmlFile', () => {
  const sketch = Sketch.fromHtmlFile(`${testData}/directory-analysis/sketch.html`);
  expect(sketch.name).toBe('HTML-based sketch');
  expect(sketch.dirPath).toBe(`${testData}/directory-analysis`);
  expect(sketch.htmlPath).toBe('sketch.html');
  expect(sketch.scriptPath).toBe('script.js');
  expect(sketch.mainFile).toBe('sketch.html');
});

test('Sketch.fromJsFile', () => {
  const sketch = Sketch.fromScriptFile(`${testData}/circles.js`);
  expect(sketch.name).toBe('circles');
  expect(sketch.dirPath).toBe(`${testData}`);
  expect(sketch.htmlPath).toBe(null);
  expect(sketch.scriptPath).toBe('circles.js');
  expect(sketch.mainFile).toBe('circles.js');
});

test('Sketch.isSketchHtmlFile', () => {
  expect(Sketch.isSketchHtmlFile(`${testData}/directory-analysis/sketch.html`)).toBe(true);
  expect(Sketch.isSketchHtmlFile(`${testData}/missing-file.html`)).toBe(false);

  expect(fs.existsSync(`${testData}/circles.js`)).toBe(true);
  expect(Sketch.isSketchHtmlFile(`${testData}/circles.js`)).toBe(false);

  expect(fs.existsSync(`${testData}/non-sketch.html`)).toBe(true);
  expect(Sketch.isSketchHtmlFile(`${testData}/non-sketch.html`)).toBe(false);
});

test('Sketch.isSketchScriptFile', () => {
  expect(Sketch.isSketchScriptFile(`${testData}/circles.js`)).toBe(true);
  expect(Sketch.isSketchScriptFile(`${testData}/missing-file.js`)).toBe(false);

  expect(fs.existsSync(`${testData}/directory-analysis/loose.js`)).toBe(true);
  expect(Sketch.isSketchScriptFile(`${testData}/directory-analysis/loose.js`)).toBe(false);
});

test('Sketch.analyzeDirectory', () => {
  const { sketches, allFiles, unaffiliatedFiles } = Sketch.analyzeDirectory(`${testData}/directory-analysis`);
  expect(sketches.length).toBe(4);
  expect(allFiles.length).toBe(6);
  expect(unaffiliatedFiles).toEqual(['collection', 'loose.js']);
});

test('Sketch.isSketchDir', () => {
  expect(Sketch.isSketchDir(`${testData}/directory-analysis/js-only-sketch`)).toBeInstanceOf(Sketch);
  expect(Sketch.isSketchDir(`${testData}/directory-analysis/sketch-dir`)).toBeInstanceOf(Sketch);
  expect(Sketch.isSketchDir(`${testData}/missing-dir`)).toBeFalsy();
  expect(Sketch.isSketchDir(`${testData}/directory-analysis/collection`)).toBeFalsy();
});

test('Sketch.files', () => {
  const sketch = Sketch.fromDirectory(`${testData}/html-includes`);
  expect(sketch.files.sort()).toEqual(
    ['index.html', 'sketch.js', 'test.css', 'data.json', 'cat.png'].sort());
});

test('Sketch.description', () => {
  expect(Sketch.fromFile(`${testData}/descriptions/single-line-description.js`).description).toBe('sketch description');
  expect(Sketch.fromFile(`${testData}/descriptions/multi-line-description.js`).description!.replace(/\s+/g, ' ')).toBe('sketch description');
  expect(Sketch.fromFile(`${testData}/descriptions/single-line-block-description.js`).description).toBe('sketch description');
  expect(Sketch.fromFile(`${testData}/descriptions/multi-line-block-description.js`).description!.replace(/\s+/g, ' ')).toBe('sketch description');
  expect(Sketch.fromFile(`${testData}/descriptions/html-description.html`).description).toBe('sketch description');
});

describe('Sketch.generation', () => {
  const outputDir = `${testData}/generation/output`;

  beforeEach(async () => {
    await new Promise<void>((resolve, reject) => rimraf(outputDir, err => err ? reject(err) : resolve()));
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
    expectDirectoriesEqual(outputDir, `${testData}/generation/golden/${golden}`);
  }
});

describe('Sketch.conversion', () => {
  const outputDir = `${testData}/conversion/output`;

  beforeEach(async () => {
    await new Promise<void>((resolve, reject) => rimraf(outputDir, err => err ? reject(err) : resolve()));
    fs.mkdirSync(outputDir);
  });

  test('script -> html', () => {
    testConversion('sketch.js', { type: 'html' }, 'html');
    // TODO: error if html file exists
    // TODO: test library imports
    // TODO: test the description
    // TODO: remove the description form the js file
  });

  test('html -> script', () => {
    testConversion(['sketch.html', 'sketch.js'], { type: 'javascript' }, 'script');
    // TODO: error if html file has custom css or other structure
    // TODO: error if the html file includes multiple scripts
    // TODO: error if html file includes uninferred libraries
    // TODO: add the description?
  });

  function testConversion(filePath: string | string[], options: any, golden: string) {
    if (filePath instanceof Array) {
      filePath.forEach(file => {
        fs.copyFileSync(`${testData}/conversion/${file}`, `${outputDir}/${file}`);
      });
    } else {
      fs.copyFileSync(`${testData}/conversion/${filePath}`, `${outputDir}/${filePath}`);
    }
    const mainFile = filePath instanceof Array ? filePath[0] : filePath;
    Sketch.fromFile(`${outputDir}/${mainFile}`).convert(options);
    expectDirectoriesEqual(outputDir, `${testData}/conversion/golden/${golden}`);
  }
});

function expectDirectoriesEqual(a: string, b: string) {
  let aFiles = getDirectoryJson(a);
  let bFiles = getDirectoryJson(b);
  expect(aFiles).toEqual(bFiles);
}

type ValueOrArray<T> = T | Array<ValueOrArray<T>>;
type DirectoryJson = ValueOrArray<string>;

function getDirectoryJson(dir: string): DirectoryJson {
  expect(fs.statSync(dir).isDirectory()).toBe(true);
  return fs.readdirSync(dir).map(name => {
    const file = `${dir}/${name}`;
    return [name, fs.statSync(file).isDirectory()
      ? getDirectoryJson(dir)
      : fs.readFileSync(file, 'utf8')];
  });
}

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

test('Sketch.generation', async () => {
  await testGeneration('test.js', {}, 'default');
  await testGeneration('test.js', { comments: true }, 'comments');
  await testGeneration('test.js', { preload: true }, 'preload');
  await testGeneration('test.js', { windowResized: true }, 'windowResized');
  await testGeneration('test.js', { draw: false }, 'no-draw');
  await testGeneration('test.js', { examples: false }, 'no-examples');
  await testGeneration('test.html', {}, 'html');

  async function testGeneration(outputName: string, options: Record<string, boolean>, golden: string) {
    const outputDir = `${testData}/generation/output`;
    await new Promise<void>((resolve, reject) => rimraf(outputDir, err => err ? reject(err) : resolve()));
    fs.mkdirSync(outputDir);

    const sketch = Sketch.create(`${outputDir}/${outputName}`);
    sketch.generate(false, options);
    expectDirectoriesEqual(outputDir, `${testData}/generation/golden/${golden}`);
  }
});

});

function expectDirectoriesEqual(d1: string, d2: string) {
  try {
    expect(fs.statSync(d1).isDirectory()).toBe(true);
    expect(fs.statSync(d2).isDirectory()).toBe(true);
    expect(fs.readdirSync(d1)).toEqual(fs.readdirSync(d2));
    fs.readdirSync(d1).forEach(file => {
      const [a, b] = [`${d1}/${file}`, `${d2}/${file}`];
      expect(fs.existsSync(b)).toBe(true);
      expect(fs.statSync(a).isDirectory()).toEqual(fs.statSync(a).isDirectory());
      if (fs.statSync(a).isDirectory()) {
        expectDirectoriesEqual(a, b);
      } else {
        expect(fs.readFileSync(a, 'utf8')).toEqual(fs.readFileSync(b, 'utf8'));
      }
    });
  } catch (e) {
    throw new Error(`${e.message} while comparing ${d1} to ${d2}`)
  }
}

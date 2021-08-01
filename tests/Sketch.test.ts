import { Sketch } from "../src/models/Sketch";
import fs from "fs";

test('Sketch.fromHtmlFile', () => {
  const sketch = Sketch.fromHtmlFile('./tests/testdata/directory-analysis/sketch.html');
  expect(sketch.name).toBe('HTML-based sketch');
  expect(sketch.dirPath).toBe('./tests/testdata/directory-analysis');
  expect(sketch.htmlPath).toBe('sketch.html');
  expect(sketch.jsSketchPath).toBe('script.js');
});

test('Sketch.fromJsFile', () => {
  const sketch = Sketch.fromScriptFile('./tests/testdata/circles.js');
  expect(sketch.name).toBe('circles');
  expect(sketch.dirPath).toBe('./tests/testdata');
  expect(sketch.htmlPath).toBe(null);
  expect(sketch.jsSketchPath).toBe('circles.js');
});

test('Sketch.isSketchHtmlFile', () => {
  expect(Sketch.isSketchHtmlFile('./tests/testdata/directory-analysis/sketch.html')).toBe(true);
  expect(Sketch.isSketchHtmlFile('./tests/testdata/missing-file.html')).toBe(false);

  expect(fs.existsSync('./tests/testdata/circles.js')).toBe(true);
  expect(Sketch.isSketchHtmlFile('./tests/testdata/circles.js')).toBe(false);

  expect(fs.existsSync('./tests/testdata/non-sketch.html')).toBe(true);
  expect(Sketch.isSketchHtmlFile('./tests/testdata/non-sketch.html')).toBe(false);
});

test('Sketch.isSketchScriptFile', () => {
  expect(Sketch.isSketchScriptFile('./tests/testdata/circles.js')).toBe(true);
  expect(Sketch.isSketchScriptFile('./tests/testdata/missing-file.js')).toBe(false);

  expect(fs.existsSync('./tests/testdata/directory-analysis/loose.js')).toBe(true);
  expect(Sketch.isSketchScriptFile('./tests/testdata/directory-analysis/loose.js')).toBe(false);
});

test('Sketch.analyzeDirectory', () => {
  const { sketches, allFiles, unaffiliatedFiles } = Sketch.analyzeDirectory('./tests/testdata/directory-analysis');
  expect(sketches.length).toBe(4);
  expect(allFiles.length).toBe(6);
  expect(unaffiliatedFiles).toEqual(['collection', 'loose.js']);
});

test('Sketch.isSketchDir', () => {
  expect(Sketch.isSketchDir('./tests/testdata/directory-analysis/js-only-sketch')).toBeInstanceOf(Sketch);
  expect(Sketch.isSketchDir('./tests/testdata/directory-analysis/sketch-dir')).toBeInstanceOf(Sketch);
  expect(Sketch.isSketchDir('./tests/testdata/missing-dir')).toBeFalsy();
  expect(Sketch.isSketchDir('./tests/testdata/directory-analysis/collection')).toBeFalsy();
});

test('Sketch.files', () => {
  const sketch = Sketch.fromDirectory('./tests/testdata/html-includes');
  expect(sketch.files.sort()).toEqual(
    ['index.html', 'sketch.js', 'test.css', 'data.json', 'cat.png'].sort());
});

test('Sketch.description', () => {
  expect(Sketch.fromFile('./tests/testdata/descriptions/single-line-description.js').description).toBe('sketch description');
  expect(Sketch.fromFile('./tests/testdata/descriptions/multi-line-description.js').description!.replace(/\s+/g, ' ')).toBe('sketch description');
  expect(Sketch.fromFile('./tests/testdata/descriptions/single-line-block-description.js').description).toBe('sketch description');
  expect(Sketch.fromFile('./tests/testdata/descriptions/multi-line-block-description.js').description!.replace(/\s+/g, ' ')).toBe('sketch description');
  expect(Sketch.fromFile('./tests/testdata/descriptions/html-description.html').description).toBe('sketch description');
});

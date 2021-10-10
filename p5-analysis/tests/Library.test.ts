import { Library } from '../src';

const testfilesPath = './tests/testdata';

test('Library.length', () => {
  expect(Library.all.length).toBeGreaterThan(10);
});

test('Library.inferLibrariesFromScripts', () => {
  const dir = `${testfilesPath}/library-inference`;
  const inferLibraries = (filename: string) =>
    Library.inferFromScripts([`${dir}/${filename}`], { ifNotExists: 'error' }).map(
      lib => lib.name
    );

  expect(Library.all.length).toBeGreaterThan(10);
  expect(inferLibraries(`no-libraries.js`)).toHaveLength(0);
  expect(inferLibraries(`loadSound.js`)).toEqual(['p5.sound']);
  expect(inferLibraries(`dat.js`)).toEqual(['dat.gui']);
  expect(inferLibraries(`ml5.poseNet.js`)).toEqual(['ml5.js']);
  expect(inferLibraries(`p5.Pulse.js`)).toEqual(['p5.sound']);
  expect(inferLibraries(`p5.Speech.js`)).toEqual(['p5.speech']);
});

test('Script.findLibrariesInHtml', () => {
  expect(
    Library.inHtml(`${testfilesPath}/html-includes/index.html`).map(l => l.name)
  ).toEqual([]);
  expect(
    Library.inHtml(`${testfilesPath}/explicit-imports.html`).map(l => l.name)
  ).toEqual(['p5.sound', 'ml5.js', 'RiTa']);
});

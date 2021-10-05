import path from 'path';
import { Library } from '../src/lib/Library';

const testfilesPath = './tests/testdata';

test('Library.inferLibrariesFromScripts', () => {
  const dir = path.join(testfilesPath, 'library-inference');

  expect(Library.inferFromScripts([`${dir}/no-libraries.js`]).map(l => l.name)).toEqual(
    []
  );
  expect(Library.inferFromScripts([`${dir}/loadSound.js`]).map(l => l.name)).toEqual([
    'p5.sound',
  ]);
  expect(Library.inferFromScripts([`${dir}/dat.js`]).map(l => l.name)).toEqual([
    'dat.gui',
  ]);
  expect(Library.inferFromScripts([`${dir}/ml5.poseNet.js`]).map(l => l.name)).toEqual([
    'ml5.js',
  ]);
  expect(Library.inferFromScripts([`${dir}/p5.Pulse.js`]).map(l => l.name)).toEqual([
    'p5.sound',
  ]);
  expect(Library.inferFromScripts([`${dir}/p5.Speech.js`]).map(l => l.name)).toEqual([
    'p5.speech',
  ]);
});

test('Script.findLibrariesInHtml', () => {
  expect(
    Library.inHtml(`${testfilesPath}/html-includes/index.html`).map(l => l.name)
  ).toEqual([]);
  expect(
    Library.inHtml(`${testfilesPath}/explicit-imports.html`).map(l => l.name)
  ).toEqual(['p5.sound', 'ml5.js', 'RiTa']);
});

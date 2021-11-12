import { Library } from '../src';

const testfilesPath = './tests/testdata';

test('Library.length', () => {
  expect(Library.all.length).toBeGreaterThan(10);
});

describe('Library.find', () => {
  test('by name', () => {
    expect(Library.find({ name: 'p5.sound' })).toBeInstanceOf(Library);
    expect(Library.find({ name: 'p5.serial' })).toBeInstanceOf(Library);
  });

  test('by import path', () => {
    expect(
      Library.find({
        importPath: 'https://cdn.jsdelivr.net/npm/p5@1.4.0/lib/addons/p5.sound.min.js'
      }).name
    ).toBe('p5.sound');
    expect(
      Library.find({
        importPath: 'https://unpkg.com/p5.rotate-about'
      })?.name
    ).toBe('p5.rotate-about');
    expect(
      Library.find({
        importPath: 'https://unpkg.com/p5.rotate-about@latest'
      })?.name
    ).toBe('p5.rotate-about');
    expect(
      Library.find({
        importPath: 'https://unpkg.com/p5.vector-arguments@1.0.0'
      })?.name
    ).toBe('p5.vector-arguments');
    expect(
      Library.find({ importPath: 'https://unpkg.com/undefined-library-name' })
    ).toBeNull();
    expect(
      Library.find({
        importPath: 'https://cdn.skypack.dev/p5.rotate-about'
      })?.name
    ).toBe('p5.rotate-about');
  });
});

describe('Library.inferLibrariesFromScripts', () => {
  const dir = `${testfilesPath}/library-inference`;
  const inferLibraries = (filename: string) =>
    Library.inferFromScripts([`${dir}/${filename}`], { ifNotExists: 'error' }).map(
      lib => lib.name
    );

  test('infers libraries from global variable references', () => {
    expect(inferLibraries(`no-libraries.js`)).toHaveLength(0);
    expect(inferLibraries(`loadSound.js`)).toEqual(['p5.sound']);
    expect(inferLibraries(`dat.js`)).toEqual(['dat.gui']);
    expect(inferLibraries(`ml5.poseNet.js`)).toEqual(['ml5.js']);
    expect(inferLibraries(`p5.Pulse.js`)).toEqual(['p5.sound']);
    expect(inferLibraries(`p5.Speech.js`)).toEqual(['p5.speech']);
  });

  test('infers libraries from comment directives', () => {
    const libs = Library.inferFromScripts([
      `${testfilesPath}/library-config-comments.js`
    ]);
    expect(libs[0]).toBe(Library.find({ name: 'p5.sound' }));
    const importPaths = libs.map(lib => lib.importPath);
    expect(importPaths.slice(1)).toEqual([
      'https://unpkg.com/@mediapipe/pose',
      'https://cdn.jsdelivr.net/npm/@tensorflow-models/pose-detection'
    ]);
  });
});

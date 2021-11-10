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
      })
    ).toBeInstanceOf(Library);
    expect(
      Library.find({
        importPath: 'https://unpkg.com/p5.rotate-about'
      })
    ).toBeInstanceOf(Library);
    expect(
      Library.find({
        importPath: 'https://unpkg.com/p5.rotate-about@latest'
      })
    ).toBeInstanceOf(Library);
    expect(
      Library.find({
        importPath: 'https://unpkg.com/p5.vector-arguments@1.0.0'
      })
    ).toBeInstanceOf(Library);
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
});

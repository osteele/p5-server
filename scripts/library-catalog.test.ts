import { expect, test } from 'bun:test';
import {
  compileCommunityCatalog,
  type OfficialLibrary,
} from './library-catalog.js';

const library: OfficialLibrary = {
  name: 'Example',
  description: 'Example library',
  sourceUrl: 'https://github.com/example/library',
  npmFilePath: 'example/library@main/index.js',
};

test('does not interpret a GitHub path as an npm load target', () => {
  expect(compileCommunityCatalog([library], {})).toEqual([
    {
      name: 'Example',
      description: 'Example library',
      homepage: 'https://github.com/example/library',
      inference: 'directive-only',
    },
  ]);
});

test('uses a discriminated load override for a GitHub script', () => {
  expect(
    compileCommunityCatalog([library], {
      Example: {
        set: {
          load: {
            kind: 'github',
            repository: 'example/library',
            ref: 'main',
            file: 'index.js',
          },
        },
      },
    })[0]?.importPath
  ).toBe('https://cdn.jsdelivr.net/gh/example/library@main/index.js');
});

test('rejects obsolete curator overrides', () => {
  expect(() =>
    compileCommunityCatalog([library], { Missing: { set: {} } })
  ).toThrow('Overrides refer to missing libraries: Missing');
});

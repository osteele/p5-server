import checkCollisions from '../src/commands/check-library-collisions';
import {
  findMinimizedAlternatives,
  listLibraries,
  checkLibraryPaths,
  generateLibraryPage,
} from '../src/commands/library-commands';

test('cli', () => {
  // The main purpose of these is to import the CLI functions, so that running
  // the tests causes typescript to type-check them.
  expect(checkCollisions).toBeInstanceOf(Function);
  expect(checkLibraryPaths).toBeInstanceOf(Function);
  expect(findMinimizedAlternatives).toBeInstanceOf(Function);
  expect(listLibraries).toBeInstanceOf(Function);
  expect(generateLibraryPage).toBeInstanceOf(Function);
});

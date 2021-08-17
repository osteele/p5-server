import build from '../src/commands/build';
import convert from '../src/commands/convert';
import create from '../src/commands/create';
import serve from '../src/commands/serve';
import tree from '../src/commands/tree';

test('cli', () => {
  // The main purpose of these is to import the CLI functions, so that running
  // the tests causes typescript to type-check them.
  expect(build).toBeInstanceOf(Function);
  expect(convert).toBeInstanceOf(Function);
  expect(create).toBeInstanceOf(Function);
  expect(serve).toBeInstanceOf(Function);
  expect(tree).toBeInstanceOf(Function);
});

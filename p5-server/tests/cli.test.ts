import build from '../src/commands/buildCommand';
import convert from '../src/commands/convertSketch';
import create from '../src/commands/createSketch';
import serve from '../src/commands/serveCommand';

test('cli', () => {
  // The main purpose of these is to import the CLI functions, so that running
  // the tests causes typescript to type-check them.
  expect(build).toBeInstanceOf(Function);
  expect(convert).toBeInstanceOf(Function);
  expect(create).toBeInstanceOf(Function);
  expect(serve).toBeInstanceOf(Function);
});

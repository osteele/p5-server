import { program } from '../src/bin/p5-analyze-cli';
import { program as libraryProgram } from '../src/bin/p5-libraries-cli';
import { program as treeProgram } from '../src/bin/p5-tree-cli';

test('cli', () => {
  expect(program.commands.length).toBeGreaterThanOrEqual(3);
  expect(libraryProgram.commands.length).toBeGreaterThan(3);
  expect(treeProgram.commands.length).toBe(0);
});

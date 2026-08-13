import { npmInvocation } from '../src/commands/library-commands';

test('npm invocation avoids Windows command shims', () => {
  expect(
    npmInvocation(
      'win32',
      'C:\\Program Files\\Bun\\bun.exe',
      undefined,
      'C:\\Windows\\System32\\cmd.exe'
    )
  ).toEqual({
    executable: 'C:\\Windows\\System32\\cmd.exe',
    leadingArgs: ['/d', '/s', '/c', 'npm.cmd'],
  });
  expect(
    npmInvocation(
      'win32',
      'C:\\node.exe',
      'D:\\npm\\node_modules\\npm\\bin\\npm-cli.js'
    )
  ).toEqual({
    executable: 'C:\\node.exe',
    leadingArgs: ['D:\\npm\\node_modules\\npm\\bin\\npm-cli.js'],
  });
});

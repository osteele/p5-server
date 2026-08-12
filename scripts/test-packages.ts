import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

const projectRoot = process.cwd();
const tempDir = await mkdtemp(path.join(os.tmpdir(), 'p5-tools-packages-'));
const archiveDir = path.join(tempDir, 'archives');
const consumerDir = path.join(tempDir, 'consumer');

try {
  await mkdir(archiveDir);
  await mkdir(consumerDir);

  const archives: string[] = [];
  for (const workspace of ['p5-analysis', 'p5-server']) {
    const filename = `${workspace}.tgz`;
    await run(
      ['bun', 'pm', 'pack', '--filename', path.join(archiveDir, filename)],
      path.join(projectRoot, workspace)
    );
    archives.push(path.join(archiveDir, filename));
  }

  await writeFile(
    path.join(consumerDir, 'package.json'),
    JSON.stringify(
      {
        name: 'p5-tools-package-smoke-test',
        overrides: { 'p5-analysis': archives[0] },
        private: true,
      },
      null,
      2
    )
  );
  for (const archive of archives) {
    await run(['bun', 'add', '--ignore-scripts', archive], consumerDir);
  }
  await run(
    [
      'node',
      '-e',
      "Promise.all([import('p5-analysis'), import('p5-server')]).then(([analysis, server]) => { if (!analysis.Sketch || !server.Server) process.exit(1) })",
    ],
    consumerDir
  );
  const executables = [
    ['p5', 'p5-server', 'dist/bin/p5-server.js'],
    ['p5-analyze', 'p5-analysis', 'dist/bin/p5-analyze-cli.js'],
    ['p5-libraries', 'p5-analysis', 'dist/bin/p5-libraries-cli.js'],
    ['p5-tree', 'p5-analysis', 'dist/bin/p5-tree-cli.js'],
  ];
  for (const [binName, packageName, executable] of executables) {
    const command =
      process.platform === 'win32'
        ? [
            'node',
            path.join(consumerDir, 'node_modules', packageName, executable),
            '--help',
          ]
        : [path.join(consumerDir, 'node_modules', '.bin', binName), '--help'];
    await run(command, consumerDir);
  }
  console.log('Packed packages install and load successfully');
} finally {
  await rm(tempDir, { force: true, recursive: true });
}

async function run(command: string[], cwd: string): Promise<void> {
  const process = Bun.spawn(command, {
    cwd,
    env: { ...Bun.env, NO_UPDATE_NOTIFIER: '1' },
    stderr: 'inherit',
    stdout: 'inherit',
  });
  const exitCode = await process.exited;
  if (exitCode !== 0) {
    throw new Error(`${command.join(' ')} exited with code ${exitCode}`);
  }
}

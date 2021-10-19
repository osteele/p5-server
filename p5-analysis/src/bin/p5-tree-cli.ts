#!/usr/bin/env node
import { Command } from 'commander';
import fs from 'fs';
import path from 'path';
import tree from '../commands/tree';

export const program = new Command();

const pkg = JSON.parse(
  fs.readFileSync(path.join(__dirname, '../../package.json'), 'utf-8')
);
const appVersion = pkg.version;
program.version(appVersion);

program
  .description('Print the tree structure of a directory and its sketches')
  .argument('[DIRECTORY]', 'directory', '.')
  .option('-L, --level <LEVEL>', 'Descend only level directories deep.')
  .option('--descriptions', 'Print descriptions of sketches')
  .action(tree);

if (require.main === module) {
  program.parse(process.argv);
}

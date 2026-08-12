#!/usr/bin/env node
import { fileURLToPath } from 'node:url';
import { Command } from 'commander';
import fs from 'fs';
import path from 'path';
import tree from '../commands/tree.js';

export const program = new Command();

const filename = fileURLToPath(import.meta.url);
const dirname = path.dirname(filename);
const pkg = JSON.parse(
  fs.readFileSync(path.join(dirname, '../../package.json'), 'utf-8')
);
const appVersion = pkg.version;
program.version(appVersion);

program
  .description('Print the tree structure of a directory and its sketches')
  .argument('[DIRECTORY...]', 'directory', '.')
  .option('-L, --level <LEVEL>', 'Descend only level directories deep.')
  .option('--descriptions', 'Print descriptions of sketches')
  .option('--tabWidth <WIDTH>', 'Indentation width', '4')
  .action(tree);

if (process.argv[1] && fs.realpathSync(process.argv[1]) === filename) {
  program.parse(process.argv);
}

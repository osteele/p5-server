#!/usr/bin/env node
import { Command } from 'commander';
import fs from 'fs';
import path from 'path';
import checkCollisions from '../commands/check-library-collisions';
import {
  checkLibraryPaths,
  findMinimizedAlternatives,
  listLibraries,
} from '../commands/library-commands';
import { generateLibraryPage } from '../commands/library-docs';

const program = new Command();

const pkg = JSON.parse(
  fs.readFileSync(path.join(__dirname, '../../package.json'), 'utf-8')
);
const appVersion = pkg.version;
program.version(appVersion);

program
  .command('check-collisions')
  .description('Find libraries that define and are inferred from the same symbols')
  .action(checkCollisions);

program
  .command('find-minimized-alternatives')
  .description(
    'Find libraries whose import path is adjacent to an unused minimized path'
  )
  .action(findMinimizedAlternatives);

program
  .command('docs')
  .option('-o, --output <FILE>')
  .option('-t, --template <TEMPLATE>', 'Nunjucks template file')
  .description('Create markdown documentation of the libraries')
  .action(generateLibraryPage);

program
  .command('list')
  .description('Print the known libraries to stdout')
  .option('-v, --verbose')
  .action(listLibraries);

program
  .command('validate-import-paths')
  .description('Verify that the import paths exist')
  .action(checkLibraryPaths);

program.parse(process.argv);

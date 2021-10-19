#!/usr/bin/env node
import { Command } from 'commander';
import fs from 'fs';
import path from 'path';
import {
  describeLibrary,
  listLibraries,
  printLibraryProperty,
} from '../commands/library-commands';
import { generateLibraryPage } from '../commands/library-docs';
import { checkLibraries } from '../commands/library-validation';

export const program = new Command();

const pkg = JSON.parse(
  fs.readFileSync(path.join(__dirname, '../../package.json'), 'utf-8')
);
const appVersion = pkg.version;
program.version(appVersion);

// program
//   .command('check-collisions')
//   .description('Find libraries that define and are inferred from the same symbols')
//   .action(checkCollisions);

program
  .command('check')
  .description('Check library home pages and import paths')
  .action(checkLibraries);

// program
//   .command('find-minimized-alternatives')
//   .description(
//     'Find libraries whose import path is adjacent to an unused minimized path'
//   )
//   .action(findMinimizedImportPathAlternatives);

program
  .command('docs')
  .option('-o, --output <FILE>')
  .option('-t, --template <TEMPLATE>', 'Nunjucks template file')
  .description('Create markdown documentation of the libraries')
  .action(generateLibraryPage);

program
  .command('describe')
  .argument('<LIBRARY>')
  .description('Describe the library')
  .action(describeLibrary);

program
  .command('list')
  .description('Print the known libraries to stdout')
  .option('-v, --verbose')
  .action(listLibraries);

program
  .command('property')
  .argument('<LIBRARY>')
  .argument('<PROPERTY>')
  .option('--html')
  .description("Print the library's import path")
  .action(printLibraryProperty);

// program
//   .command('validate-import-paths')
//   .description('Verify that the import paths exist')
//   .action(checkLibraryImportPaths);

if (require.main === module) {
  program.parse(process.argv);
}

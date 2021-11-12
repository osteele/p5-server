#!/usr/bin/env node
import { Command } from 'commander';
import fs from 'fs';
import path from 'path';
import {
  describeLibrary,
  listLibraries,
  printLibraryProperty,
  updateDescriptions
} from '../commands/library-commands';
import { generateLibraryPage } from '../commands/library-docs';
import checkLibraryCollisions from '../commands/check-library-collisions';
import {
  checkLibraries,
  checkLibraryImportPaths
} from '../commands/library-validation';

export const program = new Command();

const pkg = JSON.parse(
  fs.readFileSync(path.join(__dirname, '../../package.json'), 'utf-8')
);
const appVersion = pkg.version;
program.version(appVersion);

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
  .option('--json')
  .argument('<LIBRARY>')
  .description('Describe the library')
  .action(describeLibrary);

program
  .command('list')
  .description('Print the known libraries to stdout')
  .option('--json')
  .option('-v, --verbose')
  .action(listLibraries);

program
  .command('property')
  .argument('<LIBRARY>')
  .argument('<PROPERTY>')
  .option('--html')
  .description("Print the library's import path")
  .action(printLibraryProperty);

const libraryCommands = program.command('check');

libraryCommands
  .command('all')
  .option('--parse-scripts')
  .description('Run all library checks')
  .action(checkLibraries);

libraryCommands
  .command('collisions')
  .description('Report libraries that define the same symbols')
  .action(checkLibraryCollisions);

libraryCommands
  .command('descriptions')
  .description('Compare local library descriptions to npm package descriptions')
  .action(updateDescriptions);

libraryCommands
  .command('import-paths')
  .description('Verify that the import paths exist')
  .action(checkLibraryImportPaths);

if (require.main === module) {
  program.parse(process.argv);
}

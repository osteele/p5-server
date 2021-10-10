#!/usr/bin/env node
import { Command } from 'commander';
import fs from 'fs';
import path from 'path';
import checkCollisions from '../commands/check-library-collisions';
import {
  findMinimizedAlternatives,
  listLibraries,
  checkLibraryPaths,
  generateLibraryPage,
} from '../commands/library-commands';

const program = new Command();

const pkg = JSON.parse(
  fs.readFileSync(path.join(__dirname, '..', '..', 'package.json'), 'utf-8')
);
const appVersion = pkg.version;
program.version(appVersion);

const libraries = program.command('libraries');

libraries.command('check-collisions').action(checkCollisions);
libraries.command('find-minimized-alternatives').action(findMinimizedAlternatives);
libraries.command('validate-import-paths').action(checkLibraryPaths);

libraries.command('generate').option('-o, --output <FILE>').action(generateLibraryPage);

libraries.command('list').option('-v, --verbose').action(listLibraries);

program.parse(process.argv);

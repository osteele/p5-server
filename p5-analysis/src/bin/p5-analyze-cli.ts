#!/usr/bin/env node
import { Command } from 'commander';
import fs from 'fs';
import path from 'path';

const program = new Command();

const pkg = JSON.parse(
  fs.readFileSync(path.join(__dirname, '../../package.json'), 'utf-8')
);
const appVersion = pkg.version;
program.version(appVersion);

program
  .command('libraries', 'Display information about the p5 libraries', {
    executableFile: 'p5-libraries',
  })
  .alias('library');

program.command('tree', 'Print the tree structure of a directory and its sketches', {
  executableFile: 'p5-tree',
});

program.parse(process.argv);

#!/usr/bin/env node
import { Command } from 'commander';
import fs from 'fs';
import path from 'path';
import convert from '../commands/convert';
import create from '../commands/create';
import serve from '../commands/serve';
import tree from '../commands/tree';
import updateNotifier from 'update-notifier';

const program = new Command();

const pkg = JSON.parse(fs.readFileSync(path.join(__dirname, '..', '..', 'package.json'), 'utf-8'));
const appVersion = pkg.version;
program.version(appVersion);

updateNotifier({ pkg }).notify();

program
  .command('create')
  .alias('c')
  .alias('generate')
  .alias('g')
  .description('Create a new p5.js sketch')
  .argument('[FILE]', 'the filename of the sketch', 'sketch.js')
  .option('--type <TYPE>', 'place the new files in a folder')
  .option('--force', 'force overwrite of existing files')
  .option('-o, --options [OPTIONS]', 'comma-separated list of options')
  .option('-t, --title [TITLE]', 'sketch title')
  .action(create);

program
  .command('convert')
  .argument('file')
  .description('Convert an HTML sketch to JavaScript-only or vice versa')
  .option('--to <type>', 'output type: html or javascript')
  .action(convert);

program.command('libraries', 'List the libraries', { hidden: true, executableFile: 'p5-analyze' });

program
  .command('serve')
  .argument('[DIRECTORY]', 'the directory to serve', '.')
  .description('Create a p5.js sketch')
  .alias('server')
  .alias('r')
  .alias('run')
  .alias('r')
  .option('-o, --open', 'Open the page in a browser')
  .option('-p, --port [PORT]', 'HTTP port to listen on', '3000')
  .action(serve);

program
  .command('tree')
  .argument('[DIRECTORY]', 'directory', '.')
  .option('-L, level <LEVEL>', 'Descend only level directories deep.')
  .action(tree);

program.parse(process.argv);

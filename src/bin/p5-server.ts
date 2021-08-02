#!/usr/bin/env node
import { Command } from 'commander';
import fs from 'fs';
import path from 'path';
import convert from '../commands/convert';
import create from '../commands/create';
import serve from '../commands/serve';

const program = new Command()

const appVersion = JSON.parse(fs.readFileSync(path.join(__dirname, '../../package.json'), 'utf-8')).version;
program.version(appVersion);

program
  .command('create [name]')
  .alias('c')
  .alias('generate')
  .alias('g')
  .description('Create a new p5.js sketch')
  .option('--no-html', 'only create a JavaScript file')
  .option('-f, --force', 'force overwite of existing files')
  .option('-o, --options [options]', 'comma-separated list of options')
  .option('-t, --title [title]', 'sketch title')
  .action(create);

program
  .command('convert')
  .argument('file')
  .description('Convert an HTML sketch to JavaScript-only or vice versa')
  .option('--to <type>', 'output type: html or javascript')
  .action(convert);

program
  .command('serve [directory]')
  .description('Create a p5.js sketch')
  .alias('server')
  .alias('r')
  .alias('run')
  .alias('r')
  .option('-o, --open', 'Open the page in a browser')
  .option('-p, --port [port]', 'HTTP port to listen on', '3000')
  .action(serve);

program.parse(process.argv);

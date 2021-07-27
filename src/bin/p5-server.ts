#!/usr/bin/env node
import { Command } from 'commander';
import fs from 'fs';
import path from 'path';
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
  .option('-f, --force', 'force overwite of existing files')
  .option('-t, --title [title]', 'sketch title')
  .action(create);

program
  .command('serve [directory]')
  .description('Create a p5.js sketch')
  .alias('s')
  .alias('run')
  .alias('r')
  .option('-o, --open', 'Open the page in a browser')
  .option('-p, --port [port]', 'HTTP port to listen on', '3000')
  .action(serve);

program.parse(process.argv);

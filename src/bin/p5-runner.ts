#!/usr/bin/env node
import { Command } from 'commander';
import create from '../commands/create';
import serve from '../commands/serve';

const program = new Command()

const appVersion = require('../../package').version;
program.version(appVersion);

program
  .command('create [name]')
  .alias('c')
  .description('Create a new p5.js sketch')
  .option('-f, --force', 'force overwite of existing files')
  .action(create);

program
  .command('serve [directory]')
  .description('Create a p5.js sketch')
  .alias('s')
  .alias('run')
  .alias('r')
  .option('-p, --port [port]', 'HTTP port on which to start the server', '3000')
  .action(serve);

program.parse(process.argv);

#!/usr/bin/env node
import { Command } from 'commander';
import createCommand from '../commands/create';

const program = new Command()

const appVersion = require('../../package').version;
program.version(appVersion);

program
  .command('create [name]')
  .alias('c')
  .description('Create a new p5.js sketch')
  .option('-f, --force', 'force overwite of existing files')
  .action(createCommand);

// program
// .command('serve')
// .alias('s')
// .option('-p, --port [port]', 'HTTP port on which to start the server', '3000')
// .action(req => server.run(req.port || 5555));

program.parse(process.argv);

#!/usr/bin/env node
import chalk from 'chalk';
import { Command } from 'commander';
import fs from 'fs';
import path from 'path';
import updateNotifier from 'update-notifier';
import build from '../commands/build';
import convert from '../commands/convert';
import create from '../commands/create';
import screenshot from '../commands/screenshot';
import serve from '../commands/serve';

const program = new Command();

const PROJECT_HOME = path.join(__dirname, '../../');
const P5_ANALYSIS_BIN = path.join(PROJECT_HOME, 'node_modules/.bin');

const pkg = JSON.parse(
  fs.readFileSync(path.join(PROJECT_HOME, 'package.json'), 'utf-8')
);
program.version(pkg.version);

updateNotifier({ pkg }).notify({
  isGlobal: true,
  message: `Update available ${chalk.dim('{currentVersion}')} ${chalk.reset(
    '→'
  )} ${chalk.green('{latestVersion}')}
  Run ${chalk.cyan('{updateCommand}')} to update
  Changes: ${chalk.blue('https://bit.ly/p5-server-changelog')}`
});

program
  .command('create')
  .description('Create a new p5.js sketch')
  .alias('c')
  .alias('generate')
  .alias('g')
  .argument('[FILE]', 'the filename of the sketch', 'sketch.js')
  .option('--type <TYPE>', 'place the new files in a folder')
  .option('--force', 'force overwrite of existing files')
  .option('--options [OPTIONS]', 'comma-separated list of template options')
  .option('-t, --title [TITLE]', 'sketch title')
  .action(create);

program
  .command('build')
  .description('Create a static site that presents the sketches')
  .alias('b')
  .argument('[SOURCE]', 'the source directory', '.')
  .option('-o, --output <OUTPUT>', 'the output directory', 'build')
  .option('--open', 'Open the index file in a browser')
  .option('--options [OPTIONS]', 'comma-separated list of template options')
  .option('-t, --theme <FILE>', 'template file', 'split')
  .option('-v, --verbose', 'verbose output')
  .option('--dry-run', 'dry run')
  .action(build);

program
  .command('convert')
  .description('Convert an HTML sketch to JavaScript-only or vice versa')
  .argument('FILE')
  .option('--to <type>', 'output type: script, html, folder')
  .action(convert);

program
  .command('screenshot')
  .argument('SKETCH_FILE')
  .option('-o, --output <OUTPUT>', 'the output file')
  .option('--browser <NAME>', 'safari | chrome | firefox | edge')
  .option('--canvas-size <DIMENSIONS>', 'canvas dimensions e.g. 100 or 100,200')
  .option('--frame-count <NUMBER>', 'the number of frames saved', '1')
  .option('--pixel-density <NUMBER>', 'e.g. 2, 0.5, or 1/2')
  .option('--skip-frames <COUNT>', 'omit the first COUNT frames')
  .action(screenshot);

program
  .command('serve')
  .argument('[DIRECTORY...]', 'the directory to serve', '.')
  .description('Start the web server')
  .alias('server')
  .alias('r')
  .alias('run')
  .alias('r')
  .option('-o, --open', 'Open the page in a browser')
  .option('-p, --port [PORT]', 'HTTP port to listen on', '3000')
  .option('-t, --theme [FILE]', 'template file')
  .option('--browser <NAME>', 'safari | chrome | firefox | edge (implies --open)')
  .option('--split', 'Use the split (directory + sketch) template')
  .option(
    '--console [FORMAT]',
    'Relay console messages and errors to sketch in the server console'
  )
  .action(serve);

program.command('analyze', 'Display information about a sketch', {
  executableFile: `${P5_ANALYSIS_BIN}/p5-analyze`
});

for (const command of ['library', 'libraries']) {
  program.command(
    command,
    'Print information about p5.js libraries known to p5-server',
    {
      executableFile: `${P5_ANALYSIS_BIN}/p5-libraries`
    }
  );
}

program.command('tree', 'Print the tree structure of a directory and its sketches', {
  executableFile: `${P5_ANALYSIS_BIN}/p5-tree`
});

program.parse(process.argv);

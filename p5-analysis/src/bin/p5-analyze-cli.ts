#!/usr/bin/env node
import { fileURLToPath } from 'node:url';
import { Command } from 'commander';
import fs from 'fs';
import nunjucks from 'nunjucks';
import path from 'path';
import { Sketch } from '../index.js';

export const program = new Command();

const filename = fileURLToPath(import.meta.url);
const dirname = path.dirname(filename);
const pkg = JSON.parse(
  fs.readFileSync(path.join(dirname, '../../package.json'), 'utf-8')
);
const appVersion = pkg.version;
program.version(appVersion);

program
  .command('libraries', 'Display information about the p5 libraries', {
    executableFile: 'p5-libraries',
  })
  .alias('library');

program.command(
  'tree',
  'Print the tree structure of a directory and its sketches',
  {
    executableFile: 'p5-tree',
  }
);

async function analyzeSketch(name: string, { json = false }) {
  const sketch = await Sketch.fromFile(name);
  if (json) {
    console.log(JSON.stringify(sketch, null, 2));
  } else {
    nunjucks.configure(path.join(dirname, '../commands/templates'), {
      autoescape: false,
    });
    const markdown = nunjucks
      .render('sketch.njk', { sketch })
      .replace(/\n{3,}/g, '\n\n')
      .replace(/\n+$/, '');
    console.log(markdown);
  }
}

const sketch = program.command('sketch');
sketch
  .command('analyze', 'Analyze a sketch')
  .description('Display information about a sketch')
  .option('--json', 'Output JSON')
  .argument('<SKETCH_FILE>', 'The sketch to analyze')
  .action(analyzeSketch);

if (process.argv[1] && fs.realpathSync(process.argv[1]) === filename) {
  program.parse(process.argv);
}

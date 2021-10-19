#!/usr/bin/env node
import { Command } from 'commander';
import fs from 'fs';
import path from 'path';
import { Sketch } from '..';
import nunjucks from 'nunjucks';

export const program = new Command();

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

async function analyzeSketch(name: string) {
  nunjucks.configure(`${__dirname}/../commands/templates`, { autoescape: false });
  const sketch = await Sketch.fromFile(name);
  const props = { ...sketch };
  const markdown = nunjucks
    .render('sketch.njk', { sketch: props })
    .replace(/\n{3,}/g, '\n\n')
    .replace(/\n+$/, '');
  console.log(markdown);
}

const sketch = program.command('sketch');
sketch
  .command('analyze', 'Analyze a sketch')
  .description('Display information about a sketch')
  .argument('<SKETCH_FILE>', 'The sketch to analyze')
  .action(analyzeSketch);

if (require.main === module) {
  program.parse(process.argv);
}

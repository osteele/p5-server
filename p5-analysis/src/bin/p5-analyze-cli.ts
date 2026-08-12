#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Command, Option } from 'commander';
import { formatSketchAnalysis } from '../commands/analyze-sketch.js';
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
  if (json) {
    const sketch = await Sketch.fromFile(name);
    console.log(JSON.stringify(sketch, null, 2));
    return;
  }
  process.stdout.write(await formatSketchAnalysis(name));
}

program
  .command('sketch')
  .description('Display information about a sketch')
  .addOption(
    new Option('--json', 'Output the legacy JSON representation').hideHelp()
  )
  .argument('<SKETCH_FILE>', 'The sketch to analyze')
  .action(analyzeSketch);

if (process.argv[1] && fs.realpathSync(process.argv[1]) === filename) {
  program.parse(process.argv);
}

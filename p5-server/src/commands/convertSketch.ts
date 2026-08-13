import fs from 'node:fs';
import path from 'node:path';
import { Sketch, type SketchStructureType } from 'p5-analysis';
import { assertError } from '../assertError.js';
import { die } from '../helpers.js';

const sketchTypes: Record<string, SketchStructureType | 'folder'> = {
  '^html$': 'html',
  '^(script|javascript|js)(-only)?$': 'script',
  '^folder$': 'folder',
};

export default async function convert(
  sketchPath: string,
  options: { discardHtml?: boolean; to: string }
) {
  if (!options.to) {
    die(`Missing required option: --to`);
  }
  const targetType: SketchStructureType | 'folder' =
    Object.entries(sketchTypes).find(([regex]) =>
      options.to.match(regex)
    )?.[1] ?? die(`Invalid option --to ${options.to}`);

  if (!fs.existsSync(sketchPath) && fs.existsSync(`${sketchPath}.html`))
    sketchPath += '.html';
  if (!fs.existsSync(sketchPath) && fs.existsSync(`${sketchPath}.js`))
    sketchPath += '.js';
  // TODO: if it's a script file that belongs to an HTML index in the same directory, warn or rename the index instead
  const sketch = await Sketch.fromFile(sketchPath);

  if (targetType === 'folder') {
    moveSketchToFolder(sketchPath, sketch);
    return;
  }

  if (sketch.structureType === targetType) {
    console.log('Nothing to do');
    return;
  }
  try {
    await sketch.convert({
      discardHtml: options.discardHtml,
      type: targetType,
    });
  } catch (err) {
    assertError(err);
    die(err.message);
  }
}

function moveSketchToFolder(sketchPath: string, sketch: Sketch): void {
  const parsed = path.parse(path.resolve(sketchPath));
  const targetDir = path.join(parsed.dir, parsed.name);
  const sketchDir = path.resolve(sketch.dir);
  const targetExisted = fs.existsSync(targetDir);
  if (targetExisted && !fs.statSync(targetDir).isDirectory()) {
    throw new Error(
      `Target already exists and is not a directory: ${targetDir}`
    );
  }
  if (targetExisted && fs.readdirSync(targetDir).length) {
    throw new Error(`Target directory is not empty: ${targetDir}`);
  }

  const moves = [...new Set(sketch.files)].map((file) => {
    const source = path.resolve(sketchDir, file);
    const relative = path.relative(sketchDir, source);
    if (
      relative === '..' ||
      relative.startsWith(`..${path.sep}`) ||
      path.isAbsolute(relative)
    ) {
      throw new Error(`Associated file escapes the sketch directory: ${file}`);
    }
    if (!fs.existsSync(source)) {
      throw new Error(`Associated file does not exist: ${source}`);
    }
    const targetName = file === sketch.htmlFile ? 'index.html' : relative;
    return { file, source, destination: path.join(targetDir, targetName) };
  });

  const destinations = new Set<string>();
  for (const { destination } of moves) {
    const key =
      process.platform === 'win32' ? destination.toLowerCase() : destination;
    if (destinations.has(key)) {
      throw new Error(`Multiple sketch files map to ${destination}`);
    }
    destinations.add(key);
    if (fs.existsSync(destination)) {
      throw new Error(`Target file already exists: ${destination}`);
    }
  }

  const completed: typeof moves = [];
  try {
    fs.mkdirSync(targetDir, { recursive: true });
    for (const move of moves) {
      fs.mkdirSync(path.dirname(move.destination), { recursive: true });
      fs.renameSync(move.source, move.destination);
      completed.push(move);
    }
  } catch (error) {
    for (const move of completed.reverse()) {
      fs.mkdirSync(path.dirname(move.source), { recursive: true });
      fs.renameSync(move.destination, move.source);
    }
    if (!targetExisted) fs.rmSync(targetDir, { force: true, recursive: true });
    throw error;
  }
  for (const { file } of moves) {
    console.log(`Moved ${file} into new directory ${targetDir}`);
  }
}

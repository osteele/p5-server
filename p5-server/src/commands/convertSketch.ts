import fs from 'node:fs';
import path from 'node:path';
import { Sketch, type SketchStructureType } from 'p5-analysis';
import { assertError } from '../assertError.js';
import {
  assertPortableRelativePath,
  die,
  portablePathKey,
} from '../helpers.js';

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
  const targetStat = lstatIfExists(targetDir);
  const targetExisted = targetStat !== null;
  if (targetStat?.isSymbolicLink()) {
    throw new Error(`Target directory is a symbolic link: ${targetDir}`);
  }
  if (targetStat && !targetStat.isDirectory()) {
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
    assertPathHasNoSymbolicLinks(sketchDir, source);
    const targetName = file === sketch.htmlFile ? 'index.html' : relative;
    return { file, source, destination: path.join(targetDir, targetName) };
  });

  const destinations = new Set<string>();
  for (const { destination } of moves) {
    const key = portablePathKey(destination);
    if (destinations.has(key)) {
      throw new Error(`Multiple sketch files map to ${destination}`);
    }
    assertPortableRelativePath(path.relative(targetDir, destination));
    destinations.add(key);
    if (fs.existsSync(destination)) {
      throw new Error(`Target file already exists: ${destination}`);
    }
  }
  for (let index = 0; index < moves.length; index++) {
    for (let otherIndex = index + 1; otherIndex < moves.length; otherIndex++) {
      const first = moves[index].destination;
      const second = moves[otherIndex].destination;
      if (isStrictAncestor(first, second) || isStrictAncestor(second, first)) {
        throw new Error(
          `Sketch files map to conflicting target paths: ${first} and ${second}`
        );
      }
    }
  }

  const createdDirs = new Set<string>();
  for (const { destination } of moves) {
    let dir = path.dirname(destination);
    while (dir !== targetDir && !fs.existsSync(dir)) {
      createdDirs.add(dir);
      dir = path.dirname(dir);
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
    const rollbackErrors: unknown[] = [];
    for (const move of completed.reverse()) {
      try {
        fs.mkdirSync(path.dirname(move.source), { recursive: true });
        fs.renameSync(move.destination, move.source);
      } catch (rollbackError) {
        rollbackErrors.push(rollbackError);
      }
    }
    if (rollbackErrors.length) {
      throw new AggregateError(
        [error, ...rollbackErrors],
        `Could not restore every sketch file; recovery files retained in ${targetDir}`
      );
    }
    if (!targetExisted) {
      try {
        fs.rmSync(targetDir, { force: true, recursive: true });
      } catch (cleanupError) {
        throw new AggregateError(
          [error, cleanupError],
          `Could not remove the failed conversion target: ${targetDir}`
        );
      }
    } else {
      const cleanupErrors: unknown[] = [];
      for (const dir of [...createdDirs].sort((a, b) => b.length - a.length)) {
        try {
          fs.rmdirSync(dir);
        } catch (cleanupError) {
          if ((cleanupError as NodeJS.ErrnoException).code !== 'ENOENT') {
            cleanupErrors.push(cleanupError);
          }
        }
      }
      if (cleanupErrors.length) {
        throw new AggregateError(
          [error, ...cleanupErrors],
          `Could not restore the empty target directory: ${targetDir}`
        );
      }
    }
    throw error;
  }
  for (const { file } of moves) {
    console.log(`Moved ${file} into new directory ${targetDir}`);
  }
}

function isStrictAncestor(parent: string, child: string): boolean {
  const relative = path.relative(
    portablePathKey(parent),
    portablePathKey(child)
  );
  return (
    relative !== '' &&
    relative !== '..' &&
    !relative.startsWith(`..${path.sep}`) &&
    !path.isAbsolute(relative)
  );
}

function lstatIfExists(filepath: string): fs.Stats | null {
  try {
    return fs.lstatSync(filepath);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return null;
    throw error;
  }
}

function assertPathHasNoSymbolicLinks(root: string, filepath: string): void {
  if (fs.lstatSync(root).isSymbolicLink()) {
    throw new Error(`Associated file path contains a symbolic link: ${root}`);
  }
  const relative = path.relative(root, filepath);
  let current = root;
  for (const component of relative.split(path.sep).filter(Boolean)) {
    current = path.join(current, component);
    const stat = lstatIfExists(current);
    if (!stat) break;
    if (stat.isSymbolicLink()) {
      throw new Error(
        `Associated file path contains a symbolic link: ${current}`
      );
    }
  }
}

import { Sketch, SketchStructureType } from 'p5-analysis';
import { assertError, die } from '../utils';
import fs from 'fs';
import path from 'path';

const sketchTypes: Record<string, SketchStructureType | 'folder'> = {
  '^html$': 'html',
  '^(script|javascript|js)(-only)?$': 'script',
  '^folder$': 'folder'
};

export default async function convert(sketchPath: string, options: { to: string }) {
  if (!options.to) {
    die(`Missing required option: --to`);
  }
  const targetType: SketchStructureType | 'folder' =
    Object.entries(sketchTypes).find(([regex]) => options.to.match(regex))?.[1] ??
    die(`Invalid option --to ${options.to}`);

  if (!fs.existsSync(sketchPath) && fs.existsSync(sketchPath + '.html'))
    sketchPath += '.html';
  if (!fs.existsSync(sketchPath) && fs.existsSync(sketchPath + '.js'))
    sketchPath += '.js';
  // TODO: if it's a script file that belongs to an HTML index in the same directory, warn or rename the index instead
  const sketch = await Sketch.fromFile(sketchPath);

  if (targetType === 'folder') {
    const targetDir = sketchPath.replace(/\.(html?|js)/i, '');
    fs.mkdirSync(targetDir, { recursive: true });
    sketch.files.forEach(file => {
      const targetName = file === sketch.htmlFile ? 'index.html' : file;
      fs.renameSync(path.join(sketch.dir, file), path.join(targetDir, targetName));
      console.log(`Moved ${file} into new directory ${targetDir}`);
    });
    return;
  }

  if (sketch.structureType === targetType) {
    console.log('Nothing to do');
    return;
  }
  try {
    await sketch.convert({ type: targetType });
  } catch (err) {
    assertError(err);
    die(err.message);
  }
}

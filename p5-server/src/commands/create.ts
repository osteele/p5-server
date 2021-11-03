import { Sketch } from 'p5-analysis';
import { assertError, die, stringToOptions } from '../utils';
import fs from 'fs';
import path from 'path';

type Options = { force: boolean; title: string; options: string; type?: 'folder' };

export default async function create(file: string, options: Options) {
  let scriptFile: string | undefined;
  if (options.type && !options.type.match(/folder|file/)) {
    die('create: type must be "folder" or "file"');
  }
  if (options.type === 'folder' || !/\.(js|html?)$/i.test(file)) {
    try {
      fs.mkdirSync(file);
    } catch (err) {
      assertError(err);
      if (err.code !== 'EEXIST') {
        throw err;
      }
      if (!fs.statSync(file).isDirectory()) {
        die(`The ${file} folder already exists and is not a directory`);
      }
      // TODO: ignore .DS_Store and Thumbs.db
      if (fs.readdirSync(file).length && !options.force) {
        die(`The ${file} folder already exists and is not empty`);
      }
    }
    file = path.join(file, 'index.html');
  } else if (/\.html?$/i.test(file)) {
    scriptFile = path.basename(file).replace(/\.html?$/i, '.js');
  }

  const templateOptions = stringToOptions(options.options);
  const sketchOptions = { scriptFile, ...options };
  const sketch = Sketch.create(file, sketchOptions);
  let files: string[] = [];
  try {
    files = await sketch.generate(options.force, templateOptions);
  } catch (err) {
    assertError(err);
    if (err.code === 'EEXIST') {
      die(`${file} already exists. Try again with --force.`);
    }
    console.error(Object.entries(err));
    throw err;
  }
  files.forEach(file => console.log(`Created ${file}`));
}

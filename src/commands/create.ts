import fs from 'fs';
import path from 'path';
import ejs from 'ejs';
import { die } from './utils';

const templateDir = path.join(path.dirname(__filename), '../../templates');

export default function create(name: string = 'sketch', options = { force: false }) {
  try {
    fs.mkdirSync(name);
  } catch (e) {
    if (e.code !== 'EEXIST') {
      throw e;
    }
    if (!fs.statSync(name).isDirectory()) {
      die(`${name} already exists and is not a directory`);
    }
    if (fs.readdirSync(name).length && !options.force) {
      die(`${name} already exists and is not empty`);
    }
  }

  const data = { title: name.replace(/_/g, ' ') };
  copyTemplate('index.html', name, data);
  copyTemplate('sketch.js', name, data);
}

function copyTemplate(base: string, dstDir: string = '.', data: ejs.Data) {
  const filename = path.join(templateDir, base);
  const template = ejs.compile(fs.readFileSync(filename, 'utf-8'), { filename });
  fs.writeFileSync(path.join(dstDir, base), template(data));
}

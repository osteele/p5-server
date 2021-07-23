import fs from 'fs';
import path from 'path';
import ejs from 'ejs';

const templateDir = path.join(__dirname, './templates');

export class DirectoryExistsError extends Error {
  constructor(msg: string) {
    super(msg);
    Object.setPrototypeOf(this, DirectoryExistsError.prototype);
  }
}

export class Project {
  dirName: string;

  constructor(name: string) {
    this.dirName = name;
  }

  generate(force = false) {
    const name = this.dirName;
    try {
      fs.mkdirSync(name);
    } catch (e) {
      if (e.code !== 'EEXIST') {
        throw e;
      }
      if (!fs.statSync(name).isDirectory()) {
        throw new DirectoryExistsError(`${name} already exists and is not a directory`);
      }
      if (fs.readdirSync(name).length && !force) {
        throw new DirectoryExistsError(`${name} already exists and is not empty`);
      }
    }

    const data = {
      title: name.replace(/_/g, ' '),
      sketchPath: './sketch.js',
    };
    copyTemplate('index.html', name, data);
    copyTemplate('sketch.js', name, data);
  }
}

function copyTemplate(base: string, dstDir: string = '.', data: ejs.Data) {
  // TODO: DRY w/ createTemplateHtml
  const filename = path.join(templateDir, base);
  const template = ejs.compile(fs.readFileSync(filename, 'utf-8'), { filename });
  fs.writeFileSync(path.join(dstDir, base), template(data));
}

export function createTemplateHtml(sketchPath: string) {
  // TODO: DRY w/ copyTemplate
  const filename = path.join(templateDir, 'index.html');
  const template = ejs.compile(fs.readFileSync(filename, 'utf-8'), { filename });
  // TODO: derive project title from root when sketch path is sketch.js
  const title = sketchPath.replace(/_/g, ' ').replace(/\.js$/, '');
  return template({ title, sketchPath });
}

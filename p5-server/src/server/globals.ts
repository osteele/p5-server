import path from 'path';
import pug from 'pug';

export const templateDir = path.join(__dirname, './templates');

export const sourceViewTemplate = pug.compileFile(
  path.join(templateDir, 'source-view.pug')
);

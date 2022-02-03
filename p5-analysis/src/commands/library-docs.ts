import fs from 'fs';
import { Library } from '..';
import nunjucks from 'nunjucks';
import { die } from './helpers';
import { configureNunjucks } from './library-commands';

type Options = {
  output?: string;
  template?: string;
};

export function generateLibraryPage({ output, template: templateFile }: Options) {
  configureNunjucks();
  const context = {
    categories: Library.categories,
    stringify: JSON.stringify,
  };
  const markdown = (
    templateFile?.endsWith('.njk')
      ? nunjucks.renderString(fs.readFileSync(templateFile, 'utf-8'), context)
      : templateFile
        ? die(`Unsupported template file type: ${templateFile}`)
        : nunjucks.render('libraries.njk', context)
  )
    .replace(/\n{3,}/g, '\n\n')
    .trim();
  if (output) {
    fs.writeFileSync(output, markdown + '\n');
  } else {
    console.log(markdown);
  }
}

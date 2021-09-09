import fs from 'fs';
import marked from 'marked';
import path from 'path';
import pug from 'pug';
import { Sketch } from 'p5-analysis';
import { pathComponentsForBreadcrumbs } from '../utils';
import { templateDir } from './globals';

export const defaultDirectoryExclusions = [
  '.*',
  '*~',
  'node_modules',
  'package.json',
  'package-lock.json'
];

export async function createDirectoryListing(
  dir: string,
  breadcrumbPath?: string,
  options: Partial<{
    staticMode: boolean;
    templateName: string;
    templateOptions: Record<string, string | boolean>;
  }> = {}
): Promise<string> {
  const { staticMode, templateName, templateOptions } = {
    staticMode: false,
    templateName: 'directory.pug',
    templateOptions: {},
    ...options
  };
  const { sketches, unassociatedFiles } = await Sketch.analyzeDirectory(dir, {
    exclusions: defaultDirectoryExclusions
  });
  sketches.sort((a, b) => a.name.localeCompare(b.name));
  unassociatedFiles.sort((a, b) => a.toLowerCase().localeCompare(b.toLowerCase()));

  const readmeName = unassociatedFiles.find(s => s.toLowerCase() === 'readme.md');
  const readme = readmeName
    ? {
        name: readmeName,
        html: marked(fs.readFileSync(path.join(dir, readmeName), 'utf-8')),
        url: staticMode ? `${readmeName}.html` : readmeName
      }
    : null;

  const directories = unassociatedFiles.filter(s =>
    fs.statSync(path.join(dir, s)).isDirectory()
  );
  const files = unassociatedFiles.filter(
    s => !directories.includes(s) && s !== readmeName
  );
  const title = dir === './' ? 'P5 Server' : path.basename(dir);

  const templatePath = ['', '.pug']
    .map(ext => path.join(templateDir, templateName + ext))
    .find(p => fs.existsSync(p));
  if (!templatePath) {
    throw new Error(`Could not find template ${templateName}`);
  }
  const pathComponents = pathComponentsForBreadcrumbs(breadcrumbPath || dir);
  return pug.renderFile(templatePath, {
    ...templateOptions,

    directories,
    files,
    pathComponents,
    readme,
    sketches,
    title,

    // functions
    directory_index,
    path_to,
    path_to_src_view,
    markdown,

    // pug options
    cache: true
  });

  function directory_index(name: string) {
    return staticMode ? `${name}/index.html` : `${name}/`;
  }

  function path_to(file: string, sk: Sketch) {
    return path.relative(dir, path.join(sk.dir, file));
  }

  function path_to_src_view(file: string, sk: Sketch) {
    let p = path_to(file, sk);
    if (p.match(/.*\.(html?|js)$/i)) {
      p += '?fmt=view';
    }
    return p;
  }

  function markdown(s: string) {
    return s ? marked(s) : '';
  }
}

import fs from 'fs';
import marked from 'marked';
import path from 'path';
import pug from 'pug';
import { Sketch } from 'p5-analysis';
import { pathComponentsForBreadcrumbs } from '../utils';
import { templateDir } from './globals';

export async function createDirectoryListing(
  dir: string,
  breadcrumbPath?: string,
  templateName: string = 'directory.pug'
): Promise<string> {
  const { sketches, unassociatedFiles } = await Sketch.analyzeDirectory(dir);
  sketches.sort((a, b) => a.name.localeCompare(b.name));
  unassociatedFiles.sort((a, b) => a.toLowerCase().localeCompare(b.toLowerCase()));

  const readmeName = unassociatedFiles.find(s => s.toLowerCase() === 'readme.md');
  const readme = readmeName
    ? {
        name: readmeName,
        html: marked(fs.readFileSync(path.join(dir, readmeName), 'utf-8'))
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
    directories,
    files,
    pathComponents,
    readme,
    sketches,
    title,

    // functions
    path_to,
    path_to_src_view,

    // pug options
    cache: true
  });

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
}

import fs from 'fs';
import marked from 'marked';
import path from 'path';
import pug from 'pug';
import { Sketch } from 'p5-analysis';
import { pathComponentsForBreadcrumbs } from '../utils';
import { templateDir } from './globals';

const directoryListingTmpl = pug.compileFile(path.join(templateDir, 'directory.pug'));

export async function createDirectoryListing(dir: string, breadcrumbPath?: string): Promise<string> {
  const { sketches, unassociatedFiles } = await Sketch.analyzeDirectory(dir);
  unassociatedFiles.sort((a, b) => a.toLowerCase().localeCompare(b.toLowerCase()));

  const readmeName = unassociatedFiles.find(s => s.toLowerCase() === 'readme.md');
  const readme = readmeName && {
    name: readmeName,
    html: marked(fs.readFileSync(path.join(dir, readmeName), 'utf-8'))
  };

  const directories = unassociatedFiles.filter(s => fs.statSync(path.join(dir, s)).isDirectory());
  const files = unassociatedFiles.filter(s => !directories.includes(s) && s !== readmeName);
  const title = dir === './' ? 'P5 Server' : path.basename(dir);

  const pathComponents = pathComponentsForBreadcrumbs(breadcrumbPath || dir);
  return directoryListingTmpl({
    pathComponents,
    title,
    directories,
    files,
    sketches,
    readme,
    // functions
    path_to,
    path_to_src_view
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

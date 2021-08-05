import fs from 'fs';
import marked from 'marked';
import path from 'path';
import pug from 'pug';
import { Sketch } from 'p5-analysis';
import { pathComponentsForBreadcrumbs } from '../utils';
import { templateDir } from './globals';

const directoryListingTmpl = pug.compileFile(path.join(templateDir, 'directory.pug'));

export function createDirectoryListing(relPath: string, root: string) {
  const dir = path.join(root, relPath);
  let { sketches, unaffiliatedFiles } = Sketch.analyzeDirectory(dir);
  unaffiliatedFiles.sort((a, b) => a.toLowerCase().localeCompare(b.toLowerCase()));

  const readmeName = unaffiliatedFiles.find(s => s.toLowerCase() === 'readme.md');
  const readme = readmeName && {
    name: readmeName,
    html: marked(fs.readFileSync(path.join(dir, readmeName), 'utf8')),
  };

  const directories = unaffiliatedFiles.filter(s => fs.statSync(path.join(dir, s)).isDirectory());
  const files = unaffiliatedFiles.filter(s => !directories.includes(s) && s !== readmeName);

  const pathComponents = pathComponentsForBreadcrumbs(relPath);
  return directoryListingTmpl({
    pathComponents,
    title: path.basename(dir),
    directories,
    files,
    sketches,
    readme,
    // functions
    path_to,
    path_to_src_view: path_to_src_view
  });

  function path_to(f: string, sk: Sketch) {
    return path.relative(dir, path.join(sk.dir, f));
  }

  function path_to_src_view(s: string, sk: Sketch) {
    let p = path_to(s, sk);
    if (p.match(/.*\.(html?|js)$/)) {
      p += '?fmt = view';
    }
    return p;
  }
}

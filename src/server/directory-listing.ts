import fs from 'fs';
import marked from 'marked';
import path from 'path';
import pug from 'pug';
import { Sketch } from '../models/Sketch';
import { pathComponentsForBreadcrumbs } from '../utils';
import { templateDir } from './globals';

const directoryListingExclusions = ['.*', '*~', 'node_modules', 'package.json', 'package-lock.json'];
const directoryListingTmpl = pug.compileFile(path.join(templateDir, 'directory.pug'));

export function createDirectoryListing(relPath: string, root: string) {
  const absPath = path.join(root, relPath);
  let { projects, nonProjectFiles: files } = Sketch.findProjects(absPath, { exclusions: directoryListingExclusions });
  files.sort((a, b) => a.toLowerCase().localeCompare(b.toLowerCase()));

  const readmeName = files.find(s => s.toLowerCase() === 'readme.md');
  const readme = readmeName && {
    name: readmeName,
    html: marked(fs.readFileSync(path.join(absPath, readmeName), 'utf8')),
  };

  const directories = files.filter(s => fs.statSync(path.join(absPath, s)).isDirectory());
  files = files.filter(s => !directories.includes(s) && s !== readmeName);

  const pathComponents = pathComponentsForBreadcrumbs(relPath);
  return directoryListingTmpl({
    pathComponents,
    title: path.basename(absPath),
    directories,
    files,
    projects,
    readme,
    srcViewHref: (s: string) => s.match(/.*\.(html?|js)$/) ? `${s}?fmt=view` : s,
  });
}

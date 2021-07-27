import { Response } from 'express-serve-static-core';
import fs from 'fs';
import marked from 'marked';
import path from 'path';
import pug from 'pug';
import { findProjects } from '../models/Sketch';
import { pathComponentsForBreadcrumbs } from '../utils';
import { templateDir } from './globals';
import { injectLiveReloadScript } from './liveReload';

const directoryListingExclusions = ['.*', '*~', 'node_modules', 'package.json', 'package-lock.json'];
const directoryListingTmpl = pug.compileFile(path.join(templateDir, 'directory.pug'));

export function createDirectoryListing(relPath: string, root: string) {
  const absPath = path.join(root, relPath);
  let { projects, files } = findProjects(absPath, { excludeDirs: directoryListingExclusions });
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

export function sendDirectoryListing(relPath: string, root: string, res: Response<any, any>) {
  const absPath = path.join(root, relPath);
  let fileData: string;
  let singleProject = false;
  try {
    fileData = fs.readFileSync(path.join(absPath, 'index.html'), 'utf-8');
    singleProject = true;
  } catch (e) {
    if (e.code !== 'ENOENT') {
      throw e;
    }
    fileData = createDirectoryListing(relPath, root);
  }

  if (singleProject && !relPath.endsWith('/')) {
    res.redirect(relPath + '/');
    return;
  }

  // Note:  this injects the reload script into the generated index pages too.
  // This is helpful when the directory contents change.
  res.send(injectLiveReloadScript(fileData));
}

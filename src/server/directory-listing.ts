import { Response } from 'express-serve-static-core';
import fs from 'fs';
import marked from 'marked';
import minimatch from 'minimatch';
import path from 'path';
import pug from 'pug';
import { createSketchHtml, findProjects } from '../models/project';
import { pathComponentsForBreadcrumbs } from '../utils';
import { injectLiveReloadScript } from './liveReload';

const directoryListingExclusions = ['node_modules', 'package.json', 'package-lock.json'];
export const templateDir = path.join(__dirname, './templates');
const directoryListingTmpl = pug.compileFile(path.join(templateDir, 'directory.pug'));

export function createDirectoryListing(relDirPath: string, dirPath: string) {
  let { projects, files } = findProjects(dirPath);
  files = files.filter(s => !s.startsWith('.')
    && !directoryListingExclusions.some(exclusion => minimatch(s, exclusion))
  );
  files.sort((a, b) => a.toLowerCase().localeCompare(b.toLowerCase()));

  const readmeName = files.find(s => s.toLowerCase() === 'readme.md');
  const readme = readmeName && {
    name: readmeName,
    html: marked(fs.readFileSync(path.join(dirPath, readmeName), 'utf8')),
  };

  const directories = files.filter(s => fs.statSync(path.join(dirPath, s)).isDirectory());
  files = files.filter(s => !directories.includes(s) && s !== readmeName);

  const pathComponents = pathComponentsForBreadcrumbs(relDirPath);
  return directoryListingTmpl({
    pathComponents,
    title: path.basename(dirPath),
    directories,
    files,
    projects,
    readme,
    srcViewHref: (s: string) => s + '?fmt=view',
  });
}

export function sendDirectoryList(relDirPath: string, dirPath: string, res: Response<any, any>, sketchPath?: string | null) {
  let fileData: string;
  let singleProject = false;
  try {
    fileData = fs.readFileSync(path.join(dirPath, 'index.html'), 'utf-8');
    singleProject = true;
  } catch (e) {
    if (e.code !== 'ENOENT') {
      throw e;
    }
    fileData = sketchPath
      ? createSketchHtml(sketchPath)
      : createDirectoryListing(relDirPath, dirPath);
  }

  if (singleProject && !relDirPath.endsWith('/')) {
    res.redirect(relDirPath + '/');
    return;
  }

  // Note:  this injects the reload script into the generated index pages too.
  // This is helpful when the directory contents change.
  res.send(injectLiveReloadScript(fileData));
}

import ejs from 'ejs';
import express from 'express';
import fs from 'fs';
import marked from 'marked';
import minimatch from 'minimatch';
import path from 'path';
import { createSketchHtml, findProjects, isSketchJs } from '../models/project';
import { createLiveReloadServer, injectLiveReloadScript } from './liveReload';

const directoryListingExclusions = ['node_modules', 'package.json', 'package-lock.json'];
const templateDir = path.join(__dirname, './templates');

type ServerOptions = {
  port: number;
  root: string;
  sketchPath: string | null;
};

let serverOptions: ServerOptions;

const app = express();

app.get('/', (_req, res) => {
  let fileData: string;
  try {
    fileData = fs.readFileSync(`${serverOptions.root}/index.html`, 'utf-8');
  } catch (e) {
    if (e.code !== 'ENOENT') {
      throw e;
    }
    fileData = serverOptions.sketchPath
      ? createSketchHtml(serverOptions.sketchPath)
      : createDirectoryListing(serverOptions.root);
  }
  // Note that this injects the reload script into the generated index pages
  // too. This is helpful when the directory contents change.
  res.send(injectLiveReloadScript(fileData));
});

app.get('/*.html', (req, res, next) => {
  if (req.headers['accept']?.match(/\btext\/html\b/)) {
    const content = fs.readFileSync(path.join(serverOptions.root, req.path), 'utf-8');
    res.send(injectLiveReloadScript(content));
    return;
  }
  next();
});

app.get('/*.js', (req, res, next) => {
  if (req.headers['accept']?.match(/\btext\/html\b/)) {
    if (isSketchJs(path.join(serverOptions.root, req.path))) {
      const content = createSketchHtml(path.basename(req.path));
      res.send(injectLiveReloadScript(content));
      return;
    }
  }
  next();
});

app.get('/*.md', (req, res) => {
  if (req.headers['accept']?.match(/\btext\/html\b/)) {
    const fileData = fs.readFileSync(path.join(serverOptions.root, req.path), 'utf-8');
    res.send(marked(fileData));
  }
});

function createDirectoryListing(dirPath: string) {
  let { projects, files } = findProjects(dirPath);
  files = files.filter(s => !s.startsWith('.')
    && !directoryListingExclusions.some(exclusion => minimatch(s, exclusion))
  );
  files.sort((a, b) => a.toLowerCase().localeCompare(b.toLowerCase()));

  let readmeName = files.find(s => s.toLowerCase() === 'readme.md');
  let readme = readmeName ? marked(fs.readFileSync(path.join(dirPath, readmeName), 'utf8')) : null;

  const filename = path.join(templateDir, 'directory.html');
  const template = ejs.compile(fs.readFileSync(filename, 'utf-8'), { filename });
  return template({ title: path.basename(dirPath), files, projects, readme, readmeName });
}

function run(options: ServerOptions) {
  serverOptions = options;

  // do this at startup, in order to provide errors and diagnostics right away
  createDirectoryListing(options.root);

  app.use('/', express.static(options.root));

  // TODO: scan for another port when default port is in use and was not
  // explicitly specified
  app.listen(options.port, () => {
    console.log(`Serving ${options.root} at http://localhost:${options.port}`);
  });
  createLiveReloadServer(options.root);
}

export default {
  app,
  run
};

import express from 'express';
import { Response } from 'express-serve-static-core';
import fs from 'fs';
import marked from 'marked';
import minimatch from 'minimatch';
import nunjucks from 'nunjucks';
import path from 'path';
import { createSketchHtml, findProjects, isSketchJs, JavascriptSyntaxError, parseOrReadJs } from '../models/project';
import { createLiveReloadServer, injectLiveReloadScript } from './liveReload';

const directoryListingExclusions = ['node_modules', 'package.json', 'package-lock.json'];
const templateDir = path.join(__dirname, './templates');

type ServerOptions = {
  port: number;
  root: string;
  sketchPath: string | null;
};

let serverOptions: ServerOptions;

const jsTemplateEnv = new nunjucks.Environment(null, { autoescape: false });
jsTemplateEnv.addFilter('quote', JSON.stringify);

const app = express();

app.get('/', (req, res) => {
  sendDirectoryList(req.path, res);
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
  try {
    parseOrReadJs(path.join(serverOptions.root, req.path));
  } catch (e) {
    if (e instanceof JavascriptSyntaxError) {
      const template = fs.readFileSync(path.join(templateDir, 'report-syntax-error.js.njk'), 'utf8');
      return res.send(jsTemplateEnv.renderString(template, {
        fileName: path.basename(e.fileName), // TODO: relative to referer
        message: e.message,
      }));
    }
    throw e;
  }
  next();
});

app.get('/*.md', (req, res) => {
  if (req.headers['accept']?.match(/\btext\/html\b/)) {
    const fileData = fs.readFileSync(path.join(serverOptions.root, req.path), 'utf-8');
    res.send(marked(fileData));
  }
});

app.get('*', (req, res, next) => {
  if (req.headers['accept']?.match(/\btext\/html\b/)) {
    const filePath = path.join(serverOptions.root, req.path);
    if (fs.statSync(filePath).isDirectory()) {
      sendDirectoryList(req.path, res);
      return;
    }
  }
  next();
});

function createDirectoryListing(dirPath: string) {
  let { projects, files } = findProjects(dirPath);
  files = files.filter(s => !s.startsWith('.')
    && !directoryListingExclusions.some(exclusion => minimatch(s, exclusion))
  );
  files.sort((a, b) => a.toLowerCase().localeCompare(b.toLowerCase()));

  const readmeName = files.find(s => s.toLowerCase() === 'readme.md');
  const readmeHtml = readmeName ? marked(fs.readFileSync(path.join(dirPath, readmeName), 'utf8')) : null;

  const directories = files.filter(s => fs.statSync(path.join(dirPath, s)).isDirectory());
  files = files.filter(s => !directories.includes(s) && s !== readmeName);

  const templatePath = path.join(templateDir, 'directory.html');
  return nunjucks.render(templatePath, {
    title: path.basename(dirPath),
    directories,
    files,
    projects,
    readme: readmeName && { name: readmeName, html: readmeHtml },
  });
}

function sendDirectoryList(relDirPath: string, res: Response<any, Record<string, any>, number>) {
  const dirPath = path.join(serverOptions.root, relDirPath);
  let fileData: string;
  let singleProject = false;
  try {
    fileData = fs.readFileSync(`${dirPath}/index.html`, 'utf-8');
    singleProject = true;
  } catch (e) {
    if (e.code !== 'ENOENT') {
      throw e;
    }
    fileData = serverOptions.sketchPath
      ? createSketchHtml(serverOptions.sketchPath)
      : createDirectoryListing(dirPath);
  }

  if (singleProject && !relDirPath.endsWith('/')) {
    res.redirect(relDirPath + '/');
    return;
  }

  // Note:  this injects the reload script into the generated index pages too.
  // This is helpful when the directory contents change.
  res.send(injectLiveReloadScript(fileData));
}

function run(options: ServerOptions, callback: (url: string) => void) {
  serverOptions = options;

  // do this at startup for effect only, in order to provide errors and
  // diagnostics immediately
  createDirectoryListing(options.root);

  app.use('/', express.static(options.root));

  // TODO: scan for another port when the default port is in use and was not
  // explicitly specified
  app.listen(options.port, () => {
    const serverUrl = `http://localhost:${options.port}`;
    console.log(`Serving ${options.root} at ${serverUrl}`);
    callback && callback(serverUrl);
  });
  createLiveReloadServer(options.root);
}

export default {
  app,
  run
};

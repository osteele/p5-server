import express from 'express';
import fs from 'fs';
import marked from 'marked';
import nunjucks from 'nunjucks';
import path from 'path';
import { checkedParseScript, JavascriptSyntaxError } from '../models/script-analysis';
import { createSketchHtml, isSketchJs } from '../models/Project';
import { createDirectoryListing, sendDirectoryListing } from './directory-listing';
import { templateDir } from './globals';
import { createLiveReloadServer, injectLiveReloadScript } from './liveReload';

export type ServerOptions = {
  port: number;
  root: string;
  sketchPath: string | null;
};

const jsTemplateEnv = new nunjucks.Environment(null, { autoescape: false });
jsTemplateEnv.addFilter('quote', JSON.stringify);

const app = express();

app.get('/', (req, res) => {
  const serverOptions: ServerOptions = req.app.locals as ServerOptions;
  if (serverOptions.sketchPath) {
    const filePath = path.join(serverOptions.root, serverOptions.sketchPath);
    if (isSketchJs(filePath)) {
      const content = createSketchHtml(filePath);
      res.send(injectLiveReloadScript(content));
    } else if (filePath.match(/.*\.html?$/)) {
      const content = fs.readFileSync(filePath, 'utf8');
      res.send(injectLiveReloadScript(content));
    } else {
      res.sendFile(serverOptions.sketchPath, { root: serverOptions.root });
    }
  } else {
    sendDirectoryListing(req.path, serverOptions.root, res);
  }
});

app.get('/__p5_server_assets/:path', (req, res) => {
  const filePath = path.join(__dirname, 'static/assets', req.params.path);
  res.sendFile(filePath);
});

app.get('/*.html?', (req, res, next) => {
  const serverOptions: ServerOptions = req.app.locals as ServerOptions;
  const filePath = path.join(serverOptions.root, req.path);
  try {
    if (req.query.fmt === 'view') {
      res.set('Content-Type', 'text/plain')
      res.sendFile(filePath);
      return;
    }
    if (req.headers['accept']?.match(/\btext\/html\b/)) {
      const content = fs.readFileSync(filePath, 'utf-8');
      res.send(injectLiveReloadScript(content));
      return;
    }
  } catch (e) {
    if (e.code !== 'ENOENT') {
      throw e;
    }
  }
  next();
});

app.get('/*.js', (req, res, next) => {
  const serverOptions: ServerOptions = req.app.locals as ServerOptions;
  const filePath = path.join(serverOptions.root, req.path);
  if (req.headers['accept']?.match(/\btext\/html\b/) && req.query.fmt !== 'view') {
    if (fs.existsSync(filePath) && isSketchJs(filePath)) {
      const content = createSketchHtml(filePath);
      res.send(injectLiveReloadScript(content));
      return;
    }
  }
  try {
    checkedParseScript(filePath);
  } catch (e) {
    if (e instanceof JavascriptSyntaxError) {
      const template = fs.readFileSync(path.join(templateDir, 'report-syntax-error.js.njk'), 'utf8');
      return res.send(jsTemplateEnv.renderString(template, {
        fileName: path.basename(e.fileName!), // TODO: relative to referer
        message: e.message,
      }));
    }
    if (e.code !== 'ENOENT') {
      throw e;
    }
  }
  next();
});

app.get('/*.md', (req, res, next) => {
  const serverOptions: ServerOptions = req.app.locals as ServerOptions;
  if (req.headers['accept']?.match(/\btext\/html\b/)) {
    const filePath = path.join(serverOptions.root, req.path);
    if (!fs.existsSync(filePath)) {
      return next();
    }
    const fileData = fs.readFileSync(filePath, 'utf-8');
    res.send(marked(fileData));
  }
  return next();
});

app.get('*', (req, res, next) => {
  const serverOptions: ServerOptions = req.app.locals as ServerOptions;
  if (req.headers['accept']?.match(/\btext\/html\b/)) {
    const filePath = path.join(serverOptions.root, req.path);
    if (!fs.existsSync(filePath)) {
      return next();
    }
    if (fs.statSync(filePath).isDirectory()) {
      sendDirectoryListing(req.path, serverOptions.root, res);
      return;
    }
  }
  next();
});

export function run(options: ServerOptions, callback?: (url: string) => void) {
  Object.assign(app.locals, options);

  // do this at startup, for effect only, in order to provide errors and
  // diagnostics immediately
  createDirectoryListing('', options.root);

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

// This is misleading. There can be only one server.
// TODO: warn on multiple instantiation
export class Server {
  options: ServerOptions;
  constructor(options: ServerOptions) {
    this.options = options;
  }

  start(callback?: (url: string) => void) {
    run(this.options, callback);
  }

  stop() {
    // TODO
  }
}

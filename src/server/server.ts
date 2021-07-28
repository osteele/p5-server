import express from 'express';
import { Request, Response } from 'express-serve-static-core';
import fs from 'fs';
import marked from 'marked';
import nunjucks from 'nunjucks';
import path from 'path';
import { checkedParseScript, JavascriptSyntaxError } from '../models/script-analysis';
import { Sketch, createSketchHtml } from '../models/Sketch';
import { createDirectoryListing } from './directory-listing';
import { templateDir } from './globals';
import { createLiveReloadServer, injectLiveReloadScript } from './liveReload';
import WebSocket = require('ws');
import http = require('http');

export type ServerConfig = {
  root: string;
  port?: number;
  sketchPath: string | null;
};

export type ServerOptions = Partial<ServerConfig>;

const jsTemplateEnv = new nunjucks.Environment(null, { autoescape: false });
jsTemplateEnv.addFilter('quote', JSON.stringify);

const app = express();

app.get('/', (req, res) => {
  const serverOptions: ServerConfig = req.app.locals as ServerConfig;
  if (serverOptions.sketchPath) {
    const filePath = path.join(serverOptions.root, serverOptions.sketchPath);
    if (Sketch.isSketchJs(filePath)) {
      const content = createSketchHtml(filePath);
      res.send(injectLiveReloadScript(content, req.app.locals.liveReloadServer));
    } else if (filePath.match(/.*\.html?$/)) {
      const content = fs.readFileSync(filePath, 'utf8');
      res.send(injectLiveReloadScript(content, req.app.locals.liveReloadServer));
    } else {
      res.sendFile(serverOptions.sketchPath, { root: serverOptions.root });
    }
  } else {
    sendDirectoryListing(req, res);
  }
});

app.get('/__p5_server_assets/:path', (req, res) => {
  const filePath = path.join(__dirname, 'static/assets', req.params.path);
  res.sendFile(filePath);
});

app.get('/*.html?', (req, res, next) => {
  const serverOptions: ServerConfig = req.app.locals as ServerConfig;
  const filePath = path.join(serverOptions.root, req.path);
  try {
    if (req.query.fmt === 'view') {
      res.set('Content-Type', 'text/plain')
      res.sendFile(filePath);
      return;
    }
    if (req.headers['accept']?.match(/\btext\/html\b/)) {
      const content = fs.readFileSync(filePath, 'utf-8');
      res.send(injectLiveReloadScript(content, req.app.locals.liveReloadServer));
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
  const serverOptions: ServerConfig = req.app.locals as ServerConfig;
  const filePath = path.join(serverOptions.root, req.path);
  if (req.headers['accept']?.match(/\btext\/html\b/) && req.query.fmt !== 'view') {
    if (fs.existsSync(filePath) && Sketch.isSketchJs(filePath)) {
      const content = createSketchHtml(filePath);
      res.send(injectLiveReloadScript(content, req.app.locals.liveReloadServer));
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
  const serverOptions: ServerConfig = req.app.locals as ServerConfig;
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
  const serverOptions: ServerConfig = req.app.locals as ServerConfig;
  if (req.headers['accept']?.match(/\btext\/html\b/)) {
    const filePath = path.join(serverOptions.root, req.path);
    if (!fs.existsSync(filePath)) {
      return next();
    }
    if (fs.statSync(filePath).isDirectory()) {
      sendDirectoryListing(req, res);
      return;
    }
  }
  next();
});

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function sendDirectoryListing(req: Request<any, any, any, any, any>, res: Response<any, any>) {
  const serverOptions: ServerConfig = req.app.locals as ServerConfig;
  const relPath = req.path;
  let fileData: string;
  let singleProject = false;
  try {
    const absPath = path.join(serverOptions.root, relPath);
    fileData = fs.readFileSync(path.join(absPath, 'index.html'), 'utf-8');
    singleProject = true;
  } catch (e) {
    if (e.code !== 'ENOENT') {
      throw e;
    }
    fileData = createDirectoryListing(relPath, serverOptions.root);
  }

  if (singleProject && !relPath.endsWith('/')) {
    res.redirect(relPath + '/');
    return;
  }

  // Note:  this injects the reload script into the generated index pages too.
  // This is helpful when the directory contents change.
  res.send(injectLiveReloadScript(fileData, req.app.locals.liveReloadServer));
}

async function startServer(options: ServerOptions) {
  const derivedOptions: ServerConfig = { root: '.', sketchPath: null, ...options };
  Object.assign(app.locals, options);
  let port = options.port || 3000;

  app.use('/', express.static(derivedOptions.root));

  // do this at startup, for effect only, in order to provide errors and
  // diagnostics immediately
  createDirectoryListing('', derivedOptions.root);

  let server: http.Server;
  for (let p = port; p < port + 10; p++) {
    try {
      server = await listenSync(p);
      break;
    } catch (e) {
      if (e.code !== 'EADDRINUSE') {
        throw e;
      }
      console.warn('Address in use, retrying...');
    }
  }
  server ||= await listenSync();

  const address = server.address();
  if (!address || typeof address === 'string') {
    throw new Error('Failed to start server 1');
  }
  try {
    const liveReloadServer = createLiveReloadServer(derivedOptions.root);
    app.locals.liveReloadServer = liveReloadServer;
    const url = `http://localhost:${address.port}`;
    return { server, liveReloadServer, url };
  } catch (e) {
    server.close();
    throw e;
  }

  function listenSync(port?: number) {
    return new Promise<http.Server>((resolve, reject) => {
      const server = app.listen(port);
      server.on('error', e => {
        clearTimeout(timeoutTimer);
        clearInterval(intervalTimer);
        reject(e);
      });
      const timeoutTimer = setTimeout(() => {
        const address = server.address();
        clearInterval(intervalTimer);
        if (address) {
          resolve(server);
        } else {
          reject(new Error('Failed to start server'));
        }
      }, 1000);
      const intervalTimer = setInterval(() => {
        const address = server.address();
        if (address) {
          clearInterval(intervalTimer);
          clearTimeout(timeoutTimer);
          resolve(server);
        }
      }, 50);
    });
  }
}

// This is misleading. There can be only one server.
// TODO: warn on multiple instances
export class Server {
  options: ServerOptions;
  server: http.Server | null = null;
  protected liveReloadServer: WebSocket.Server | null = null;
  url?: string;

  constructor(options: ServerOptions) {
    this.options = options;
  }

  static async start(options: ServerOptions) {
    return new Server(options).start();
  }

  async start() {
    const { server, liveReloadServer, url } = await startServer(this.options);
    this.server = server;
    this.liveReloadServer = liveReloadServer;
    this.url = url;
    return this;
  }

  stop() {
    this.server?.close();
    this.liveReloadServer?.close();
    this.server = null;
    this.liveReloadServer = null;
    this.url = undefined;
  }
}

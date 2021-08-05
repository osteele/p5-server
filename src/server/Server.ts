import express from 'express';
import { Request, Response } from 'express-serve-static-core';
import fs from 'fs';
import marked from 'marked';
import nunjucks from 'nunjucks';
import { Script, Sketch } from 'p5-analysis';
import path from 'path';
import { createDirectoryListing } from './directory-listing';
import { templateDir } from './globals';
import { createLiveReloadServer, injectLiveReloadScript } from './liveReload';
import WebSocket = require('ws');
import http = require('http');

// eslint-disable-next-line @typescript-eslint/no-namespace
export namespace Server {
  export type Options = {
    root: string;
    port?: number;
    scanPorts: boolean;
    sketchPath: string | null;
  };
}

const serverOptionDefaults = { root: '.', scanPorts: true, sketchPath: null }

const jsTemplateEnv = new nunjucks.Environment(null, { autoescape: false });
jsTemplateEnv.addFilter('quote', JSON.stringify);

const app = express();

app.get('/', (req, res) => {
  const serverOptions: Server.Options = req.app.locals as Server.Options;
  if (serverOptions.sketchPath) {
    const filePath = path.join(serverOptions.root, serverOptions.sketchPath);
    if (Sketch.isSketchScriptFile(filePath)) {
      const content = Sketch.fromFile(filePath).getHtmlContent();
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

app.get('/__p5_server_static/:path(*)', (req, res) => {
  const filePath = path.join(__dirname, 'static', req.params.path);
  res.sendFile(filePath);
});

app.get('/*.html?', (req, res, next) => {
  const serverOptions: Server.Options = req.app.locals as Server.Options;
  const filePath = path.join(serverOptions.root, req.path);
  try {
    if (req.query.fmt === 'view') {
      res.set('Content-Type', 'text/plain');
      res.sendFile(req.path, { root: serverOptions.root });
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

// A request for the HTML of a JavaScript file returns HTML that includes the sketch.
// A request for the HTML of a main sketch js file redirects to the sketch's index page.
app.get('/*.js', (req, res, next) => {
  const serverOptions: Server.Options = req.app.locals as Server.Options;
  const filePath = path.join(serverOptions.root, req.path);
  if (req.headers['accept']?.match(/\btext\/html\b/) && req.query.fmt !== 'view' && Sketch.isSketchScriptFile(filePath)) {
    const { sketches } = Sketch.analyzeDirectory(path.dirname(filePath));
    const sketch = sketches.find(sketch => sketch.files.includes(path.basename(filePath)));
    if (sketch) {
      if (sketch.htmlFile) {
        res.redirect(path.dirname(req.path).replace(/\/$/, '') + '/' + sketch.htmlFile);
        return;
      } else {
        const content = sketch.getHtmlContent();
        res.send(injectLiveReloadScript(content, req.app.locals.liveReloadServer));
        return;
      }
    }
  }
  try {
    const errs = Script.fromFile(filePath).getErrors();
    if (errs.length) {
      const template = fs.readFileSync(path.join(templateDir, 'report-syntax-error.js.njk'), 'utf8');
      return res.send(jsTemplateEnv.renderString(template, {
        fileName: path.basename(errs[0].fileName!), // TODO: relative to referer
        message: errs[0].message,
      }));
    }
  } catch (e) {
    if (e.code !== 'ENOENT') {
      throw e;
    }
  }
  next();
});

app.get('/*.md', (req, res, next) => {
  if (req.headers['accept']?.match(/\btext\/html\b/)) {
    const serverOptions: Server.Options = req.app.locals as Server.Options;
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
  if (req.headers['accept']?.match(/\btext\/html\b/)) {
    const serverOptions: Server.Options = req.app.locals as Server.Options;
    const filePath = path.join(serverOptions.root, req.path);
    if (fs.existsSync(filePath) && fs.statSync(filePath).isDirectory()) {
      sendDirectoryListing(req, res);
      return;
    }
  }
  next();
});

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function sendDirectoryListing(req: Request<any, any, any, any, any>, res: Response<any, any>) {
  const serverOptions: Server.Options = req.app.locals as Server.Options;
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

async function startServer(options: Partial<Server.Options>) {
  const derivedOptions: Server.Options = { ...serverOptionDefaults, ...options };
  Object.assign(app.locals, options);
  let port = options.port || 3000;

  app.use('/', express.static(derivedOptions.root));

  // For effect only, in order to provide errors and diagnostics before waiting
  // for a browser request
  createDirectoryListing('/', derivedOptions.root);

  let server: http.Server;
  for (let p = port; p < port + 10; p++) {
    try {
      server = await listenSync(p);
      break;
    } catch (e) {
      if (e.code !== 'EADDRINUSE' || !derivedOptions.scanPorts) {
        throw e;
      }
      console.log(`Port ${p} is in use, retrying...`);
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

// This API is misleading. There can be only one server instance.
// TODO: warn on multiple instances, or, wrap the code above in a function
export class Server {
  public server: http.Server | null = null;
  public url?: string;
  protected liveReloadServer: WebSocket.Server | null = null;
  private readonly options: Partial<Server.Options>;

  constructor(options: Partial<Server.Options>) {
    this.options = options;
  }

  static async start(options: Partial<Server.Options>) {
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

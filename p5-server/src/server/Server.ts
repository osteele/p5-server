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
    port: number;
    scanPorts: boolean;
  };
}

type Config = Server.Options & {
  sketchFile?: string;
};

const defaultOptions = { root: '.', port: 3000, scanPorts: true, sketchPath: null };

const jsTemplateEnv = new nunjucks.Environment(null, { autoescape: false });
jsTemplateEnv.addFilter('quote', JSON.stringify);

const app = express();

app.get('/', (req, res) => {
  const config = req.app.locals as Config;
  const file = config.sketchFile;
  if (file) {
    if (Sketch.isSketchScriptFile(file)) {
      const sketch = Sketch.fromFile(file);
      res.send(injectLiveReloadScript(sketch.getHtmlContent(), req.app.locals.liveReloadServer));
    } else {
      res.sendFile(file);
    }
  } else {
    sendDirectoryListing(req, res);
  }
});

app.get('/__p5_server_static/:path(*)', (req, res) => {
  const file = path.join(__dirname, 'static', req.params.path);
  res.sendFile(file);
});

app.get('/*.html?', (req, res, next) => {
  const config = req.app.locals as Config;
  const file = path.join(config.root, req.path);
  try {
    if (req.query.fmt === 'view') {
      res.set('Content-Type', 'text/plain');
      res.sendFile(req.path, { root: config.root });
      return;
    }
    if (req.headers['accept']?.match(/\btext\/html\b/)) {
      const content = fs.readFileSync(file, 'utf-8');
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
  const config = req.app.locals as Config;
  const file = path.join(config.root, req.path);
  if (req.headers['accept']?.match(/\btext\/html\b/) && req.query.fmt !== 'view' && Sketch.isSketchScriptFile(file)) {
    const { sketches } = Sketch.analyzeDirectory(path.dirname(file));
    const sketch = sketches.find(sketch => sketch.files.includes(path.basename(file)));
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
    const errs = Script.fromFile(file).getErrors();
    if (errs.length) {
      const template = fs.readFileSync(path.join(templateDir, 'report-syntax-error.js.njk'), 'utf8');
      return res.send(
        jsTemplateEnv.renderString(template, {
          fileName: path.basename(errs[0].fileName!), // TODO: relative to referer
          message: errs[0].message
        })
      );
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
    const config = req.app.locals as Config;
    const file = path.join(config.root, req.path);
    if (!fs.existsSync(file)) {
      return next();
    }
    const fileData = fs.readFileSync(file, 'utf-8');
    res.send(marked(fileData));
  }
  return next();
});

app.get('*', (req, res, next) => {
  if (req.headers['accept']?.match(/\btext\/html\b/)) {
    const config = req.app.locals as Config;
    const file = path.join(config.root, req.path);
    if (fs.existsSync(file) && fs.statSync(file).isDirectory()) {
      sendDirectoryListing(req, res);
      return;
    }
  }
  next();
});

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function sendDirectoryListing(req: Request<any, any, any, any, any>, res: Response<any, any>) {
  const config = req.app.locals as Config;
  const relPath = req.path;
  let fileData: string;
  let isSingleSketch = false;
  try {
    const absPath = path.join(config.root, relPath);
    fileData = fs.readFileSync(path.join(absPath, 'index.html'), 'utf-8');
    isSingleSketch = true;
  } catch (e) {
    if (e.code !== 'ENOENT') {
      throw e;
    }
    fileData = createDirectoryListing(relPath, config.root);
  }

  if (isSingleSketch && !relPath.endsWith('/')) {
    res.redirect(relPath + '/');
    return;
  }

  // Note:  this injects the reload script into the generated index pages too.
  // This is helpful when the directory contents change.
  res.send(injectLiveReloadScript(fileData, req.app.locals.liveReloadServer));
}

async function startServer(options: Partial<Server.Options>) {
  const config: Config = { ...defaultOptions, ...options };
  if (!fs.statSync(config.root).isDirectory()) {
    config.sketchFile = config.root;
    config.root = path.dirname(config.root);
  }
  const { root, port } = config;
  Object.assign(app.locals, config);

  app.use('/', express.static(root));

  // For effect only. This provide errors and diagnostics before waiting for a
  // browser request.
  if (fs.statSync(root).isDirectory()) {
    createDirectoryListing('/', root);
  }

  let server: http.Server | null = null;
  for (let p = port; p < port + 10; p++) {
    try {
      server = await listenSync(p);
      break;
    } catch (e) {
      if (e.code !== 'EADDRINUSE' || !config.scanPorts) {
        throw e;
      }
      console.log(`Port ${p} is in use, retrying...`);
    }
  }
  if (!server) {
    server = await listenSync();
  }

  const address = server.address();
  if (!address || typeof address === 'string') {
    throw new Error('Failed to start server 1');
  }
  try {
    const liveReloadServer = createLiveReloadServer(root);
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
/** Server is a web server with live reload, sketch-aware directory listings,
 * and library inference for JavaScript-only sketches.
 */
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

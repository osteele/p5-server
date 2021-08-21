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
import { closeSync, listenSync } from './http-server-sync';
import { EventEmitter } from 'stream';

// eslint-disable-next-line @typescript-eslint/no-namespace
export namespace Server {
  export type MountPointOption = string | { filePath: string; name?: string; urlPath?: string };

  export type Options = Partial<{
    /** The http port number. Defaults to 3000. */
    port: number;
    /** If true, then if the specified port number is not available, find another port. Defaults to true. */
    scanPorts: boolean;
    /** If true, relay console events from the sketch to an emitter on the server. */
    relayConsoleMessages: boolean;
    /** The base directory. Defaults to the current working directory. */
    root: string | null;
    /** A list of base directories. If this is present, it overrides the root option. */
    mountPoints: MountPointOption[];
  }>;
}

type ServerConfig = Required<Server.Options>;

type RouterConfig = Server.Options & {
  root: string;
  sketchFile?: string;
};

type MountPoint = { filePath: string; urlPath: string; name?: string };

const defaultServerOptions = {
  port: 3000,
  relayConsoleMessages: false,
  logConsoleEvents: false,
  scanPorts: true
};

const jsTemplateEnv = new nunjucks.Environment(null, { autoescape: false });
jsTemplateEnv.addFilter('quote', JSON.stringify);

function createRouter(config: RouterConfig): express.Router {
  const router = express.Router();

  router.get('/', async (req, res) => {
    const file = config.sketchFile;
    if (file) {
      if (await Sketch.isSketchScriptFile(file)) {
        const sketch = await Sketch.fromFile(file);
        sendHtml(req, res, await sketch.getHtmlContent());
      } else {
        res.sendFile(file);
      }
    } else {
      await sendDirectoryListing(config.root, req, res);
    }
  });

  router.get('/*.html?', (req, res, next) => {
    const file = path.join(config.root, req.path);
    try {
      if (req.query.fmt === 'view') {
        res.set('Content-Type', 'text/plain');
        res.sendFile(req.path, { root: config.root });
        return;
      }
      if (req.headers['accept']?.match(/\btext\/html\b/)) {
        sendHtml(req, res, fs.readFileSync(file, 'utf-8'));
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
  router.get('/*.js', async (req, res, next) => {
    const file = path.join(config.root, req.path);
    if (
      req.headers['accept']?.match(/\btext\/html\b/) &&
      req.query.fmt !== 'view' &&
      (await Sketch.isSketchScriptFile(file))
    ) {
      const { sketches } = await Sketch.analyzeDirectory(path.dirname(file));
      const sketch = sketches.find(sketch => sketch.files.includes(path.basename(file)));
      if (sketch) {
        sendHtml(req, res, await sketch.getHtmlContent());
        return;
      }
    }
    try {
      const errs = Script.fromFile(file).getErrors();
      if (errs.length) {
        const template = fs.readFileSync(path.join(templateDir, 'report-syntax-error.js.njk'), 'utf8');
        return res.send(
          jsTemplateEnv.renderString(template, {
            fileName: path.basename(file), // TODO: relative to referer
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

  router.get('/*.md', (req, res, next) => {
    if (req.headers['accept']?.match(/\btext\/html\b/)) {
      const file = path.join(config.root, req.path);
      if (!fs.existsSync(file)) {
        return next();
      }
      const fileData = fs.readFileSync(file, 'utf-8');
      res.send(marked(fileData));
    }
    return next();
  });

  router.get('*', async (req, res, next) => {
    if (req.headers['accept']?.match(/\btext\/html\b/)) {
      const file = path.join(config.root, req.path);
      if (fs.existsSync(file) && fs.statSync(file).isDirectory()) {
        await sendDirectoryListing(config.root, req, res);
        return;
      }
    }
    next();
  });

  return router;

  function sendHtml<T>(req: Request<unknown, unknown, unknown, unknown, T>, res: Response<string, T>, html: string) {
    html = injectLiveReloadScript(html, req.app.locals.liveReloadServer);
    if (config.relayConsoleMessages) {
      html = html.replace(/(?=<\/head>)/, '<script src="/__p5_server_static/console-relay.js"></script>');
    }
    res.send(html);
  }
}

async function sendDirectoryListing<T>(
  root: string,
  req: Request<unknown, unknown, unknown, unknown, T>,
  res: Response<string, T>
) {
  const reqPath = req.path;
  let fileData: string;
  const absPath = path.join(root, reqPath);
  // read the directory contents
  const indexFile = fs.readdirSync(absPath).find(file => /^index\.html?$/i.test(file));
  if (indexFile) {
    // This is needed for linked files to work.
    if (!reqPath.endsWith('/')) {
      res.redirect(reqPath + '/');
      return;
    }
    fileData = fs.readFileSync(path.join(absPath, indexFile), 'utf-8');
  } else {
    fileData = await createDirectoryListing(absPath, reqPath);
  }

  // Note: This injects the reload script into the generated index pages too.
  // This assures that the index page reloads when the directory contents
  // change.
  res.send(injectLiveReloadScript(fileData, req.app.locals.liveReloadServer));
}

function consoleRelayRouter(consoleEmitter: EventEmitter): express.Router {
  const router = express.Router();

  router.post('/__p5_server_console', express.json(), (req, res) => {
    const { method, args } = req.body;
    consoleEmitter.emit('console', { method, args, url: req.headers['referer'] });
    res.sendStatus(200);
  });

  router.post('/__p5_server_error', express.json(), (req, res) => {
    const data = { ...req.body, url: req.headers['referer'] };
    consoleEmitter.emit('error', data);
    res.sendStatus(200);
  });

  return router;
}

async function startServer(config: ServerConfig, consoleEmitter: EventEmitter) {
  const mountPoints = config.mountPoints as MountPoint[];
  const app = express();
  app.use('/__p5_server_static', express.static(path.join(__dirname, 'static')));
  app.use(consoleRelayRouter(consoleEmitter));
  for (const { filePath, urlPath } of mountPoints) {
    let root = filePath;
    let sketchFile: string | undefined;
    if (!fs.statSync(root).isDirectory()) {
      sketchFile = root;
      root = path.dirname(root);
    }
    const routerConfig: RouterConfig = { ...config, root, sketchFile };
    app.use(urlPath, createRouter(routerConfig));
    app.use('/', express.static(root));
  }

  // For effect only. This provide errors and diagnostics before waiting for a
  // browser request.
  if (fs.statSync(mountPoints[0].filePath).isDirectory()) {
    createDirectoryListing(mountPoints[0].filePath, mountPoints[0].urlPath);
  }

  let server: http.Server | null = null;
  const port = config.port;
  for (let p = port; p < port + 10; p++) {
    try {
      server = await listenSync(app, p);
      break;
    } catch (e) {
      if (e.code !== 'EADDRINUSE' || !config.scanPorts) {
        throw e;
      }
      console.log(`Port ${p} is in use, retrying...`);
    }
  }
  if (!server) {
    server = await listenSync(app);
  }

  const address = server.address();
  if (!address || typeof address === 'string') {
    throw new Error('Failed to start the server');
  }
  try {
    const liveReloadServer = createLiveReloadServer(mountPoints.map(mount => mount.filePath));
    app.locals.liveReloadServer = liveReloadServer;
    const url = `http://localhost:${address.port}`;
    return { server, liveReloadServer, url };
  } catch (e) {
    server.close();
    throw e;
  }
}

/** Server is a web server with live reload, sketch-aware directory listings,
 * and library inference for JavaScript-only sketches.
 */
export class Server {
  public server: http.Server | null = null;
  public url?: string;
  private readonly options: ServerConfig;
  private liveReloadServer: WebSocket.Server | null = null;
  private readonly sketchEmitter = new EventEmitter();
  public readonly onSketchEvent = this.sketchEmitter.on.bind(this.sketchEmitter);

  constructor(options: Partial<Server.Options> = {}) {
    const mountPoints =
      options.mountPoints && options.mountPoints.length > 0
        ? Server.normalizeMountPoints(options.mountPoints)
        : [{ filePath: options.root || '.', urlPath: '/' }];
    this.options = { ...defaultServerOptions, root: null, ...options, mountPoints };
  }

  /** Create and start the server. Returns the instance. */
  public static async start(options: Partial<Server.Options> = {}) {
    return new Server(options).start();
  }

  public async start() {
    const { server, liveReloadServer, url } = await startServer(this.options, this.sketchEmitter);
    this.server = server;
    this.liveReloadServer = liveReloadServer;
    this.url = url;
    return this;
  }

  public async stop() {
    if (this.server) {
      await closeSync(this.server);
    }
    this.server = null;
    this.liveReloadServer?.close();
    this.liveReloadServer = null;
    this.url = undefined;
  }

  private static normalizeMountPoints(mountPoints: Server.MountPointOption[]): MountPoint[] {
    const pts = mountPoints
      .map(mount => (typeof mount === 'string' ? { filePath: mount } : mount))
      .map(mount => ({ urlPath: '/' + (mount.name || path.basename(mount.filePath)), ...mount }));
    return pts;
  }
}

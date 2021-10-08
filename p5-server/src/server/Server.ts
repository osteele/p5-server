import express from 'express';
import { Request, Response } from 'express-serve-static-core';
import fs from 'fs';
import { readdir, readFile } from 'fs/promises';
import { Script, Sketch } from 'p5-analysis';
import path from 'path';
import pug from 'pug';
import { EventEmitter } from 'stream';
import { addScriptToHtmlHead } from '../utils';
import {
  attachBrowserScriptRelay,
  BrowserScriptRelay,
  injectScriptEventRelayScript,
} from './browserScriptEventRelay';
import {
  createDirectoryListing,
  defaultDirectoryExclusions,
} from './createDirectoryListing';
import { promiseClose, promiseListen } from './httpServerUtils';
import {
  createLiveReloadServer,
  injectLiveReloadScript,
  LiveReloadServer,
} from './liveReload';
import {
  createSyntaxErrorJsReporter,
  markdownToHtmlPage,
  sourceViewTemplate,
  templateDir,
} from './templates';
import http = require('http');

// eslint-disable-next-line @typescript-eslint/no-namespace
export namespace Server {
  export type Options = Partial<{
    /** The http port number. Defaults to 3000. */
    port: number;

    /** If true, then if the specified port number is not available, find another port. Defaults to true. */
    scanPorts: boolean;

    /** The base directory. Defaults to the current working directory. */
    root: string | null;

    /** A list of base directories and optional URL path prefixes. If this is
     * present, it is used instead of the root option. */
    mountPoints: MountPointOption[];

    /** If true, relay console events from the sketch to an emitter on the server. */
    relayConsoleMessages: boolean;

    /** Inject the live reload websocket listener into HTML pages. */
    liveServer: boolean;

    /** Sketches send screenshot data to this handler. */
    screenshot: Partial<{
      canvasDimensions: { width: number; height: number };
      frameCount: number;
      imageType: 'png' | 'jpeg';
      pixelDensity: number;
      skipFrames: number;
      onFrameData: (data: {
        data: Buffer;
        frameNumber: number;
        imageType: string;
      }) => void | Promise<void>;
    }> | null;

    theme?: string;
  }>;

  export type MountPointOption =
    | string
    | { filePath: string; name?: string; urlPath?: string };
}

type ServerConfig = Required<Server.Options>;

type RouterConfig = Server.Options & {
  root: string;
  sketchFile?: string;
};

type MountPoint = { filePath: string; urlPath: string; name?: string };

const defaultServerOptions = {
  liveServer: true,
  logConsoleEvents: false,
  port: 3000,
  relayConsoleMessages: false,
  scanPorts: true,
  screenshot: null,
  theme: 'directory',
};

function createRouter(config: RouterConfig): express.Router {
  const router = express.Router();

  router.get('/', async (req, res) => {
    const sketchFile = config.sketchFile;
    const file = path.join(config.root, decodeURIComponent(req.path));

    if (sketchFile) {
      if (await Sketch.isSketchScriptFile(sketchFile)) {
        const sketch = await Sketch.fromFile(sketchFile);
        sendHtml(req, res, await sketch.getHtmlContent());
      } else {
        sendHtml(req, res, await readFile(sketchFile, 'utf-8'));
      }
    } else if (config.screenshot) {
      const { sketches } = fs.statSync(file).isDirectory()
        ? await Sketch.analyzeDirectory(file, {
            exclusions: defaultDirectoryExclusions,
          })
        : { sketches: [] };
      if (sketches.length !== 1)
        throw new Error(`Expected exactly one sketch in ${file}`);
      const [sketch] = sketches;
      const html = sketch.htmlFile
        ? await readFile(sketch.htmlFilePath!, 'utf-8')
        : await sketch.getHtmlContent();
      sendHtml(req, res, html);
    } else {
      await sendDirectoryListing(config, req, res);
    }
  });

  router.post(
    '/__p5_server/screenshot',
    express.json({ limit: '50mb' }),
    async (req, res) => {
      const { dataURL } = req.body;
      const m = dataURL.match(/^data:image\/(.+?);base64,(.*)$/);
      if (!m || !config.screenshot?.onFrameData) return res.sendStatus(200);
      await config.screenshot.onFrameData({
        imageType: m[1],
        data: Buffer.from(m[2], 'base64'),
        frameNumber: req.body.frameNumber,
      });
      res.sendStatus(200);
    }
  );

  router.get('/*.html?', (req, res, next) => {
    const file = path.join(config.root, decodeURIComponent(req.path));
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
    const filepath = path.join(config.root, decodeURIComponent(req.path));

    // bare-javascript sketch; not view source
    if (
      req.headers['accept']?.match(/\btext\/html\b/) &&
      req.query.fmt !== 'view' &&
      (await Sketch.isSketchScriptFile(filepath))
    ) {
      const { sketches } = await Sketch.analyzeDirectory(path.dirname(filepath), {
        exclusions: defaultDirectoryExclusions,
      });
      const sketch = sketches.find(sketch =>
        sketch.files.includes(path.basename(filepath))
      );
      if (sketch) {
        return sendHtml(req, res, await sketch.getHtmlContent());
      }
    }

    // view source
    if (req.headers['accept']?.match(/\btext\/html\b/) && req.query.fmt === 'view') {
      const source = await readFile(filepath, 'utf-8');
      const title = req.path.replace(/^\//, '');
      const html = sourceViewTemplate({ source, title });
      res.set('Content-Type', 'text/html');
      return res.send(html);
    }

    try {
      const errs = Script.fromFile(filepath).getErrors();
      if (errs.length) {
        res.set('Content-Type', 'text/html');
        return res.send(createSyntaxErrorJsReporter(errs, filepath));
      }
    } catch (e) {
      if (e.code === 'ENOENT') {
        return next();
      } else {
        throw e;
      }
    }

    next();
  });

  router.get('/*.md', (req, res, next) => {
    if (req.headers['accept']?.match(/\btext\/html\b/)) {
      const file = path.join(config.root, decodeURIComponent(req.path));
      if (!fs.existsSync(file)) {
        return next();
      }
      const data = fs.readFileSync(file, 'utf-8');
      res.set('Content-Type', 'text/html');
      return res.send(markdownToHtmlPage(data));
    }
    return next();
  });

  router.get('*', (req, res, next) => {
    if (req.headers['accept']?.match(/\btext\/html\b/)) {
      const file = path.join(config.root, decodeURIComponent(req.path));
      if (fs.existsSync(file) && fs.statSync(file).isDirectory()) {
        return sendDirectoryListing(config, req, res);
      }
    }
    next();
  });

  return router;

  function sendHtml<T>(
    req: Request<unknown, unknown, unknown, Record<string, unknown>, T>,
    res: Response<string, T>,
    html: string
  ) {
    html = injectLiveReloadScript(html, req.app.locals.liveReloadServer);
    if (
      config.relayConsoleMessages ||
      'send-console-messages' in req.query ||
      'vscodeBrowserReqId' in req.query
    ) {
      html = injectScriptEventRelayScript(html);
    }
    if (config.screenshot && req.path === '/') {
      html = addScriptToHtmlHead(html, '/__p5_server_static/screenshot.min.js');
      html = addScriptToHtmlHead(html, {
        __p5_server_screenshot_settings: config.screenshot,
      });
    }
    res.set('Content-Type', 'text/html');
    res.send(html);
  }
}

async function sendDirectoryListing<T>(
  config: RouterConfig,
  req: Request<unknown, unknown, unknown, unknown, T>,
  res: Response<unknown, T>
) {
  // This is needed for linked files to work.
  if (!req.originalUrl.endsWith('/')) {
    return res.redirect(req.originalUrl + '/');
  }
  const dir = path.join(
    config.root,
    decodeURIComponent(req.path).replace(/\//g, path.sep)
  );
  // read the directory contents
  const indexFile = (await readdir(dir)).find(file => /^index\.html?$/i.test(file));
  let html = indexFile
    ? await readFile(path.join(dir, indexFile), 'utf-8')
    : await createDirectoryListing(dir, req.originalUrl, {
        templateName: config.theme,
      });

  // Note: This injects the reload script into both static and generated index
  // pages. This ensures that the index page reloads when the directory contents
  // change.
  if (config.liveServer) {
    html = injectLiveReloadScript(html, req.app.locals.liveReloadServer);
  }
  return res.send(html);
}

async function startServer(config: ServerConfig, sketchRelay: BrowserScriptRelay) {
  const mountPoints = config.mountPoints as MountPoint[];
  const app = express();

  // add routes
  app.use('/__p5_server_static', express.static(path.join(__dirname, 'static')));
  for (const { filePath, urlPath } of mountPoints) {
    let root = filePath;
    let sketchFile: string | undefined;
    if (!fs.statSync(root).isDirectory()) {
      sketchFile = root;
      root = path.dirname(root);
    }
    const routerConfig: RouterConfig = { ...config, root, sketchFile };
    app.use(urlPath, createRouter(routerConfig));
    app.use(urlPath, express.static(root));
  }
  if (mountPoints.every(mp => mp.urlPath !== '/')) {
    const mountListTmpl = pug.compileFile(path.join(templateDir, 'mountPoints.pug'));
    app.get('/', (_req, res) => res.send(mountListTmpl({ mountPoints })));
  }

  // For effect only. This provide errors and diagnostics before waiting for a
  // browser request.
  if (fs.statSync(mountPoints[0].filePath).isDirectory()) {
    createDirectoryListing(mountPoints[0].filePath, mountPoints[0].urlPath, {
      templateName: config.theme,
    });
  }

  // Scan for an avialable port
  let server: http.Server | null = null;
  const port = config.port;
  for (let p = port; p < port + 10; p++) {
    try {
      server = await promiseListen(app, p);
      break; // success!
    } catch (e) {
      if (e.code !== 'EADDRINUSE' || !config.scanPorts) {
        throw e;
      }
      console.log(`Port ${p} is in use, retrying...`);
    }
  }
  // If the port scan didn't find an available port within the range. Allow
  // server.listen to choose a port.
  if (!server) server = await promiseListen(app);

  const address = server.address();
  if (!address || typeof address === 'string') {
    throw new Error('Failed to start the server');
  }
  attachBrowserScriptRelay(server, sketchRelay);
  try {
    const liveReloadServer = await createLiveReloadServer({
      port: Math.min(port + 35729 - config.port, 30000),
      scanPorts: true,
      watchDirs: [templateDir, ...mountPoints.map(mount => mount.filePath)],
    });
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
  public mountPoints: MountPoint[];
  private readonly config: ServerConfig;
  private liveReloadServer: LiveReloadServer | null = null;
  private readonly browserScriptEmitter = new EventEmitter();
  public readonly emitScriptEvent = this.browserScriptEmitter.emit.bind(
    this.browserScriptEmitter
  );
  public readonly onScriptEvent = this.browserScriptEmitter.on.bind(
    this.browserScriptEmitter
  );

  constructor(options: Partial<Server.Options> = {}) {
    const mountPoints =
      options.mountPoints && options.mountPoints.length > 0
        ? Server.normalizeMountPoints(options.mountPoints)
        : [{ filePath: options.root || '.', urlPath: '/' }];
    this.mountPoints = mountPoints;
    this.config = { ...defaultServerOptions, root: null, ...options, mountPoints };
    this.config.theme ||= defaultServerOptions.theme;
  }

  /** Create and start the server. Returns the instance. */
  public static async start(options: Partial<Server.Options> = {}) {
    return new Server(options).start();
  }

  public async start() {
    const { server, liveReloadServer, url } = await startServer(this.config, this);
    this.server = server;
    this.liveReloadServer = liveReloadServer;
    this.url = url;
    return this;
  }

  /**
   * Close the server and the liveServer.
   *
   * Note: Can return before the liveServer is stopped.
   */
  public async close() {
    if (this.server) {
      await promiseClose(this.server);
      this.server = null;
    }
    this.url = undefined;
    this.liveReloadServer?.close();
    this.liveReloadServer = null;
  }

  public filePathToUrl(filePath: string): string | null {
    const baseUrl = this.url || `http://localhost:${this.config.port}`;
    for (const mountPoint of this.mountPoints) {
      const filePrefix = mountPoint.filePath + path.sep;
      const pathPrefix = mountPoint.urlPath.replace(/(?<!\/)$/, '/');
      if (filePath.startsWith(filePrefix)) {
        return baseUrl + filePath.replace(filePrefix, pathPrefix);
      }
    }
    return null;
  }

  public urlPathToFilePath(urlPath: string): string | null {
    for (const mountPoint of this.mountPoints) {
      const filePrefix = mountPoint.filePath + path.sep;
      const pathPrefix = mountPoint.urlPath.replace(/(?<!\/)$/, '/');
      if (urlPath.startsWith(pathPrefix)) {
        return urlPath.replace(pathPrefix, filePrefix);
      }
    }
    return null;
  }

  // public urlToFilePath(url: string) {
  //   const baseUrl = this.url || `http://localhost:${this.options.port}`;
  //   if (url.startsWith(baseUrl + '/')) {
  //     return url.slice(baseUrl.length);
  //     console.info(url.slice(baseUrl.length));
  //     return this.urlPathToFilePath(url.slice(baseUrl.length));
  //   }
  //   return null;
  // }

  private static normalizeMountPoints(
    mountPoints: Server.MountPointOption[]
  ): MountPoint[] {
    const finalPathSep = new RegExp(`${path.sep}$`);
    const mounts = mountPoints
      // normalize to records
      .map(mount => (typeof mount === 'string' ? { filePath: mount } : mount))
      // default url paths from file paths
      .map(mount => ({
        urlPath: '/' + (mount.name || path.basename(mount.filePath)),
        ...mount,
      }))
      // encode URL paths
      .map(mount => ({ ...mount, urlPath: mount.urlPath.replace(/ /g, ' ') }))
      // normalize Windows paths
      .map(mount => ({ ...mount, filePath: mount.filePath.replace(/\//g, path.sep) }))
      // remove trailing slashes from file and url paths
      .map(mount => ({
        ...mount,
        filePath: mount.filePath.replace(finalPathSep, ''),
        urlPath: mount.urlPath.replace(/\/$/, ''),
      }));
    // modify url paths to ensure that they are unique
    const seen = new Set<string>();
    for (const mount of mounts) {
      if (seen.has(mount.urlPath)) {
        mount.urlPath = findUniqueName(mount.urlPath, seen);
      }
      seen.add(mount.urlPath);
    }
    return mounts;

    function findUniqueName(base: string, exclude: Set<string>): string {
      for (const name of generateNames(base)) {
        if (!exclude.has(name)) {
          return name;
        }
      }
      return null as never;
    }

    function* generateNames(base: string) {
      yield base;
      let ix = 2;
      const m = base.match(/^(.*?)-(\d*)$/);
      if (m) {
        base = m[1];
        ix = parseInt(m[2], 10) + 1;
      }
      while (true) {
        yield `${base}-${ix++}`;
      }
    }
  }
}

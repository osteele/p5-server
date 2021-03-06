import chalk from 'chalk';
import express from 'express';
import fs from 'fs';
import path from 'path';
import pug from 'pug';
import { EventEmitter } from 'stream';
import { assertError } from '../ts-extras';
import {
  attachBrowserScriptRelay,
  BrowserScriptRelay
} from './browserScriptEventRelay';
import { cdnProxyRouter, proxyPrefix } from './cdnProxy';
import { staticAssetPrefix } from './constants';
import { createDirectoryListing } from './directoryListing';
import { promiseClose, promiseListen } from './httpServerUtils';
import { createLiveReloadServer, LiveReloadServer } from './liveReload';
import { createRouter } from './routes';
import { templateDir } from './templates';
import http = require('http');

// eslint-disable-next-line @typescript-eslint/no-namespace
export namespace Server {
  export type Options = Partial<{
    /** The http port number. Defaults to 3000. */
    port: number;

    /** If true, then if the specified port number is not available, find
     * another port. Defaults to true. */
    scanPorts: boolean;

    /** The base directory. Defaults to the current working directory. */
    root: string | null;

    /** A list of base directories and optional URL path prefixes. If this is
     * present, it is used instead of the root option. */
    mountPoints: MountPointOptions[];

    /** Cache requests to CND servers, for use without an internet connection.
     */
    proxyCache: boolean;

    /** If true, relay console events from the sketch to an emitter on the
     * server. */
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
}

// This type is used internally. Unlike Server.Options, all the parameters are
// required. If they were not supplied by the user, they will be filled in with
// defaults from defaultServerOptions.
type ServerConfig = Required<Server.Options>;

export type MountPointOptions =
  | string
  | { filePath: string; name?: string; urlPath?: string };

export type RouterConfig = Server.Options & {
  root: string;
  sketchFile?: string;
};

type MountPoint = { filePath: string; urlPath: string; name?: string };

const defaultServerOptions = {
  liveServer: true,
  logConsoleEvents: false,
  port: 3000,
  proxyCache: true,
  relayConsoleMessages: false,
  scanPorts: true,
  screenshot: null,
  theme: 'split',
};

async function startServer(config: ServerConfig, sketchRelay: BrowserScriptRelay) {
  const mountPoints = config.mountPoints as MountPoint[];
  const app = express();
  // app.use((req, res, next) => {
  //   console.log('', req.method, req.originalUrl);
  //   next();
  // });

  // add routes
  app.use(staticAssetPrefix, express.static(path.join(__dirname, 'static')));
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
    app.get('/', (_req, res) => {
      res.send(mountListTmpl({ mountPoints, staticAssetPrefix, path }))
    }
    );
  }
  app.use(proxyPrefix, cdnProxyRouter);
  app.use((req, _res, next) => {
    console.warn(chalk.red(`Not found (404): ${req.originalUrl}`));
    next();
  });

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
    } catch (err) {
      assertError(err);
      if (err.code !== 'EADDRINUSE' || !config.scanPorts) {
        throw err;
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
 * and automatic library inclusion for JavaScript-only sketches.
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
        ? Server._normalizeMountPoints(options.mountPoints)
        : [{ filePath: options.root || '.', urlPath: '/' }];
    this.mountPoints = mountPoints;
    // null out the root. It is only used in initialization, and is now captured
    // in mountPoints instead.
    this.config = { ...defaultServerOptions, root: null, ...options, mountPoints };
    this.config.theme ||= defaultServerOptions.theme;
  }

  /** Create and start the server. Returns the instance. */
  public static async start(options: Partial<Server.Options> = {}): Promise<Server> {
    return new Server(options).start();
  }

  public async start(): Promise<this> {
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
  public async close(): Promise<void> {
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

  public serverUrlToFileUrl(url: string): string | null {
    const baseUrl = this.url || `http://localhost:${this.config.port}`;
    if (url.startsWith(baseUrl + '/')) {
      const filepath = this.urlPathToFilePath(url.slice(baseUrl.length));
      if (filepath) return 'file://' + path.resolve(filepath);
    }
    return null;
  }

  /** Normalize file paths; remove trailing slashes from file and url paths;
   * generate unique names and prefixes for mount points that don't specify
   * them. */
  private static _normalizeMountPoints(mountPoints: MountPointOptions[]): MountPoint[] {
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
      throw new Error('This should not happen');
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

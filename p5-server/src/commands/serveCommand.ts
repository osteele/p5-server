import util from 'node:util';
import chalk, { type ChalkInstance } from 'chalk';
import { die, openInBrowser } from '../helpers.js';
import type {
  BrowserConnectionEvent,
  BrowserConsoleEvent,
  BrowserConsoleEventMethods,
  BrowserDocumentEvent,
  BrowserErrorEvent,
  BrowserEventMessage,
  BrowserWindowEvent,
} from '../server/eventTypes.js';
import { Server } from '../server/Server.js';
import {
  parseDimensions,
  parseFiniteNumber,
  parsePositiveNumber,
} from './agentOptions.js';

type Options = {
  agent?: boolean;
  browser?: 'safari' | 'chrome' | 'firefox' | 'edge';
  canvasSize?: string;
  console?: boolean | 'json' | 'passive';
  host?: string;
  open?: boolean;
  port?: string;
  pixelDensity?: string;
  proxyCache?: boolean;
  seed?: string;
  split?: boolean;
  theme?: string;
};

export default async function serve(files: string[], options: Options) {
  // Compatability warnings for old options
  if (options.split) {
    if (options.theme && options.theme !== 'split') {
      die('Use either --split or --theme but not both');
    }
    process.stderr.write(
      chalk.yellow(
        'Warning: --split is now the default. This option will be removed in a future release.\n'
      )
    );
  }
  if (options.theme === 'directory') {
    options.theme = 'grid';
    process.stderr.write(
      chalk.yellow(
        'The "directory" theme has been renamed to grid. A future release will remove the "directory" value.\n'
      )
    );
  }

  const file = files[0] || '.';
  const displayName = file === '.' ? process.cwd() : file;
  if (
    !options.agent &&
    (options.canvasSize || options.pixelDensity || options.seed)
  ) {
    die('--canvas-size, --pixel-density, and --seed require --agent');
  }
  const serverOptions: Server.Options = {
    agentSupport: options.agent
      ? {
          canvasDimensions: options.canvasSize
            ? parseDimensions(options.canvasSize, 'canvas size')
            : undefined,
          pixelDensity: options.pixelDensity
            ? parsePositiveNumber(options.pixelDensity, 'pixel density')
            : undefined,
          seed: options.seed
            ? parseFiniteNumber(options.seed, 'seed')
            : undefined,
        }
      : false,
    host: options.host,
    proxyCache: options.proxyCache,
    port: Number(options.port),
    root: file,
    relayConsoleMessages:
      Boolean(options.console) && options.console !== 'passive',
    theme: options.theme || undefined,
  };
  if (files.length > 1) serverOptions.mountPoints = files;
  const server = await Server.start(serverOptions);
  if (options.console)
    subscribeToBrowserEvents(server, options.console === 'json');
  console.log(`Serving ${displayName} at ${server.url}`);
  if (options.agent) {
    console.log(
      'Agent support is available in the page as window.__p5Agent.\n' +
        'It can report readiness, wait for a frame, set the random seed, and capture the canvas.'
    );
  }
  if ((options.open || options.browser) && server.url)
    openInBrowser(server.url, options.browser?.toLowerCase());
}

function subscribeToBrowserEvents(server: Server, asJson: boolean) {
  const consoleColors: Record<
    BrowserConsoleEventMethods,
    ChalkInstance | null
  > = {
    debug: chalk.blueBright,
    error: chalk.red,
    info: chalk.green,
    log: chalk.gray,
    warn: chalk.yellow,
    clear: null,
  };

  server.onScriptEvent('connection', (data: BrowserConnectionEvent) => {
    console.error(
      chalk.italic.dim(`browser connection: ${data.type}`),
      makeLocationString(data)
    );
  });

  server.onScriptEvent('console', (data: BrowserConsoleEvent) => {
    if (asJson) {
      console.log('browser console:', data);
    } else {
      const { method, args, argStrings } = data;
      const argsOrStrings = args.map((str, i) => argStrings[i] ?? str);
      const message =
        typeof args[0] === 'string'
          ? util.format(...argsOrStrings)
          : argsOrStrings.join(' ');
      const color = consoleColors[method] || chalk.black;
      console.log(
        color(`browser console.${method}${args.length ? ': ' : ''}${message}`),
        makeLocationString(data)
      );
    }
  });

  server.onScriptEvent('document', (data: BrowserDocumentEvent) => {
    const { type, visibilityState } = data;
    console.error(
      chalk.italic.dim(`browser document.${type}: ${visibilityState}`),
      makeLocationString(data)
    );
  });

  server.onScriptEvent('error', (data: BrowserErrorEvent) => {
    if (asJson) {
      console.log('browser error:', data);
    } else {
      const { type, message, stack } = data;
      console.error(
        chalk.italic.bold.red(`browser ${type}: ${message}`),
        makeLocationString(data)
      );
      if (stack) console.error(chalk.red(stack.replace(/^/gm, '  ')));
    }
  });

  server.onScriptEvent('window', (data: BrowserWindowEvent) => {
    if (asJson) {
      console.log('browser window event:', data);
    } else {
      console.log(
        chalk.italic.dim.blue(`browser window.${data.type}`),
        makeLocationString(data)
      );
    }
  });

  function makeLocationString(data: BrowserEventMessage) {
    const { clientId, file, url } = data;
    let loc = file || url;
    if (data.type === 'console' || data.type === 'error') {
      const { col, line } = data;
      loc += col && line ? `:${line}:${col}` : line ? `:${line}` : '';
    }
    return chalk.dim(`(${loc} – ${clientId})`);
  }
}

import chalk, { Chalk } from 'chalk';
import open from 'open';
import {
  BrowserConnectionEvent,
  BrowserConsoleEvent,
  BrowserConsoleEventMethods,
  BrowserDocumentEvent,
  BrowserErrorEvent,
  BrowserEventMessage,
  BrowserWindowEvent
} from 'src/server/eventTypes';
import util from 'util';
import { Server } from '../server/Server';
import { die } from '../utils';

type Options = {
  open: boolean;
  port: string;
  console: boolean | 'json' | 'passive';
  split: boolean;
  theme: string;
};

export default async function serve(files: string[], options: Options) {
  if (options.split) {
    if (options.theme && options.theme !== 'split') {
      die('Use either --split or --theme but not both');
    }
    options.theme = 'split';
  }
  const file = files[0] || '.';
  const displayName = file === '.' ? process.cwd() : file;
  const serverOptions: Server.Options = {
    port: Number(options.port),
    root: file,
    relayConsoleMessages: Boolean(options.console) && options.console !== 'passive',
    theme: options.theme || undefined
  };
  if (files.length > 1) serverOptions.mountPoints = files;
  const server = await Server.start(serverOptions);
  if (options.console) subscribeToBrowserEvents(server, options.console === 'json');
  console.log(`Serving ${displayName} at ${server.url}`);
  if (options.open && server.url) open(server.url);
}

function subscribeToBrowserEvents(server: Server, asJson: boolean) {
  const consoleColors: Record<BrowserConsoleEventMethods, Chalk | null> = {
    debug: chalk.blueBright,
    error: chalk.red,
    info: chalk.green,
    log: chalk.gray,
    warn: chalk.yellow,
    clear: null
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
      const argsOrStrings = argStrings.map((str, i) => str ?? args[i]);
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

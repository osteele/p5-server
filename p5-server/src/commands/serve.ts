import chalk from 'chalk';
import open from 'open';
import {
  BrowserConnectionEvent,
  BrowserConsoleEvent,
  BrowserDocumentEvent,
  BrowserErrorEvent,
  BrowserWindowEvent
} from 'src/server/eventTypes';
import { Server } from '../server/Server';
import util from 'util';

type Options = { open: boolean; port: string; console: boolean | string };

export default async function serve(files: string[], options: Options = { open: false, port: '3000', console: false }) {
  const file = files[0] || '.';
  const displayName = file === '.' ? process.cwd() : file;
  const serverOptions: Server.Options = {
    port: Number(options.port),
    root: file,
    relayConsoleMessages: Boolean(options.console)
  };
  if (files.length > 1) serverOptions.mountPoints = files;
  const server = await Server.start(serverOptions);
  console.log(`Serving ${displayName} at ${server.url}`);

  if (options.console) {
    const consoleColors = {
      info: chalk.green,
      debug: chalk.blueBright,
      warn: chalk.yellow,
      error: chalk.red,
      log: chalk.gray,
      clear: null
    };

    server.onScriptEvent('connection', (data: BrowserConnectionEvent) => {
      const { clientId, file, url, type } = data;
      console.error(chalk.italic(`browser connection: ${type}`), chalk.dim(`(${file || url} – ${clientId})`));
    });

    server.onScriptEvent('console', (data: BrowserConsoleEvent) => {
      if (options.console === 'json') {
        console.log('browser console:', data);
      } else {
        const { method, args, argStrings, file, url, clientId } = data;
        const argsOrStrings = argStrings.map((str, i) => str ?? args[i]);
        const message = typeof args[0] === 'string' ? util.format(...argsOrStrings) : argsOrStrings.join(' ');
        const color = consoleColors[method] || chalk.black;
        console.log(
          color(`browser console.${method}${args.length ? ': ' : ''}${message}`),
          chalk.dim(`(${file || url} – ${clientId})`)
        );
      }
    });

    server.onScriptEvent('document', (data: BrowserDocumentEvent) => {
      const { clientId, file, url, type, visibilityState } = data;
      console.error(
        chalk.italic(`browser document.${type}: ${visibilityState}`),
        chalk.dim(`(${file || url} – ${clientId})`)
      );
    });

    server.onScriptEvent('error', (data: BrowserErrorEvent) => {
      const { clientId, file, url, type, message, stack } = data;
      console.error(chalk.italic.red(`browser ${type}: ${message}`), chalk.dim(`(${file || url} – ${clientId})`));
      if (stack) console.error(chalk.red(stack));
    });

    server.onScriptEvent('window', (data: BrowserWindowEvent) => {
      if (options.console === 'json') {
        console.log('browser window event:', data);
      } else {
        const { type, file, url, clientId } = data;
        console.log(chalk.italic.blue(`browser window.${type}`), chalk.dim(`(${file || url} – ${clientId})`));
      }
    });
  }

  if (options.open && server.url) open(server.url);
}

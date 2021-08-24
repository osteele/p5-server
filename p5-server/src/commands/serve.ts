import open from 'open';
import { BrowserConsoleEvent, BrowserErrorEvent, BrowserWindowEvent } from 'src/server/eventTypes';
import { Server } from '../server/Server';

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
  /** If true, relay console events from the sketch to an emitter on the server. */
  console.log(`Serving ${displayName} at ${server.url}`);

  if (options.console) {
    server.onScriptEvent('console', (data: BrowserConsoleEvent) => {
      if (options.console === 'json') {
        console.log('browser console:', data);
      } else {
        const { method, args, argStrings, file, url } = data;
        const argsOrStrings = argStrings.map((arg, i) => arg || args[i]);
        console.log(`browser console.${method}:`, ...argsOrStrings, `(${file || url})`);
      }
    });
    server.onScriptEvent('error', (data: BrowserErrorEvent) => {
      console.log(`browser ${data.type}:`, data);
    });
    server.onScriptEvent('window', (data: BrowserWindowEvent) => {
      if (options.console === 'json') {
        console.log('browser window event:', data);
      } else {
        const { type, file, url } = data;
        console.log('browser window event:', type, `(${file || url})`);
      }
    });
  }

  if (options.open && server.url) open(server.url);
}

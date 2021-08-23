import open from 'open';
import { SketchConsoleEvent, SketchErrorEvent } from 'src/server/types';
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
    server.onScriptEvent('console', (data: SketchConsoleEvent) => {
      if (options.console === 'json') {
        console.log('browser console:', data);
      } else {
        const { method, args, argStrings, file, url } = data;
        const argsOrStrings = argStrings.map((arg, i) => arg || args[i]);
        console.log(`browser console.${method}:`, ...argsOrStrings, `(${file || url})`);
      }
    });
    server.onScriptEvent('error', (data: SketchErrorEvent) => {
      console.log(`browser ${data.kind}:`, data);
    });
    server.onScriptEvent('window', data => {
      if (options.console === 'json') {
        console.log('browser window event:', data);
      } else {
        const { event, file, url } = data;
        console.log('browser window event:', event, `(${file || url})`);
      }
    });
  }

  if (options.open && server.url) open(server.url);
}

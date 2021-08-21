import open from 'open';
import { Server } from '../server/Server';

export default async function serve(files: string[], options = { open: false, port: '3000', console: false }) {
  const file = files[0] || '.';
  const displayName = file === '.' ? process.cwd() : file;
  const serverOptions: Server.Options = {
    port: Number(options.port),
    root: file,
    relayConsoleMessages: options.console
  };
  if (files.length > 1) serverOptions.mountPoints = files;
  const server = await Server.start(serverOptions);
  /** If true, relay console events from the sketch to an emitter on the server. */
  console.log(`Serving ${displayName} at ${server.url}`);
  if (options.console) {
    server.onSketchEvent('console', ({ method, args, url }) => {
      console.log.call(console, `sketch ${method}:`, method, ...args, `(${file})`);
    });
    server.onSketchEvent('error', data => {
      console.log(`sketch ${data.kind}:`, data);
    });
  }
  if (options.open && server.url) open(server.url);
}

import livereload from 'livereload';
import { addScriptToHtmlHead } from '../helpers';

export type Options = {
  host?: string;
  port?: number;
  scanPorts?: boolean;
  watchDirs?: string[];
};

export type LiveReloadServer = ReturnType<typeof livereload.createServer>;

export const liveReloadTemplate = `
  document.write('<script src="http://' + (location.host || 'localhost').split(':')[0] +
  ':$(port)/livereload.js?snipver=1"></' + 'script>')`;

export function injectLiveReloadScript(
  html: string,
  liveReloadServer: LiveReloadServer
): string {
  if (!liveReloadServer) return html;
  const address = liveReloadServer.server.address();
  if (!address) {
    throw new Error('liveReloadServer.address returned null');
  }
  if (typeof address === 'string') {
    throw new Error(
      `liveReloadServer.address is a string ${address}; expected a WebSocket.AddressInfo`
    );
  }
  const liveReloadScript = liveReloadTemplate.replace(
    '$(port)',
    address.port.toString()
  );
  return addScriptToHtmlHead(html, { script: liveReloadScript });
}

export async function createLiveReloadServer({
  host = '127.0.0.1',
  port = 35729,
  scanPorts = true,
  watchDirs = <string[]>[]
}: Options): Promise<LiveReloadServer> {
  const lastPort = port + 9;
  let lrServer: LiveReloadServer | undefined;
  while (!lrServer) {
    try {
      lrServer = await listen(port, host);
    } catch (err) {
      if (!isAddressInUseError(err) || !scanPorts) throw err;
      port = port < lastPort ? port + 1 : 0;
    }
  }
  watchDirs.forEach(dir => lrServer.watch(dir));
  return lrServer;
}

function isAddressInUseError(err: unknown): err is NodeJS.ErrnoException {
  return err instanceof Error && 'code' in err && err.code === 'EADDRINUSE';
}

function listen(port: number, host: string): Promise<LiveReloadServer> {
  return new Promise((resolve, reject) => {
    type ServerOptions = NonNullable<Parameters<typeof livereload.createServer>[0]> & {
      host: string;
    };
    const options: ServerOptions = { host, noListen: true, port };
    const server = livereload.createServer(options);
    server.once('error', reject);
    server.listen(() => {
      server.off('error', reject);
      resolve(server);
    });
  });
}

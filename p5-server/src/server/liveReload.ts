import livereload from 'livereload';
import net from 'net';
import { addScriptToHtmlHead } from '../utils';

export type LiveReloadServer = ReturnType<typeof livereload.createServer>;

export const liveReloadTemplate = `
  document.write('<script src="http://' + (location.host || 'localhost').split(':')[0] +
  ':$(port)/livereload.js?snipver=1"></' + 'script>')`;

export function injectLiveReloadScript(
  html: string,
  liveReloadServer: LiveReloadServer
) {
  if (!liveReloadServer) return html;
  const address = liveReloadServer.server.address();
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
  port = 35729,
  scanPorts = true,
  watchDirs = <string[]>[],
}): Promise<LiveReloadServer> {
  const lastPort = port + 9;
  while (port && scanPorts && !(await isPortAvailable(port))) {
    if (++port > lastPort) port = 0;
  }
  const lrServer = livereload.createServer({ port });
  watchDirs.forEach(dir => lrServer.watch(dir));
  return lrServer;
}

async function isPortAvailable(port: number) {
  for (let i = 0; i < 3; i++) {
    if (!(await _isPortAvailable(port))) return false;
    await new Promise(resolve => setTimeout(resolve, 2));
  }
  return true;
}

function _isPortAvailable(port: number) {
  return new Promise(resolve => {
    const server = net.createServer();
    server.once('error', () => resolve(false));
    server.once('close', () => resolve(true));
    server.once('listening', () =>
      new Promise(resolve => setTimeout(resolve, 5)).then(() => server.close())
    );
    server.listen(port);
  });
}

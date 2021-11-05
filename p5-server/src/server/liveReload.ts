import livereload from 'livereload';
import net from 'net';
import { addScriptToHtmlHead } from '../helpers';

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

// TODO: instead of scanning for ports, can we use the ServerConfig.server
// option to livereload.createServer?
export async function createLiveReloadServer({
  port = 35729,
  scanPorts = true,
  watchDirs = <string[]>[]
}): Promise<LiveReloadServer> {
  const lastPort = port + 9; // the last port to try
  // Try to find an available port
  while (port && scanPorts && !(await isPortAvailable(port))) {
    if (++port > lastPort) port = 0; // this breaks the loop and says to pick a random port
  }
  // A race condition is possible here between the port scan above and the line
  // below. The right solution is to contribute to or fork livereload so that it
  // can fail with a programmatic error if the requested port is not available.
  const lrServer = livereload.createServer({ port });
  watchDirs.forEach(dir => lrServer.watch(dir));
  return lrServer;
}

/**
 * Test whether a port is available, by creating a server on that port. Try
 * three times, so that if servers are started concurrently we don't get a false
 * positive.
 *
 * TODO: Use a lock file. Or better, see the note in createLiveReloadServer that
 * would make this function unnecessary.
 */
async function isPortAvailable(port: number) {
  for (let i = 0; i < 3; i++) {
    if (!(await _isPortAvailable(port))) return false;
    await new Promise(resolve => setTimeout(resolve, 2));
  }
  return true;
}

/**
 * Test whether a port is available, by creating and then closing a server on
 * that port.
 */
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

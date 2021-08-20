import livereload from 'livereload';
import WebSocket from 'ws';

export const liveReloadTemplate = `<script>
  document.write('<script src="http://' + (location.host || 'localhost').split(':')[0] +
  ':$(port)/livereload.js?snipver=1"></' + 'script>')
</script>`;

export function injectLiveReloadScript(content: string, liveReloadServer: WebSocket.Server) {
  // TODO: more robust injection
  // TODO: warn when injection is not possible
  if (!liveReloadServer) return content;
  const address = liveReloadServer.address();
  if (typeof address === 'string') {
    throw new Error('liveReloadServer.address is a string, not a WebSocket.AddressInfo');
  }
  const liveReloadString = liveReloadTemplate.replace('$(port)', address.port.toString());
  return content.replace(/(?=<\/head>)/, liveReloadString);
}

export function createLiveReloadServer(watchDirs: string[]) {
  const server = livereload.createServer({ port: 0 });
  watchDirs.forEach(dir => server.watch(dir));
  return server.server;
}

import { URL } from 'url';
import { BrowserConsoleEvent, BrowserErrorEvent } from './types';
import { parseCyclicJson } from './cyclicJson';
import ws from 'ws';
import http from 'http';

export interface BrowserScriptRelay {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  emitScriptEvent(eventName: string | symbol, ...args: any[]): boolean;
  filePathToUrl(filePath: string): string | null;
  urlPathToFilePath(urlPath: string): string | null;
}

export function attachBrowserScriptRelay(server: http.Server, relay: BrowserScriptRelay) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const routes = new Map<string, (event: Record<string, any>) => void>();

  const wsServer = new ws.Server({ noServer: true });
  wsServer.on('connection', socket => {
    socket.on('message', message => {
      const [route, data] = parseCyclicJson(message as string);
      const handler = routes.get(route);
      if (handler) handler({ ...data, file: urlToFilePath(data.url) });
    });
  });
  server.on('upgrade', (request, socket, head) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    wsServer.handleUpgrade(request, socket as any, head, socket => {
      wsServer.emit('connection', socket, request);
    });
  });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  function defineHandler(route: string, handler: (event: any) => void) {
    routes.set(route, handler);
  }

  defineHandler('console', (event: BrowserConsoleEvent) => {
    const data: BrowserConsoleEvent = {
      ...event,
      args: event.args.map(decodeUnserializableValue)
    };
    relay.emitScriptEvent('console', data);
  });

  defineHandler('error', (event: BrowserErrorEvent) => {
    const data: BrowserErrorEvent = {
      ...event,
      stack: replaceUrlsInStack(event.stack)
    };
    relay.emitScriptEvent('error', data);
  });

  defineHandler('window', (event: BrowserConsoleEvent) => {
    relay.emitScriptEvent('window', event);
  });

  function urlToFilePath(url: string | undefined): string | undefined {
    return (url && relay.urlPathToFilePath(new URL(url).pathname)) || undefined;
  }

  function replaceUrlsInStack(stack: string | undefined): string | undefined {
    return stack
      ? stack.replace(/\bhttps?:\/\/localhost(?::\d+)?(\/[^\s:]+)/g, (s, p) => relay.urlPathToFilePath(p) || s)
      : stack;
  }
}

export function injectScriptEventRelayScript(html: string) {
  return html.replace(/(?=<\/head>)/, '<script src="/__p5_server_static/console-relay.js"></script>');
}

const serializationPrefix = '__p5_server_serialization_:';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function decodeUnserializableValue(value: any) {
  return typeof value === 'string' && value.startsWith(serializationPrefix)
    ? eval(value.slice(serializationPrefix.length))
    : value;
}

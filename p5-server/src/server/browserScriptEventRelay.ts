import { URL } from 'url';
import { SketchConsoleEvent, ErrorMessageEvent, SketchErrorEvent } from './types';
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
  const routes = new Map<string, (url: string, body: Record<string, any>) => void>();

  const wsServer = new ws.Server({ noServer: true });
  wsServer.on('connection', socket => {
    socket.on('message', message => {
      const [route, url, data] = parseCyclicJson(message as string);
      const handler = routes.get(route);
      if (handler) handler(url, data);
    });
  });
  server.on('upgrade', (request, socket, head) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    wsServer.handleUpgrade(request, socket as any, head, socket => {
      wsServer.emit('connection', socket, request);
    });
  });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  function defineHandler(route: string, handler: (url: string, body: any) => void) {
    routes.set(route, handler);
  }

  defineHandler('console', (url: string, body: SketchConsoleEvent) => {
    const data: SketchConsoleEvent = {
      ...body,
      args: body.args.map(decodeUnserializableValue),
      file: urlToFilePath(url),
      url
    };
    relay.emitScriptEvent('console', data);
  });

  defineHandler('error', (url: string, body: ErrorMessageEvent) => {
    const data: SketchErrorEvent = {
      ...body,
      url,
      file: urlToFilePath(url),
      stack: replaceUrlsInStack(body.stack)
    };
    relay.emitScriptEvent('error', data);
  });

  defineHandler('window', (url: string, body: SketchConsoleEvent) => {
    const data: SketchConsoleEvent = { ...body, file: urlToFilePath(body.url) };
    relay.emitScriptEvent('window', data);
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

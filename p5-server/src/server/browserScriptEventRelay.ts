import http from 'http';
import net from 'net';
import { URL } from 'url';
import ws from 'ws';
import { addScriptToHtmlHead } from '../utils';
import { parseCyclicJson } from './cyclicJson';
import {
  BrowserConnectionEvent,
  BrowserConsoleEvent,
  BrowserDocumentEvent,
  BrowserErrorEvent,
  BrowserWindowEvent,
} from './eventTypes';

export interface BrowserScriptRelay {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  emitScriptEvent(eventName: string | symbol, ...args: any[]): void;
  filePathToUrl(filePath: string): string | null;
  urlPathToFilePath(urlPath: string): string | null;
  serverUrlToFileUrl(url: string): string | null;
}

export function attachBrowserScriptRelay(
  server: http.Server,
  relay: BrowserScriptRelay
) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const routes = new Map<string, (event: Record<string, any>) => void>();
  const wsServer = new ws.Server({ noServer: true });

  wsServer.on('connection', socket => {
    socket.on('message', message => {
      const [route, data] = parseCyclicJson(message.toString());
      const handler = routes.get(route);
      if (handler) {
        handler({
          ...data,
          file: urlToFilePath(data.url),
          stack: replaceUrlsInStack(relay, data.stack),
          timestamp: new Date(data.timestamp),
        });
      }
    });
  });

  server.on('upgrade', (request, socket: net.Socket, head) => {
    wsServer.handleUpgrade(request, socket, head, socket => {
      wsServer.emit('connection', socket, request);
    });
  });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  function defineHandler(route: string, handler: (event: any) => void) {
    routes.set(route, handler);
  }

  defineHandler('connection', (event: BrowserConnectionEvent) => {
    relay.emitScriptEvent('connection', event);
  });

  defineHandler('console', (event: BrowserConsoleEvent) => {
    const args = event.args.map(decodeUnserializableValue);
    const data: BrowserConsoleEvent = { ...event, type: 'console', args };
    relay.emitScriptEvent('console', data);
  });

  defineHandler('document', (event: BrowserDocumentEvent) => {
    relay.emitScriptEvent('document', event);
  });

  defineHandler('error', (event: BrowserErrorEvent) => {
    relay.emitScriptEvent('error', event);
  });

  defineHandler('window', (event: BrowserWindowEvent) => {
    relay.emitScriptEvent('window', event);
  });

  function urlToFilePath(url: string | null): string | null {
    if (!url) return url;
    try {
      new URL(url);
    } catch (e) {
      if (e.name !== 'TypeError') throw e;
      return null;
    }
    return relay.urlPathToFilePath(new URL(url).pathname);
  }
}

export function replaceUrlsInStack(
  relay: BrowserScriptRelay,
  stack: string | undefined
): string | undefined {
  if (!stack) return stack;
  return (
    // Safari
    stack
      .replace(
        /(?:^|\b)\S*@http:\/\/[^/]+\/__p5_server_static\/console-relay(?:\.min)\.js:\d+:\d+\n/g,
        ''
      )
      // Chrome (first line, without parens)
      .replace(
        /(?:^|\b) *at[^\n]+?http:\/\/[^/]+\/__p5_server_static\/console-relay(?:\.min)\.js:\d+:\d+\n/g,
        ''
      )
      // Chrome (subsequent lines, with parens)
      .replace(
        / +at[^\n]+?\(http:\/\/[^/]+\/__p5_server_static\/console-relay(?:\.min)\.js:\d+:\d+\)\n/gm,
        ''
      )
      // http:// -> file:///
      .replace(
        /\bhttps?:\/\/(?:localhost|127\.0\.0\.1)(?::\d+)?\/[^\s:]+/g,
        url => relay.serverUrlToFileUrl(url) || url
      )
  );
}

export function injectScriptEventRelayScript(html: string) {
  return addScriptToHtmlHead(html, '/__p5_server_static/console-relay.min.js');
}

const serializationPrefix = '__p5_server_serialization_:';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function decodeUnserializableValue(value: any) {
  return typeof value === 'string' && value.startsWith(serializationPrefix)
    ? eval(value.slice(serializationPrefix.length))
    : value;
}

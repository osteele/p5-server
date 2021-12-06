/** Receive and parse messages from the client-side console relay, and emit them
 * as events. */

import http from 'http';
import net from 'net';
import { URL } from 'url';
import ws from 'ws';
import {
  ConnectionMessage,
  ConsoleMethodMessage,
  DocumentMessage,
  ErrorMessage,
  Message,
  WindowMessage,
} from '../consoleRelayTypes';
import { addScriptToHtmlHead } from '../helpers';
import { jsonCycleStringifier } from '../jsonCycleStringifier';
import { assertError } from '../ts-extras';
import { staticAssetPrefix } from './constants';
import {
  BrowserConnectionEvent,
  BrowserConsoleEvent,
  BrowserDocumentEvent,
  BrowserErrorEvent,
  BrowserEventCommon,
  BrowserWindowEvent,
} from './eventTypes';

export interface BrowserScriptRelay {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  emitScriptEvent(eventName: string | symbol, ...args: any[]): void;
  filePathToUrl(filePath: string): string | null;
  urlPathToFilePath(urlPath: string): string | null;
  serverUrlToFileUrl(url: string): string | null;
}

type WithClientKeys<T> = Omit<T, 'timestamp'> & BrowserEventCommon;

const { parse: parseCyclicJson } = jsonCycleStringifier();

export function attachBrowserScriptRelay(
  server: http.Server,
  relay: BrowserScriptRelay
): void {
  const handlers = new Map<string, (event: WithClientKeys<Message>) => void>();
  const wsServer = new ws.Server({ noServer: true });

  wsServer.on('connection', socket => {
    socket.on('message', message => {
      const [route, data]: [string, Message] = parseCyclicJson(message.toString());
      const handler = handlers.get(route);
      if (handler) {
        handler({
          ...data,
          file: urlToFilePath(data.url) || undefined,
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

  function defineHandler(
    route: 'connection',
    handler: (event: WithClientKeys<ConnectionMessage>) => void
  ): void;
  function defineHandler(
    route: 'console',
    handler: (event: WithClientKeys<ConsoleMethodMessage>) => void
  ): void;
  function defineHandler(
    route: 'document',
    handler: (event: WithClientKeys<DocumentMessage>) => void
  ): void;
  function defineHandler(
    route: 'error',
    handler: (event: WithClientKeys<ErrorMessage>) => void
  ): void;
  function defineHandler(
    route: 'window',
    handler: (event: WithClientKeys<WindowMessage>) => void
  ): void;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  function defineHandler(route: string, handler: (event: any) => void) {
    handlers.set(route, handler);
  }

  defineHandler('connection', (message: WithClientKeys<ConnectionMessage>) => {
    const event: BrowserConnectionEvent = message;
    relay.emitScriptEvent('connection', event);
  });

  defineHandler('console', (message: WithClientKeys<ConsoleMethodMessage>) => {
    const event: BrowserConsoleEvent = { type: 'console', argStrings: [], ...message };
    const args = event.args.map(decodeUnserializableValue);
    // const argStrings = event.argStrings || [];
    const data: BrowserConsoleEvent = { ...event, type: 'console', args };
    relay.emitScriptEvent('console', data);
  });

  defineHandler('document', (message: WithClientKeys<DocumentMessage>) => {
    const event: BrowserDocumentEvent = message;
    relay.emitScriptEvent('document', event);
  });

  defineHandler('error', (message: WithClientKeys<ErrorMessage>) => {
    const event: BrowserErrorEvent = message;
    relay.emitScriptEvent('error', event);
  });

  defineHandler('window', (message: WithClientKeys<WindowMessage>) => {
    const event: BrowserWindowEvent = message;
    relay.emitScriptEvent('window', event);
  });

  function urlToFilePath(url: string | null | undefined): string | null {
    if (!url) return null;
    try {
      new URL(url);
    } catch (err) {
      assertError(err);
      if (err.name !== 'TypeError') throw err;
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
    stack
      // Safari
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

export function injectScriptEventRelayScript(html: string): string {
  return addScriptToHtmlHead(html, `${staticAssetPrefix}/console-relay.min.js`);
}

const serializationPrefix = '__p5_server_serialization_:';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function decodeUnserializableValue(value: any) {
  return typeof value === 'string' && value.startsWith(serializationPrefix)
    ? eval(value.slice(serializationPrefix.length))
    : value;
}

/** Receive and parse messages from the client-side console relay, and emit them
 * as events. */

import type http from 'node:http';
import type net from 'node:net';
import { URL } from 'node:url';
import { WebSocketServer } from 'ws';
import { assertError } from '../assertError.js';
import type {
  ConnectionMessage,
  ConsoleMethodMessage,
  DocumentMessage,
  ErrorMessage,
  Message,
  UnhandledRejectionMessage,
  WindowMessage,
} from '../consoleRelayTypes.js';
import { browserScriptRelayPath } from '../consoleRelayTypes.js';
import { addScriptsToHtmlHead, type HtmlHeadScript } from '../helpers.js';
import { jsonCycleStringifier } from '../jsonCycleStringifier.js';
import { staticAssetPrefix } from './constants.js';
import type {
  BrowserConnectionEvent,
  BrowserConsoleEvent,
  BrowserDocumentEvent,
  BrowserErrorEvent,
  BrowserEventCommon,
  BrowserWindowEvent,
} from './eventTypes.js';

export interface BrowserScriptRelay {
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
  const wsServer = new WebSocketServer({ noServer: true });

  wsServer.on('connection', (socket) => {
    socket.on('message', (message) => {
      const parsed = parseBrowserRelayMessage(message.toString());
      if (!parsed) {
        socket.close(1007, 'Invalid browser relay message');
        return;
      }
      const [route, data] = parsed;
      const handler = handlers.get(route);
      if (!handler) return;
      handler({
        ...data,
        file: urlToFilePath(data.url) || undefined,
        stack: replaceUrlsInStack(relay, data.stack),
        timestamp: new Date(data.timestamp),
      });
    });
  });

  server.on('upgrade', (request, socket: net.Socket, head) => {
    const requestUrl = new URL(request.url ?? '/', 'http://localhost');
    if (requestUrl.pathname !== browserScriptRelayPath) {
      socket.write('HTTP/1.1 404 Not Found\r\nConnection: close\r\n\r\n');
      socket.destroy();
      return;
    }
    wsServer.handleUpgrade(request, socket, head, (socket) => {
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
    handler: (
      event: WithClientKeys<ErrorMessage | UnhandledRejectionMessage>
    ) => void
  ): void;
  function defineHandler(
    route: 'window',
    handler: (event: WithClientKeys<WindowMessage>) => void
  ): void;
  function defineHandler(route: string, handler: (event: any) => void) {
    handlers.set(route, handler);
  }

  defineHandler('connection', (message: WithClientKeys<ConnectionMessage>) => {
    const event: BrowserConnectionEvent = message;
    relay.emitScriptEvent('connection', event);
  });

  defineHandler('console', (message: WithClientKeys<ConsoleMethodMessage>) => {
    const event: BrowserConsoleEvent = {
      type: 'console',
      argStrings: [],
      ...message,
    };
    const args = event.args.map(decodeUnserializableValue);
    // const argStrings = event.argStrings || [];
    const data: BrowserConsoleEvent = { ...event, type: 'console', args };
    relay.emitScriptEvent('console', data);
  });

  defineHandler('document', (message: WithClientKeys<DocumentMessage>) => {
    const event: BrowserDocumentEvent = message;
    relay.emitScriptEvent('document', event);
  });

  defineHandler(
    'error',
    (message: WithClientKeys<ErrorMessage | UnhandledRejectionMessage>) => {
      const event: BrowserErrorEvent = message;
      relay.emitScriptEvent('error', event);
    }
  );

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

type BrowserRelayRoute =
  | 'connection'
  | 'console'
  | 'document'
  | 'error'
  | 'window';

export function parseBrowserRelayMessage(
  serialized: string
): [BrowserRelayRoute, Message] | null {
  let value: unknown;
  try {
    value = parseCyclicJson(serialized);
  } catch (error) {
    if (error instanceof SyntaxError) return null;
    throw error;
  }
  if (!Array.isArray(value) || value.length !== 2) return null;
  const [route, data] = value;
  if (!isBrowserRelayRoute(route) || !isMessageForRoute(route, data)) {
    return null;
  }
  return [route, data];
}

function isBrowserRelayRoute(value: unknown): value is BrowserRelayRoute {
  return (
    typeof value === 'string' &&
    ['connection', 'console', 'document', 'error', 'window'].includes(value)
  );
}

function isMessageForRoute(
  route: BrowserRelayRoute,
  value: unknown
): value is Message {
  if (!isRecord(value)) return false;
  if (
    typeof value.clientId !== 'string' ||
    typeof value.url !== 'string' ||
    !isTimestamp(value.timestamp) ||
    (value.stack !== undefined && typeof value.stack !== 'string')
  ) {
    return false;
  }
  switch (route) {
    case 'connection':
      return value.type === 'opened';
    case 'console':
      return (
        typeof value.method === 'string' &&
        ['clear', 'debug', 'error', 'info', 'log', 'warn'].includes(
          value.method
        ) &&
        Array.isArray(value.args) &&
        (value.argStrings === undefined ||
          (Array.isArray(value.argStrings) &&
            value.argStrings.every(
              (item) => item === null || typeof item === 'string'
            )))
      );
    case 'document':
      return (
        value.type === 'visibilitychange' &&
        (value.visibilityState === 'hidden' ||
          value.visibilityState === 'visible')
      );
    case 'error':
      return (
        (value.type === 'error' || value.type === 'unhandledRejection') &&
        typeof value.message === 'string'
      );
    case 'window':
      return (
        value.type === 'DOMContentLoaded' ||
        value.type === 'load' ||
        value.type === 'pagehide'
      );
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isTimestamp(value: unknown): value is Message['timestamp'] {
  return (
    (typeof value === 'number' || typeof value === 'string') &&
    !Number.isNaN(new Date(value).valueOf())
  );
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
        (url) => relay.serverUrlToFileUrl(url) || url
      )
  );
}

export function injectScriptEventRelayScript(html: string): string {
  return addScriptsToHtmlHead(html, scriptEventRelayHeadScripts());
}

export function scriptEventRelayHeadScripts(): HtmlHeadScript[] {
  return [{ source: `${staticAssetPrefix}/console-relay.min.js` }];
}

const serializationPrefix = '__p5_server_serialization_:';

function decodeUnserializableValue(value: unknown): unknown {
  if (typeof value !== 'string' || !value.startsWith(serializationPrefix)) {
    return value;
  }
  switch (value.slice(serializationPrefix.length)) {
    case 'undefined':
      return undefined;
    case 'NaN':
      return Number.NaN;
    case '-Infinity':
      return Number.NEGATIVE_INFINITY;
    case 'Infinity':
      return Number.POSITIVE_INFINITY;
    default:
      return value;
  }
}

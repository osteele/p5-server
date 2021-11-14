import { jsonCycleStringifier } from '../jsonCycleStringifier';
import {
  ConsoleMethodName,
  ConnectionMessage,
  ConsoleMethodMessage,
  DocumentMessage,
  ErrorMessage,
  UnhandledRejectionMessage,
  WindowMessage,
  MessageCore
} from '../consoleRelayTypes';
const { stringify } = jsonCycleStringifier();

const serializationPrefix = '__p5_server_serialization_:';
const unserializablePrimitives = [undefined, NaN, -Infinity, Infinity];

// so we can use e.g savedMethods.debug() to debug the code in this file.
const savedMethods: Partial<Record<ConsoleMethodName, typeof console.log>> = new Object(
  null
);

const savedOnError = window.onerror;
window.onerror = (message, url, line, col, err) => {
  send('error', {
    type: 'error',
    message: message.toString(),
    url,
    line,
    col,
    stack: err && err.stack
  });
  return savedOnError ? savedOnError(message, url, line, col, err) : false;
};

window.addEventListener('unhandledrejection', event => {
  const reason = event.reason;
  send('error', {
    type: 'unhandledRejection',
    message: reason.message || String(reason),
    stack: reason.stack
  });
});

const consoleEventMethods: ConsoleMethodName[] = [
  'clear',
  'debug',
  'error',
  'info',
  'log',
  'warn'
];

Object.entries(console).forEach(([key, originalFn]) => {
  const method = key as ConsoleMethodName;
  if (!consoleEventMethods.includes(method)) return;
  function newFn(...args: unknown[]) {
    originalFn.apply(console, args);
    const argStrings = args.map(value =>
      value &&
      (typeof value === 'object' || typeof value === 'function') &&
      !Array.isArray(value) &&
      value &&
      typeof value.toString === 'function'
        ? value.toString()
        : null
    );
    while (argStrings.length && argStrings[argStrings.length - 1] === null) {
      argStrings.pop();
    }
    const payload: ConsoleMethodMessage = {
      method,
      args: args.map((value, i) => undefinedValueReplacer(i, value)),
      argStrings: argStrings.length ? argStrings : undefined,
      ...getSourceLocation()
    };
    send('console', payload);
  }
  savedMethods[method] = originalFn.bind(console);
  console[method] = newFn;
  newFn.displayName = originalFn.displayName;
  newFn.name = originalFn.name;
  newFn.length = originalFn.length;
});

function getSourceLocation() {
  const stack = new Error().stack;
  if (!stack) return {};

  const lines = stack.match(/\bhttps?:\/\/.+?(:\d+)?\/([^\s)]+)/g);
  if (!lines) return { stack };

  // find the first line that isn't from this file
  const urlMatcher = /^https?:\/\/[^:/]+?(:\d+)?\/[^:]+/;
  const firstUrl = lines.shift()?.match(urlMatcher)?.[0];
  const firstLine =
    firstUrl && lines.find(line => line.match(urlMatcher)?.[0] !== firstUrl);
  if (!firstLine) return { stack };

  const firstLineMatch = firstLine.match(/(.+?):(\d+):(\d+)/);
  return firstLineMatch
    ? {
        url: firstLineMatch[1],
        line: Number(firstLineMatch[2]),
        col: Number(firstLineMatch[3]),
        stack
      }
    : { url: firstLine, stack };
}

function undefinedValueReplacer(_key: unknown, value: any) {
  return unserializablePrimitives.includes(value) ? serializationPrefix + value : value;
}

const ws = new WebSocket('ws://' + window.location.host);
const q: (string | ArrayBufferView | ArrayBuffer | Blob)[] = [];

const clientId = Array.from(window.crypto.getRandomValues(new Uint32Array(2)))
  .map(n => n.toString(16))
  .join('-');

ws.onopen = () => {
  while (q.length) {
    ws.send(q.shift()!);
  }
};

function send(route: 'connection', message: ConnectionMessage): void;
function send(route: 'console', message: ConsoleMethodMessage): void;
function send(route: 'document', message: DocumentMessage): void;
function send(route: 'error', message: ErrorMessage | UnhandledRejectionMessage): void;
function send(route: 'window', message: WindowMessage): void;
function send(route: string, data: MessageCore) {
  const payload = stringify([
    route,
    Object.assign({ clientId, url: document.documentURI, timestamp: +new Date() }, data)
  ]);
  if (ws.readyState === 1 && !q.length) {
    ws.send(payload);
  } else {
    q.push(payload);
  }
}

document.addEventListener('visibilitychange', () => {
  send('document', {
    type: 'visibilitychange',
    visibilityState: document.visibilityState
  });
});

window.addEventListener('DOMContentLoaded', () => {
  send('window', { type: 'DOMContentLoaded' });
});

window.addEventListener('load', () => {
  send('window', { type: 'load' });
});

window.addEventListener(
  'pagehide',
  () => {
    send('window', { type: 'pagehide' });
  },
  false
);

send('connection', { type: 'opened' });

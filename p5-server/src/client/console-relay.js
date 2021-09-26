const serializationPrefix = '__p5_server_serialization_:';
const unserializablePrimitives = [undefined, NaN, -Infinity, Infinity];

// for debugging this module
const savedMethods = new Object(null);
const savedOnError = window.onerror;

window.onerror = (message, url, line, col, err) => {
  send('error', {
    type: 'error',
    message,
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

const consoleEventMethods = [
  'clear',
  'debug',
  'error',
  'info',
  'log',
  'warn',
];

Object.entries(console).forEach(([method, originalFn]) => {
  if (!consoleEventMethods.includes(method)) return;
  function newFn(...args) {
    originalFn.apply(console, args);
    const argStrings = args.map(value =>
      value && (typeof value === 'object' || typeof value === 'function') && !Array.isArray(value) && typeof value.toString === 'function'
        ? value.toString()
        : null);
    send('console', Object.assign({
      method,
      args: args.map((value, i) => undefinedValueReplacer(i, value)),
      argStrings,
    }, getSourceLocation()));
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
  const urlRe = /^https?:\/\/[^:/]+?(:\d+)?\/[^:]+/;
  const topUrl = lines.shift().match(urlRe)[0];
  const firstLine = lines.find(line => line.match(urlRe)[0] !== topUrl);
  if (!firstLine) return { stack };

  const m = firstLine.match(/(.+?):(\d+):(\d+)/);
  return m ? { url: m[1], line: Number(m[2]), col: Number(m[3]), stack } : { url: firstLine, stack }
}

function stringify(value) {
  try {
    return JSON.stringify(value);
  } catch (e) {
    if (e instanceof TypeError) {
      return stringifyCycle(value);
    } else {
      throw e;
    }
  }
}

function undefinedValueReplacer(_key, value) {
  return unserializablePrimitives.includes(value) ? serializationPrefix + value : value;
}

function stringifyCycle(value, replacer) {
  const seen = new Set();
  const defs = new Map();

  JSON.stringify(value, collector);
  seen.clear();
  return defs.size === 0
    ? JSON.stringify(value, replacer)
    : JSON.stringify({ '$__p5_server:circular': value }, cycleReplacer);

  function collector(_key, value) {
    if (value && (typeof value === 'object' || Array.isArray(value))) {
      if (defs.has(value)) {
        return undefined;
      } else if (seen.has(value)) {
        defs.set(value, defs.size);
        return undefined;
      } else {
        seen.add(value);
      }
    }
    return value;
  }

  function cycleReplacer(key, value) {
    if (value && (typeof value === 'object' || Array.isArray(value))) {
      if (key === '$__p5_server:def') {
        return value;
      } else if (seen.has(value)) {
        return { '$__p5_server:ref': defs.get(value) };
      } else if (defs.has(value)) {
        seen.add(value);
        return { '$__p5_server:def': value };
      }
    }
    return replacer ? replacer(key, value) : value;
  }
}

const ws = new WebSocket('ws://' + window.location.host);
const q = [];

const clientId =
  Array.from(window.crypto.getRandomValues(new Uint32Array(2)))
    .map(n => n.toString(16)).join('-');

ws.onopen = () => {
  while (q.length) {
    ws.send(q.shift());
  }
};

function send(route, data) {
  const payload = stringify([route,
    Object.assign({ clientId, url: document.documentURI, timestamp: +new Date() }, data)]);
  if (ws.readyState === 1 && !q.length) {
    ws.send(payload);
  } else {
    q.push(payload);
  }
}

send('connection', { type: 'opened' });
document.addEventListener('visibilitychange', () => { send('document', { type: 'visibilitychange', visibilityState: document.visibilityState }) });
window.addEventListener('DOMContentLoaded', () => { send('window', { type: 'DOMContentLoaded' }) });
window.addEventListener('load', () => { send('window', { type: 'load' }) });
window.addEventListener('pagehide', () => { send('window', { type: 'pagehide' }) }, false);

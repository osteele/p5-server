import path from 'node:path';
import vm from 'node:vm';
import { build } from 'esbuild';

test('the console relay starts, serializes BigInt, and bounds its pending queue', async () => {
  const result = await build({
    bundle: true,
    entryPoints: [path.resolve('src/client/console-relay.ts')],
    minify: true,
    write: false,
  });
  const code = result.outputFiles[0].text;
  const sockets: MockWebSocket[] = [];
  class MockWebSocket {
    static readonly CONNECTING = 0;
    static readonly OPEN = 1;
    onopen: (() => void) | null = null;
    readyState = 0;
    sent: unknown[] = [];

    constructor(_url: URL) {
      sockets.push(this);
    }

    send(value: unknown) {
      this.sent.push(value);
    }
  }
  const consoleMethods = Object.fromEntries(
    ['clear', 'debug', 'error', 'info', 'log', 'warn'].map((name) => [
      name,
      () => undefined,
    ])
  );
  const windowObject = {
    addEventListener: () => undefined,
    crypto: globalThis.crypto,
    location: { href: 'http://localhost:3000/' },
    onerror: null,
  };
  const documentObject = {
    addEventListener: () => undefined,
    documentURI: 'http://localhost:3000/sketch.js',
    visibilityState: 'visible',
  };

  vm.runInNewContext(code, {
    ArrayBuffer,
    BigInt,
    Blob,
    console: consoleMethods,
    document: documentObject,
    Object,
    TextEncoder,
    Uint32Array,
    URL,
    WebSocket: MockWebSocket,
    window: windowObject,
  });

  expect(sockets).toHaveLength(1);
  expect(() => consoleMethods.log(12n)).not.toThrow();
  const hostileToString = Object.defineProperty({}, 'toString', {
    get: () => {
      throw new Error('hostile toString getter');
    },
  });
  const hostileToJson = {
    toJSON: () => {
      throw new Error('hostile toJSON');
    },
  };
  expect(() => consoleMethods.log(hostileToString)).not.toThrow();
  expect(() => consoleMethods.log(hostileToJson)).not.toThrow();
  for (let i = 0; i < 2_000; i++) consoleMethods.log(i);
  for (let i = 0; i < 10; i++) consoleMethods.log('x'.repeat(250_000));
  consoleMethods.log('x'.repeat(1_100_000));
  const [socket] = sockets;
  socket.readyState = 1;
  socket.onopen?.();
  expect(socket.sent.length).toBeLessThanOrEqual(1_000);
  const sentBytes = socket.sent.reduce(
    (total, value) =>
      total + new TextEncoder().encode(String(value)).byteLength,
    0
  );
  expect(sentBytes).toBeLessThanOrEqual(1_000_000);
  const sentCount = socket.sent.length;
  consoleMethods.log('x'.repeat(1_100_000));
  expect(socket.sent).toHaveLength(sentCount);
  consoleMethods.log('small open-socket message');
  expect(socket.sent).toHaveLength(sentCount + 1);
  socket.readyState = 3;
  expect(() => consoleMethods.log('after close')).not.toThrow();
});

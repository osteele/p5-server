import net from 'node:net';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { WebSocket } from 'ws';
import { browserScriptRelayPath } from '../src/consoleRelayTypes';
import {
  parseBrowserRelayMessage,
  replaceUrlsInStack,
} from '../src/server/browserScriptEventRelay';
import { runCleanupTasks, Server } from '../src/server/Server';

describe('Server', () => {
  test('mount points', () => {
    let server = new Server();
    expect(server.mountPoints).toEqual([{ filePath: '.', urlPath: '/' }]);

    server = new Server({ root: 'mapped' });
    expect(server.mountPoints).toEqual([{ filePath: 'mapped', urlPath: '/' }]);

    server = new Server({ mountPoints: ['a'] });
    expect(server.mountPoints).toEqual([{ filePath: 'a', urlPath: '/a' }]);

    server = new Server({ mountPoints: ['a', 'b'] });
    expect(server.mountPoints).toEqual([
      { filePath: 'a', urlPath: '/a' },
      { filePath: 'b', urlPath: '/b' },
    ]);

    server = new Server({
      mountPoints: [
        { name: 'a', filePath: 'f1' },
        { name: 'b', filePath: 'f2' },
      ],
    });
    expect(server.mountPoints).toEqual([
      { name: 'a', filePath: 'f1', urlPath: '/a' },
      { name: 'b', filePath: 'f2', urlPath: '/b' },
    ]);

    server = new Server({
      mountPoints: [
        { name: 'a', filePath: 'f1' },
        { name: 'a', filePath: 'f2' },
      ],
    });
    expect(server.mountPoints).toEqual([
      { name: 'a', filePath: 'f1', urlPath: '/a' },
      { name: 'a', filePath: 'f2', urlPath: '/a-2' },
    ]);

    server = new Server({
      mountPoints: [
        { filePath: 'f1', urlPath: '/x-' },
        { filePath: 'f2', urlPath: '/x-' },
        { filePath: 'f3', urlPath: '/x-' },
      ],
    });
    expect(server.mountPoints.map(({ urlPath }) => urlPath)).toEqual([
      '/x-',
      '/x--2',
      '/x--3',
    ]);
  });

  test('filePathToUrl', () => {
    let server = new Server({ root: 'mapped' });
    expect(server.filePathToUrl('mapped/a')).toEqual('http://localhost:3000/a');
    expect(server.filePathToUrl('unmapped/a')).toBeNull();
    expect(server.filePathToUrl('mapped/../outside.js')).toBeNull();

    server = new Server({ root: 'mapped' });
    expect(server.filePathToUrl('mapped/a#b %.js')).toEqual(
      'http://localhost:3000/a%23b%20%25.js'
    );

    server = new Server({ root: './tests/testdata/circles.js' });
    expect(server.filePathToUrl('./tests/testdata/circles.js')).toEqual(
      'http://localhost:3000/circles.js'
    );

    server = new Server({ root: 'mapped' });
    server = new Server({
      mountPoints: [
        { filePath: 'f1', urlPath: '/p1' },
        { filePath: 'f2', urlPath: '/p2' },
      ],
    });
    expect(server.filePathToUrl('f1/a')).toEqual('http://localhost:3000/p1/a');
    expect(server.filePathToUrl('f2/a')).toEqual('http://localhost:3000/p2/a');
    expect(server.filePathToUrl('unmapped/a')).toBeNull();
  });

  test('urlPathToFilePath', () => {
    let server = new Server({ root: 'mapped' });
    expect(server.urlPathToFilePath('/a')).toEqual(path.join('mapped', 'a'));
    expect(server.urlPathToFilePath('/a%23b%20%25.js')).toEqual(
      path.join('mapped', 'a#b %.js')
    );
    expect(server.urlPathToFilePath('/%2e%2e/outside.js')).toBeNull();

    server = new Server({ root: 'mapped' });
    server = new Server({
      mountPoints: [
        { filePath: 'f1', urlPath: '/p1' },
        { filePath: 'f2', urlPath: '/p2' },
      ],
    });
    expect(server.urlPathToFilePath('/p1/a')).toEqual(path.join('f1', 'a'));
    expect(server.urlPathToFilePath('/p2/a')).toEqual(path.join('f2', 'a'));
    expect(server.urlPathToFilePath('/p3/a')).toBeNull();

    server = new Server({ root: './tests/testdata/circles.js' });
    expect(server.urlPathToFilePath('/circles.js')).toEqual(
      './tests/testdata/circles.js'
    );
  });

  test('serverUrlToFileUrl maps sketch files but not internal routes', () => {
    const server = new Server({ root: './tests/testdata/circles.js' });
    const circlesFileUrl = pathToFileURL(
      path.resolve('./tests/testdata/circles.js')
    ).href;

    expect(server.serverUrlToFileUrl('http://localhost:3000/circles.js')).toBe(
      circlesFileUrl
    );
    expect(
      server.serverUrlToFileUrl(
        'http://localhost:3000/__p5_proxy_cache/cdn.jsdelivr.net/p5.js'
      )
    ).toBeNull();
    expect(
      server.serverUrlToFileUrl('http://localhost:3000/circles.js?v=2#source')
    ).toBe(circlesFileUrl);
    expect(
      server.serverUrlToFileUrl(
        'http://localhost:3000/__p5_server_static/agent-support.min.js'
      )
    ).toBeNull();
  });

  test('should be able to start on loopback', async () => {
    const server = new Server({
      liveServer: false,
      port: 0,
      proxyCache: false,
      root: './tests/testdata',
    });
    try {
      await server.start();
      expect(server.server?.address()).toMatchObject({ address: '127.0.0.1' });
      expect(server.url).toMatch(/http:\/\/localhost:\d+/);

      const response = await fetch(server.url!);
      const text = await response.text();
      expect(text).toMatch(/<html/);
      expect(text).toMatch(/<title>testdata<\/title>/);
      expect(text).toMatch(/circles\.js/);
    } finally {
      await server.close();
    }
  });

  test('passes live reload paths to a host-provided file watcher', async () => {
    let watchedPaths: readonly string[] = [];
    let disposed = false;
    const server = new Server({
      fileWatchProvider: (paths) => {
        watchedPaths = paths;
        return {
          dispose: () => {
            disposed = true;
          },
        };
      },
      port: 0,
      proxyCache: false,
      root: './tests/testdata',
    });
    try {
      await server.start();
      expect(watchedPaths).toContain('./tests/testdata');
    } finally {
      await server.close();
    }
    expect(disposed).toBe(true);
  });

  test('rejects starting the same instance twice', async () => {
    const server = new Server({
      liveServer: false,
      port: 0,
      proxyCache: false,
      root: './tests/testdata',
    });
    try {
      await server.start();
      await expect(server.start()).rejects.toThrow(/already started/);
    } finally {
      await server.close();
    }
  });

  test('close waits for an in-flight start and closes its resources', async () => {
    const server = new Server({
      liveServer: false,
      port: 0,
      root: './tests/testdata',
    });

    const starting = server.start();
    await server.close();
    await starting;

    expect(server.server).toBeNull();
    expect(server.url).toBeUndefined();
  });

  test('start rejects while close is still releasing resources', async () => {
    const server = await Server.start({
      liveServer: false,
      port: 0,
      root: './tests/testdata',
    });

    const closing = server.close();
    await expect(server.start()).rejects.toThrow(/already started/);
    await closing;
  });

  test('close owns sockets accepted during startup', async () => {
    const probe = net.createServer();
    await new Promise<void>((resolve, reject) => {
      probe.once('error', reject);
      probe.listen(0, '127.0.0.1', resolve);
    });
    const address = probe.address();
    if (!address || typeof address === 'string') {
      throw new Error('Expected the probe to listen on an IP port');
    }
    const port = address.port;
    await new Promise<void>((resolve, reject) =>
      probe.close((error) => (error ? reject(error) : resolve()))
    );

    const server = new Server({
      liveServer: false,
      port,
      proxyCache: false,
      root: './tests/testdata',
      scanPorts: false,
    });
    const starting = server.start();
    let socket: net.Socket | undefined;
    try {
      for (let attempt = 0; attempt < 50 && !socket; attempt++) {
        socket = await new Promise<net.Socket | undefined>((resolve) => {
          const candidate = net.createConnection(port, '127.0.0.1');
          candidate.once('connect', () => resolve(candidate));
          candidate.once('error', () => {
            candidate.destroy();
            resolve(undefined);
          });
        });
        if (!socket) await new Promise((resolve) => setTimeout(resolve, 2));
      }
      expect(socket).toBeDefined();
      await starting;
      await server.close();
      expect(server.server).toBeNull();
    } finally {
      socket?.destroy();
      await server.close();
    }
  });

  test('startup rejects invalid directory-listing configuration', async () => {
    await expect(
      Server.start({
        liveServer: false,
        port: 0,
        proxyCache: false,
        root: './tests/testdata',
        theme: 'missing-theme',
      })
    ).rejects.toThrow();
  });

  test('close terminates active browser-relay sockets', async () => {
    const server = await Server.start({
      liveServer: false,
      port: 0,
      proxyCache: false,
      root: './tests/testdata',
    });
    const socket = new WebSocket(
      server.url!.replace(/^http/, 'ws') + browserScriptRelayPath
    );
    await new Promise<void>((resolve, reject) => {
      socket.once('open', resolve);
      socket.once('error', reject);
    });
    const socketClosed = new Promise<void>((resolve) => {
      socket.once('close', () => resolve());
    });

    await server.close();
    await socketClosed;

    expect(socket.readyState).toBe(WebSocket.CLOSED);
  });

  test('cleanup attempts every resource when one close fails', async () => {
    const attempted: string[] = [];
    await expect(
      runCleanupTasks([
        () => {
          attempted.push('http');
          throw new Error('http close failed');
        },
        async () => {
          attempted.push('relay');
        },
        () => {
          attempted.push('live reload');
        },
      ])
    ).rejects.toThrow('http close failed');
    expect(attempted).toEqual(['http', 'relay', 'live reload']);
  });

  test('cleanup reports multiple failures after attempting every resource', async () => {
    const attempted: string[] = [];
    let failure: unknown;
    try {
      await runCleanupTasks([
        () => {
          attempted.push('http');
          throw new Error('http close failed');
        },
        async () => {
          attempted.push('relay');
          throw new Error('relay close failed');
        },
        () => {
          attempted.push('live reload');
        },
      ]);
    } catch (error) {
      failure = error;
    }
    expect(attempted).toEqual(['http', 'relay', 'live reload']);
    expect(failure).toBeInstanceOf(AggregateError);
    expect((failure as AggregateError).errors).toHaveLength(2);
  });

  test('startup rollback preserves its failure and attempts every cleanup', async () => {
    const startupFailure = new Error('watcher startup failed');
    const relayFailure = new Error('relay close failed');
    const attempted: string[] = [];
    let failure: unknown;
    try {
      await runCleanupTasks(
        [
          () => {
            attempted.push('relay');
            throw relayFailure;
          },
          () => {
            attempted.push('http');
          },
        ],
        [startupFailure],
        'Server startup and rollback did not complete cleanly'
      );
    } catch (error) {
      failure = error;
    }

    expect(attempted).toEqual(['relay', 'http']);
    expect(failure).toBeInstanceOf(AggregateError);
    expect((failure as AggregateError).errors).toEqual([
      startupFailure,
      relayFailure,
    ]);
  });
});

describe('script event relay', () => {
  test('rejects malformed and incorrectly shaped messages', () => {
    expect(parseBrowserRelayMessage('{')).toBeNull();
    expect(parseBrowserRelayMessage('{}')).toBeNull();
    expect(parseBrowserRelayMessage('["console", null]')).toBeNull();
    expect(
      parseBrowserRelayMessage(
        JSON.stringify([
          'console',
          {
            clientId: 'client',
            url: 'http://localhost/sketch.js',
            timestamp: Date.now(),
            method: 'log',
            args: 'not an array',
          },
        ])
      )
    ).toBeNull();
  });

  test('accepts a valid message', () => {
    const data = {
      clientId: 'client',
      url: 'http://localhost/sketch.js',
      timestamp: Date.now(),
      method: 'log',
      args: ['hello'],
    };
    expect(parseBrowserRelayMessage(JSON.stringify(['console', data]))).toEqual(
      ['console', data]
    );
  });

  test('rejects oversized messages before parsing them', () => {
    expect(parseBrowserRelayMessage(' '.repeat(1_000_001))).toBeNull();
  });

  test('replaceUrlsInStack', () => {
    const relay = {
      emitScriptEvent() {
        return null;
      },
      filePathToUrl() {
        return null;
      },
      urlPathToFilePath() {
        return null;
      },
      serverUrlToFileUrl(url: string) {
        return url.replace(
          'http://localhost:3000/console.js',
          'file:///console.js'
        );
      },
    };

    // Safari
    expect(
      replaceUrlsInStack(
        relay,
        '@http://localhost:3000/__p5_server_static/console-relay.min.js:1:1401\n' +
          's@http://localhost:3000/__p5_server_static/console-relay.min.js:1:1740\n' +
          'setup@http://localhost:3000/console.js:6:15\n' +
          '@https://cdn.jsdelivr.net/npm/p5@1.4/lib/p5.min.js:3:423977\n' +
          '@https://cdn.jsdelivr.net/npm/p5@1.4/lib/p5.min.js:3:422877\n' +
          '_@https://cdn.jsdelivr.net/npm/p5@1.4/lib/p5.min.js:3:426806\n' +
          '@https://cdn.jsdelivr.net/npm/p5@1.4/lib/p5.min.js:3:415296\n' +
          'promiseReactionJob@[native code]'
      )
    ).toBe(
      'setup@file:///console.js:6:15\n' +
        '@https://cdn.jsdelivr.net/npm/p5@1.4/lib/p5.min.js:3:423977\n' +
        '@https://cdn.jsdelivr.net/npm/p5@1.4/lib/p5.min.js:3:422877\n' +
        '_@https://cdn.jsdelivr.net/npm/p5@1.4/lib/p5.min.js:3:426806\n' +
        '@https://cdn.jsdelivr.net/npm/p5@1.4/lib/p5.min.js:3:415296\n' +
        'promiseReactionJob@[native code]'
    );

    // Chrome
    expect(
      replaceUrlsInStack(
        relay,
        'Error\n' +
          '    at http://localhost:3000/__p5_server_static/console-relay.min.js:1:1392\n' +
          '    at console.s [as info] (http://localhost:3000/__p5_server_static/console-relay.min.js:1:1740)\n' +
          '    at setup (http://localhost:3000/console.js:14:11)\n' +
          '    at _setup (https://cdn.jsdelivr.net/npm/p5@1.4/lib/p5.min.js:3:423972)\n' +
          '    at _start (https://cdn.jsdelivr.net/npm/p5@1.4/lib/p5.min.js:3:422871)\n' +
          '    at new _ (https://cdn.jsdelivr.net/npm/p5@1.4/lib/p5.min.js:3:426800)\n' +
          '    at https://cdn.jsdelivr.net/npm/p5@1.4/lib/p5.min.js:3:415283'
      )
    ).toBe(
      'Error\n' +
        '    at setup (file:///console.js:14:11)\n' +
        '    at _setup (https://cdn.jsdelivr.net/npm/p5@1.4/lib/p5.min.js:3:423972)\n' +
        '    at _start (https://cdn.jsdelivr.net/npm/p5@1.4/lib/p5.min.js:3:422871)\n' +
        '    at new _ (https://cdn.jsdelivr.net/npm/p5@1.4/lib/p5.min.js:3:426800)\n' +
        '    at https://cdn.jsdelivr.net/npm/p5@1.4/lib/p5.min.js:3:415283'
    );
  });
});

import { EventEmitter, once } from 'node:events';
import { mkdir, mkdtemp, rm } from 'node:fs/promises';
import net from 'node:net';
import os from 'node:os';
import path from 'node:path';
import { createLiveReloadServer } from '../src/server/liveReload';

test('LiveReload retries an occupied port on loopback', async () => {
  const blocker = net.createServer();
  await new Promise<void>((resolve, reject) => {
    blocker.once('error', reject);
    blocker.listen(0, '127.0.0.1', resolve);
  });
  const address = blocker.address();
  if (!address || typeof address === 'string') {
    throw new Error('Expected the blocker to listen on an IP port');
  }

  const liveReloadServer = await createLiveReloadServer({
    host: '127.0.0.1',
    port: address.port,
    scanPorts: true,
  });
  try {
    const liveReloadAddress = liveReloadServer.server.address();
    expect(liveReloadAddress).toMatchObject({ address: '127.0.0.1' });
    expect(liveReloadAddress).not.toMatchObject({ port: address.port });
  } finally {
    liveReloadServer.close();
    await new Promise<void>((resolve, reject) => {
      blocker.close((err) => (err ? reject(err) : resolve()));
    });
  }
});

test('LiveReload watches all directories with one watcher', async () => {
  const tempDir = await mkdtemp(path.join(os.tmpdir(), 'p5-live-reload-test-'));
  const watchDirs = [path.join(tempDir, 'one'), path.join(tempDir, 'two')];
  await Promise.all(watchDirs.map((dir) => mkdir(dir)));

  const liveReloadServer = await createLiveReloadServer({
    port: 0,
    scanPorts: false,
    watchDirs,
  });
  const watcher = liveReloadServer.watcher as unknown as EventEmitter & {
    closed: boolean;
    getWatched(): Record<string, string[]>;
  };
  try {
    await once(watcher, 'ready');
    expect(Object.keys(watcher.getWatched())).toEqual(
      expect.arrayContaining(watchDirs)
    );
    liveReloadServer.close();
    expect(watcher.closed).toBe(true);
  } finally {
    if (!watcher.closed) liveReloadServer.close();
    await rm(tempDir, { force: true, recursive: true });
  }
});

test('LiveReload can use a host-provided file watcher', async () => {
  const watchDirs = ['/workspace/one', '/workspace/two'];
  let onDidChange: ((filePath: string) => void) | undefined;
  let disposeCount = 0;

  const liveReloadServer = await createLiveReloadServer({
    fileWatchProvider: (paths, callback) => {
      expect(paths).toEqual(watchDirs);
      onDidChange = callback;
      return {
        dispose: () => {
          disposeCount += 1;
        },
      };
    },
    port: 0,
    scanPorts: false,
    watchDirs,
  });
  const refreshedPaths: string[] = [];
  liveReloadServer.refresh = (filePath) => {
    refreshedPaths.push(filePath);
  };

  expect(liveReloadServer.watcher).toBeUndefined();
  expect(onDidChange).toBeDefined();
  onDidChange?.('/workspace/one/sketch.js');
  expect(refreshedPaths).toEqual(['/workspace/one/sketch.js']);

  liveReloadServer.close();
  expect(disposeCount).toBe(1);
});

test('LiveReload closes its listener when watcher disposal throws', async () => {
  const liveReloadServer = await createLiveReloadServer({
    fileWatchProvider: () => ({
      dispose: () => {
        throw new Error('watcher disposal failed');
      },
    }),
    host: '127.0.0.1',
    port: 0,
    scanPorts: false,
    watchDirs: ['/workspace'],
  });
  const address = liveReloadServer.server.address();
  if (!address || typeof address === 'string') {
    throw new Error('Expected LiveReload to listen on an IP port');
  }

  expect(() => liveReloadServer.close()).toThrow('watcher disposal failed');

  const rebound = net.createServer();
  try {
    await new Promise<void>((resolve, reject) => {
      rebound.once('error', reject);
      rebound.listen(address.port, '127.0.0.1', resolve);
    });
  } finally {
    await new Promise<void>((resolve, reject) =>
      rebound.close((error) => (error ? reject(error) : resolve()))
    );
  }
});

test('LiveReload closes its listener when a file-watch provider throws', async () => {
  const portProbe = net.createServer();
  await new Promise<void>((resolve, reject) => {
    portProbe.once('error', reject);
    portProbe.listen(0, '127.0.0.1', resolve);
  });
  const address = portProbe.address();
  if (!address || typeof address === 'string') {
    throw new Error('Expected the probe to listen on an IP port');
  }
  const port = address.port;
  await new Promise<void>((resolve, reject) =>
    portProbe.close((error) => (error ? reject(error) : resolve()))
  );

  await expect(
    createLiveReloadServer({
      fileWatchProvider: () => {
        throw new Error('watcher failed');
      },
      host: '127.0.0.1',
      port,
      scanPorts: false,
      watchDirs: ['/workspace'],
    })
  ).rejects.toThrow('watcher failed');

  const rebound = net.createServer();
  try {
    await new Promise<void>((resolve, reject) => {
      rebound.once('error', reject);
      rebound.listen(port, '127.0.0.1', resolve);
    });
  } finally {
    await new Promise<void>((resolve, reject) =>
      rebound.close((error) => (error ? reject(error) : resolve()))
    );
  }
});

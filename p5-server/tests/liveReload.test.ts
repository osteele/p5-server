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

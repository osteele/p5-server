import net from 'node:net';
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

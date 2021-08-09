import fetch from 'node-fetch';
import { Server } from '../src/server/Server';

test.skip('Server', async () => {
  const server = new Server({ root: './tests/testdata' });
  await server.start();
  expect(server.url).toMatch(/http:\/\/localhost:\d+/);

  let req = await fetch(server.url!);
  let text = await req.text();
  expect(text).toMatch(/<html/);
  expect(text).toMatch(/Sketches/);

  await server.stop();
});

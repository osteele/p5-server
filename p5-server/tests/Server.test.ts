import fetch from 'node-fetch';
import { replaceUrlsInStack } from '../src/server/browserScriptEventRelay';
import { Server } from '../src/server/Server';

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
  });

  test('filePathToUrl', () => {
    let server = new Server({ root: 'mapped' });
    expect(server.filePathToUrl('mapped/a')).toEqual('http://localhost:3000/a');
    expect(server.filePathToUrl('unmapped/a')).toBeNull();

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
    expect(server.urlPathToFilePath('/a')).toEqual('mapped/a');

    server = new Server({ root: 'mapped' });
    server = new Server({
      mountPoints: [
        { filePath: 'f1', urlPath: '/p1' },
        { filePath: 'f2', urlPath: '/p2' },
      ],
    });
    expect(server.urlPathToFilePath('/p1/a')).toEqual('f1/a');
    expect(server.urlPathToFilePath('/p2/a')).toEqual('f2/a');
    expect(server.urlPathToFilePath('/p3/a')).toBeNull();
  });

  test.skip('should be able to start', async () => {
    const server = new Server({ root: './tests/testdata' });
    await server.start();
    expect(server.url).toMatch(/http:\/\/localhost:\d+/);

    let req = await fetch(server.url!);
    let text = await req.text();
    expect(text).toMatch(/<html/);
    expect(text).toMatch(/Sketches/);

    await server.close();
  });
});

describe('script event relay', () => {
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
        return url.replace('http://localhost:3000/console.js', 'file:///console.js');
      },
    };

    // Safari
    expect(
      replaceUrlsInStack(
        relay,
        '@http://localhost:3000/__p5_server_static/console-relay.min.js:1:1401\n' +
          's@http://localhost:3000/__p5_server_static/console-relay.min.js:1:1740\n' +
          'setup@http://localhost:3000/console.js:6:15\n' +
          '@https://cdn.jsdelivr.net/npm/p5@1.4.0/lib/p5.min.js:3:423977\n' +
          '@https://cdn.jsdelivr.net/npm/p5@1.4.0/lib/p5.min.js:3:422877\n' +
          '_@https://cdn.jsdelivr.net/npm/p5@1.4.0/lib/p5.min.js:3:426806\n' +
          '@https://cdn.jsdelivr.net/npm/p5@1.4.0/lib/p5.min.js:3:415296\n' +
          'promiseReactionJob@[native code]'
      )
    ).toBe(
      'setup@file:///console.js:6:15\n' +
        '@https://cdn.jsdelivr.net/npm/p5@1.4.0/lib/p5.min.js:3:423977\n' +
        '@https://cdn.jsdelivr.net/npm/p5@1.4.0/lib/p5.min.js:3:422877\n' +
        '_@https://cdn.jsdelivr.net/npm/p5@1.4.0/lib/p5.min.js:3:426806\n' +
        '@https://cdn.jsdelivr.net/npm/p5@1.4.0/lib/p5.min.js:3:415296\n' +
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
          '    at _setup (https://cdn.jsdelivr.net/npm/p5@1.4.0/lib/p5.min.js:3:423972)\n' +
          '    at _start (https://cdn.jsdelivr.net/npm/p5@1.4.0/lib/p5.min.js:3:422871)\n' +
          '    at new _ (https://cdn.jsdelivr.net/npm/p5@1.4.0/lib/p5.min.js:3:426800)\n' +
          '    at https://cdn.jsdelivr.net/npm/p5@1.4.0/lib/p5.min.js:3:415283'
      )
    ).toBe(
      'Error\n' +
        '    at setup (file:///console.js:14:11)\n' +
        '    at _setup (https://cdn.jsdelivr.net/npm/p5@1.4.0/lib/p5.min.js:3:423972)\n' +
        '    at _start (https://cdn.jsdelivr.net/npm/p5@1.4.0/lib/p5.min.js:3:422871)\n' +
        '    at new _ (https://cdn.jsdelivr.net/npm/p5@1.4.0/lib/p5.min.js:3:426800)\n' +
        '    at https://cdn.jsdelivr.net/npm/p5@1.4.0/lib/p5.min.js:3:415283'
    );
  });
});

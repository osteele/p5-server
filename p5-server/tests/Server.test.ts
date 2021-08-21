import fetch from 'node-fetch';
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
      { filePath: 'b', urlPath: '/b' }
    ]);

    server = new Server({
      mountPoints: [
        { name: 'a', filePath: 'f1' },
        { name: 'b', filePath: 'f2' }
      ]
    });
    expect(server.mountPoints).toEqual([
      { name: 'a', filePath: 'f1', urlPath: '/a' },
      { name: 'b', filePath: 'f2', urlPath: '/b' }
    ]);

    server = new Server({
      mountPoints: [
        { name: 'a', filePath: 'f1' },
        { name: 'a', filePath: 'f2' }
      ]
    });
    expect(server.mountPoints).toEqual([
      { name: 'a', filePath: 'f1', urlPath: '/a' },
      { name: 'a', filePath: 'f2', urlPath: '/a-2' }
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
        { filePath: 'f2', urlPath: '/p2' }
      ]
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
        { filePath: 'f2', urlPath: '/p2' }
      ]
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

    await server.stop();
  });
});

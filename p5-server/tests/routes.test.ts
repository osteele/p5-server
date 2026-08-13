import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { Server } from '../src/server/Server';

describe('Express routes', () => {
  let server: Server;

  beforeAll(async () => {
    server = await Server.start({
      liveServer: false,
      port: 0,
      proxyCache: false,
      root: './tests/testdata',
    });
  });

  afterAll(async () => {
    await server.close();
  });

  test('serves HTML documents through the HTML route', async () => {
    const response = await request('/non-sketch.html', 'text/html');

    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toContain('text/html');
    expect(await response.text()).toContain('<title>Not a sketch</title>');
  });

  test('renders JavaScript-only sketches as HTML', async () => {
    const response = await request('/circles.js', 'text/html');
    const html = await response.text();

    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toContain('text/html');
    expect(html).toContain('<script src="./circles.js"');
    expect(html).toContain('https://cdn.jsdelivr.net/npm/p5@2.3/lib/p5.min.js');
  });

  test('serves the effective library catalog', async () => {
    const response = await request(
      '/__p5_server/api/libraries',
      'application/json'
    );
    const catalog = await response.json();

    expect(response.status).toBe(200);
    expect(catalog.p5Version).toBe('2.3');
    expect(catalog.libraries).toEqual(
      expect.arrayContaining([expect.objectContaining({ name: 'p5.brush' })])
    );
    expect(catalog.excluded).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          library: expect.objectContaining({ name: 'p5.asciify' }),
          reason: 'archived',
        }),
      ])
    );
  });

  test('renders JavaScript source on request', async () => {
    const response = await request('/circles.js?fmt=view', 'text/html');
    const html = await response.text();

    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toContain('text/html');
    expect(html).toContain('function setup()');
    expect(html).toContain('<title>circles.js</title>');
  });

  test('renders Markdown documents as HTML', async () => {
    const response = await request('/README.md', 'text/html');
    const html = await response.text();

    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toContain('text/html');
    expect(html).toContain('<h1>Test Cases</h1>');
    expect(html).toContain('<code class="language-js">');
    expect(html).toContain('<span class="hljs-keyword">');
  });

  test('falls through to static files for non-HTML requests', async () => {
    const response = await request('/circles.js', 'text/javascript');

    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toContain('text/javascript');
    expect(await response.text()).toContain('function setup()');
  });

  test('rejects static files reached through a symlink outside the root', async () => {
    const tempDir = fs.mkdtempSync(
      path.join(os.tmpdir(), 'p5-server-static-root-test-')
    );
    const root = path.join(tempDir, 'root');
    const outside = path.join(tempDir, 'outside');
    fs.mkdirSync(root);
    fs.mkdirSync(outside);
    fs.writeFileSync(path.join(outside, 'secret.txt'), 'outside');
    fs.symlinkSync(outside, path.join(root, 'linked'));
    const isolatedServer = await Server.start({
      liveServer: false,
      port: 0,
      proxyCache: false,
      root,
    });
    try {
      const response = await fetch(`${isolatedServer.url}/linked/secret.txt`);
      expect(response.status).toBe(403);
    } finally {
      await isolatedServer.close();
      fs.rmSync(tempDir, { force: true, recursive: true });
    }
  });

  test('redirects directory requests to a trailing slash', async () => {
    const response = await fetch(`${server.url}/collection`, {
      headers: { accept: 'text/html' },
      redirect: 'manual',
    });

    expect(response.status).toBe(302);
    expect(response.headers.get('location')).toBe('/collection/');
  });

  test('injects agent support into a sketch directory index', async () => {
    const agentServer = await Server.start({
      agentSupport: { seed: 42 },
      liveServer: false,
      port: 0,
      proxyCache: false,
      root: './tests/testdata/single-sketch-directory',
    });
    try {
      const response = await fetch(agentServer.url!, {
        headers: { accept: 'text/html' },
      });
      const html = await response.text();

      expect(html).toContain('__p5_server_agent_settings');
      expect(html).toContain('/__p5_server_static/agent-support.min.js');
      expect(html.indexOf('agent-support.min.js')).toBeLessThan(
        html.indexOf('sketch.js')
      );
    } finally {
      await agentServer.close();
    }
  });

  test('rejects screenshot frame numbers that are not integers', async () => {
    let receivedFrame = false;
    const screenshotServer = await Server.start({
      liveServer: false,
      port: 0,
      proxyCache: false,
      root: './tests/testdata/circles.js',
      screenshot: {
        onFrameData: () => {
          receivedFrame = true;
        },
      },
    });
    try {
      const response = await fetch(
        `${screenshotServer.url}/__p5_server/screenshot`,
        {
          body: JSON.stringify({
            dataURL: 'data:image/png;base64,AA==',
            frameNumber: '../../outside',
          }),
          headers: { 'content-type': 'application/json' },
          method: 'POST',
        }
      );
      expect(response.status).toBe(400);
      expect(receivedFrame).toBe(false);
    } finally {
      await screenshotServer.close();
    }
  });

  test('accepts only valid frames of the configured screenshot type', async () => {
    const receivedFrames: Buffer[] = [];
    const screenshotServer = await Server.start({
      liveServer: false,
      port: 0,
      proxyCache: false,
      root: './tests/testdata/circles.js',
      screenshot: {
        imageType: 'png',
        onFrameData: ({ data }) => {
          receivedFrames.push(data);
        },
      },
    });
    const post = (dataURL: string) =>
      fetch(`${screenshotServer.url}/__p5_server/screenshot`, {
        body: JSON.stringify({ dataURL, frameNumber: 0 }),
        headers: { 'content-type': 'application/json' },
        method: 'POST',
      });
    try {
      for (const invalid of [
        'data:image/jpeg;base64,/9j/2Q==',
        'data:image/png;base64,not-base64!!!',
        'data:image/png;base64,',
        'data:image/png;base64,/9j/2Q==',
      ]) {
        expect((await post(invalid)).status).toBe(400);
      }
      expect(receivedFrames).toHaveLength(0);

      const validPng =
        'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=';
      expect((await post(validPng)).status).toBe(200);
      expect(receivedFrames).toHaveLength(1);
      expect(receivedFrames[0].subarray(1, 4).toString()).toBe('PNG');
    } finally {
      await screenshotServer.close();
    }
  });

  function request(path: string, accept: string): Promise<Response> {
    return fetch(`${server.url}${path}`, { headers: { accept } });
  }
});

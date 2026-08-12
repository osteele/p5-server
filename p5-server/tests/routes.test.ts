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
    expect(html).toContain('https://cdn.jsdelivr.net/npm/p5@');
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

  function request(path: string, accept: string): Promise<Response> {
    return fetch(`${server.url}${path}`, { headers: { accept } });
  }
});

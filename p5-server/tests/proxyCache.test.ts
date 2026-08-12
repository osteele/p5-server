import stream from 'node:stream';
import { transformHtml } from '../src/helpers';
import { cdnProxyRouter, isCdnUrl, proxyCdnUrl } from '../src/server/cdnProxy';

describe('CDN Proxy', () => {
  test('recognizes only configured CDN URLs', () => {
    expect(isCdnUrl('https://cdn.jsdelivr.net/npm/p5@1.4/lib/p5.min.js')).toBe(
      true
    );
    expect(isCdnUrl('https://example.com/npm/p5@1.4.0/lib/p5.min.js')).toBe(
      false
    );
    expect(isCdnUrl('/npm/p5@1.4.0/lib/p5.min.js')).toBe(false);
    expect(isCdnUrl('ftp://cdn.jsdelivr.net/npm/p5@1.4.0/lib/p5.min.js')).toBe(
      false
    );
  });

  test('rewrites configured CDN URLs during a shared HTML transform', () => {
    const html = transformHtml(
      '<script src="https://cdn.jsdelivr.net/npm/p5@1.4/lib/p5.min.js"></script>',
      { transformUrl: proxyCdnUrl }
    );

    expect(html).toContain(
      'src="/__p5_proxy_cache/cdn.jsdelivr.net/npm/p5@1.4/lib/p5.min.js"'
    );
  });

  test('requests identity encoding and refuses URLs outside the configured CDNs', async () => {
    const request = {
      headers: { 'accept-encoding': 'gzip, deflate, br, zstd' },
      path: '127.0.0.1/private',
      query: {},
    };
    const response = new (class extends stream.Writable {
      body = '';
      statusCode = 200;

      setHeader() {}
      send(chunk: string | Buffer) {
        this.body += chunk.toString();
      }
      status(code: number) {
        this.statusCode = code;
      }
      _write(_chunk: unknown, _encoding: BufferEncoding, callback: () => void) {
        callback();
      }
    })();

    await cdnProxyRouter(request, response);

    expect(request.headers['accept-encoding']).toBe('identity');
    expect(response.statusCode).toBe(403);
    expect(response.body).toContain('Refusing to proxy URL');
  });
});

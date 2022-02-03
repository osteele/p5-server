import { contentProxyCache, isCdnUrl } from '../src/server/cdnProxy';

describe('CDN Proxy', () => {
  const { decodeProxyPath, encodeProxyPath } = contentProxyCache;

  describe('isCdnUrl', () => {
    test('accepts CDN urls', () => {
      expect(isCdnUrl('https://cdn.jsdelivr.net/npm/p5@1.4/lib/p5.min.js')).toBe(
        true
      );
    });

    test.skip('accepts Library import paths', () => {
      expect(isCdnUrl('https://cdn.jsdelivr.net/npm/p5@1.4/lib/p5.min.js')).toBe(
        false
      );
    });

    test('rejects other urls', () => {
      expect(isCdnUrl('https://example.com/npm/p5@1.4.0/lib/p5.min.js')).toBe(false);
      expect(isCdnUrl('/npm/p5@1.4.0/lib/p5.min.js')).toBe(false);
      expect(isCdnUrl('ftp://cdn.jsdelivr.net/npm/p5@1.4.0/lib/p5.min.js')).toBe(false);
    });
  });

  describe('encodeProxyPath', () => {
    test('encodes CDN URL', () => {
      expect(
        encodeProxyPath('https://cdn.jsdelivr.net/npm/p5@1.4/lib/p5.min.js')
      ).toBe('/__p5_proxy_cache/cdn.jsdelivr.net/npm/p5@1.4/lib/p5.min.js');
    });

    test('ignores relative URLs', () => {
      expect(encodeProxyPath('/npm/p5@1.4.0/lib/p5.min.js')).toBe(
        '/npm/p5@1.4.0/lib/p5.min.js'
      );
    });

    test('ignores other schemas', () => {
      expect(encodeProxyPath('ftp://cdn.jsdelivr.net/npm/p5@1.4.0/lib/p5.min.js')).toBe(
        'ftp://cdn.jsdelivr.net/npm/p5@1.4.0/lib/p5.min.js'
      );
    });

    test('encodes query parameters', () => {
      expect(
        encodeProxyPath('https://cdn.jsdelivr.net/npm/p5@1.4/lib/p5.min.js?a=1&b=2')
      ).toBe(
        '/__p5_proxy_cache/cdn.jsdelivr.net/npm/p5@1.4/lib/p5.min.js?search=a%3D1%26b%3D2'
      );
    });

    test('preserves hashes', () => {
      expect(
        encodeProxyPath('https://cdn.jsdelivr.net/npm/p5@1.4/lib/p5.min.js#hash')
      ).toBe('/__p5_proxy_cache/cdn.jsdelivr.net/npm/p5@1.4/lib/p5.min.js#hash');
      expect(
        encodeProxyPath(
          'https://cdn.jsdelivr.net/npm/p5@1.4/lib/p5.min.js?a=1&b=2#hash'
        )
      ).toBe(
        '/__p5_proxy_cache/cdn.jsdelivr.net/npm/p5@1.4/lib/p5.min.js?search=a%3D1%26b%3D2#hash'
      );
    });
  });

  describe('decodeProxyPath', () => {
    function testRoundtripEquality(originUrl) {
      const encodedPath = encodeProxyPath(originUrl);
      let pathWithoutQuery = encodedPath;
      let query = {};
      // if (encodedPath.includes('?')) {
      //   const [pʹ, queryString, hash] = encodedPath.match(/(.+)\?(.+)(#.*)?/).slice(1);
      //   pathWithoutQuery = pʹ + (hash || '');
      //   query = Object.fromEntries(new URLSearchParams(queryString));
      // }
      expect(decodeProxyPath(pathWithoutQuery, query)).toBe(originUrl);
    }

    test('decodes CDN URL', () =>
      testRoundtripEquality('https://cdn.jsdelivr.net/npm/p5@1.4/lib/p5.min.js'));

    test('decodes query parameters', () =>
      testRoundtripEquality(
        'https://cdn.jsdelivr.net/npm/p5@1.4/lib/p5.min.js?a=1&b=2'
      ));

    test('preserves hashes', () => {
      testRoundtripEquality('https://cdn.jsdelivr.net/npm/p5@1.4/lib/p5.min.js#hash');
      testRoundtripEquality(
        'https://cdn.jsdelivr.net/npm/p5@1.4/lib/p5.min.js?a=1&b=2#hash'
      );
    });

    test('preserves scheme', () => {
      testRoundtripEquality('https://cdn.jsdelivr.net/npm/p5@1.4/lib/p5.min.js');
      testRoundtripEquality('http://cdn.jsdelivr.net/npm/p5@1.4.0/lib/p5.min.js');
    });
  });
});

import express = require('express');
import * as cacache from 'cacache';
import * as csstree from 'css-tree';
import { parse as parseCss } from 'css-tree';
import fetch from 'node-fetch';
import { parse as parseHtml } from 'node-html-parser';
import stream, { Readable } from 'stream';
import zlib from 'zlib';
import { isDefined } from '../ts-extras';
import path = require('path');
import assert = require('assert');

// eslint-disable-next-line @typescript-eslint/no-var-requires
const debug = require('debug')('p5-server:cdnProxy');

//#region exported types
export type ProxyCacheOptions = {
  cachePath: string;
  cacheSeeds: string[];
  proxyPrefix: string;
  shouldProxyPath: (url: string) => boolean;
};

export type ProxyCache = {
  // property
  cachePath: string;

  // methods
  router: (req: RequestI, res: ResponseI) => Promise<void>;
  replaceUrlsInHtml: (html: string) => string;

  // cache management methods
  clear: () => Promise<void>;
  warm: (options: {
    force?: boolean | undefined; // if true, re-fetch all entries from the network
  }, callback?: ((message: CacheWarmMessage) => void) | undefined) => Promise<CacheWarmStats>;
  ls: typeof cacachelsBind;

  // private methods; exported for unit testing
  decodeProxyPath: (url: string, query: RequestI['query']) => string,
  encodeProxyPath: (url: string) => string,
};

export type CacheWarmStats = {
  total: number;
  failures: number;
  hits: number;
  misses: number;
};

export type CacheWarmMessage =
  | { type: 'initial', total: number }
  | { type: 'prefetch', url: string }
  | { type: 'error', url: string, status: number }
  | { type: 'progress', stats: CacheWarmStats };
//#endregion

export const HTTP_RESPONSE_HEADER_CACHE_STATUS = 'x-p5-server-cache-hit';

// Response headers that should not be stored in the cache.
const uncacheableResponseHeaders = [
  'accept-ranges', 'age', 'connection', 'content-accept-ranges',
  'content-length', 'strict-transport-security', 'transfer-encoding', 'vary'];

// Request headers that are passed through to the proxied request. Other headers
// are ignored, in order to assure that the cached response can be shared
// between different requests.
const headerAcceptList = ['accept', 'user-agent', 'accept-language', 'accept-encoding'];

// A dummy function used with typeof to derive the type of the bound method.
const cacachelsBind = () => cacache.ls('cachePath');

// The RequestI and ReponseI interfaces specify the part of express.Request and
// express.Response that cdnProxyRouter uses. It is done this way so that
// prefetch, which is used to warm the cache, can call cdnProxyRouter instead of
// using separate logic to test and populate the cache.

/** The express.Request properties that cdnProxyRouter depends on. */
interface RequestI {
  headers: typeof express.request.headers;
  path: typeof express.request.path;
  query: typeof express.request.query;
}

/** The express.Response properties that cdnProxyRouter depends on. */
interface ResponseI extends NodeJS.WritableStream {
  setHeader(key: string, value: string | number | readonly string[]): void;
  send(chunk: string | Buffer): void;
  status(code: number): void;
}

class NullWritable extends stream.Writable {
  /* eslint-disable @typescript-eslint/no-empty-function */
  setHeader() { }
  send() { }
  status() { }
  _write() { }
  /* eslint-enable @typescript-eslint/no-empty-function */
}

export function createProxyCache({
  proxyPrefix,
  cachePath,
  cacheSeeds,
  shouldProxyPath: isCdnUrl,
}: ProxyCacheOptions): ProxyCache {
  return {
    cachePath,
    clear: () => cacache.rm.all(cachePath),
    router: cdnProxyRouter,
    replaceUrlsInHtml,
    warm: warmCache,
    ls: cacache.ls.bind(cacache, cachePath),
    // exported for unit testing:
    decodeProxyPath,
    encodeProxyPath
  };

  // Note that express.Request implements RequestI, and express.Response
  // implements ResponseI.
  //
  // This function uses the more general type to allow prefetch to call
  // cdnProxyRouter.
  async function cdnProxyRouter(req: RequestI, res: ResponseI): Promise<void> {
    const originUrl = decodeProxyPath(req.path, req.query);
    // An earlier version used a cryptographic digest of the stringified JSON;
    // however, the 'crypto' module is not present in VSCode.
    const cacheKey = JSON.stringify({
      url: originUrl,
      // Formally, the cache key should include the headers in the Vary response
      // header. In practice, this header only has at most the following keys;
      // and, it is harmless to vary on them even when they aren't specified.
      //
      // Do NOT cache on User-Agent. It is not necessary for the supported CDNs,
      // and it would bust the cache between different browsers, which is
      // undesireable for offline development.
      accept: req.headers['accept'],
      acceptCh: req.headers['accept-ch'],
      acceptEncoding: req.headers['accept-encoding'],
      acceptLanguage: req.headers['accept-language'],
    });
    const cacheObject = await cacache.get.info(cachePath, cacheKey);

    res.setHeader('x-p5-server-origin-url', originUrl);

    // Cache hit. This can fall through to the cache miss case if the cached
    // value is present (in which case this value is send to the original
    // response) but expired (in which case the request is also sent to the
    // origin server and, if succesful, asynchronously used to replace the
    // cached value).
    if (cacheObject && !req.query.reload) {
      debug('cache hit', originUrl);
      res.setHeader(HTTP_RESPONSE_HEADER_CACHE_STATUS, 'HIT');

      // Copy the cached headers to the response.
      const { headers } = cacheObject.metadata;
      for (const key of Object.keys(headers)) {
        let value = headers[key];
        switch (key) {
          case 'location':
            if (isCdnUrl(value)) {
              value = encodeProxyPath(value);
            }
            break;
          case 'cache-control':
            continue;
        }
        const headerMap: Record<string, string> = { server: 'origin-server' };
        res.setHeader(headerMap[key] ?? key, value);
      }
      // Add the Age and Cache-Control headers.
      {
        const age = Math.max(0, (+new Date()) - cacheObject.time);
        res.setHeader('age', Math.floor(age / 1000));
      }
      {
        let cacheControl = headers['cache-control']?.match(/(?:^|\b)(public|private)\b/)?.[1] ?? 'public';
        const maxAge = headers['cache-control']?.match(/(?:^|\b)max-age=(\d+)/)?.[1];
        if (maxAge) {
          cacheControl += ', max-age=' + maxAge;
        }
        cacheControl += `, stale-while-revalidate=${maxAge || 86400}`;
        res.setHeader('cache-control', cacheControl);
      }

      res.status(cacheObject.metadata.status);
      let rstream = cacache.get.stream(cachePath, cacheKey);
      rstream = makeProxyReplacemenStream(rstream, headers['content-type'], headers['content-encoding'], originUrl);
      rstream.pipe(res);

      // Check for cache expiration.
      //
      // The maxAge value used here differs from the one above, that is used in
      // the HTTP response header, in that this one prefers the origin server's
      // s-maxage over max-age if the former exists.
      const maxAge = (
        headers['cache-control']?.match(/(?:%|\b)s-maxage=(\d+)/) ||
        headers['cache-control']?.match(/(?:%|\b)max-age=(\d+)/))?.[1] ?? 'Infinity';
      const expires = new Date(cacheObject.time + Number(maxAge) * 1000);
      const expired = expires < new Date();
      if (expired) {
        debug('cache expired', originUrl);
        // The response is complete. Replace the original response instance with one that simply ignores writes.
        // Using a null Writable reduces the number of code paths, below.
        res = new NullWritable();
      } else {
        await new Promise(resolve => res.on('finish', resolve));
        return;
      }
    }

    debug('proxy request for', originUrl);
    // filter the headers, and combine string[] values back into strings
    const reqHeaders: Record<string, string> = Object.fromEntries((Object.entries(req.headers)
      .filter(([key]) => headerAcceptList.includes(key))
      .filter(([_key, value]) => isDefined(value)) as [string, string | string[]][])
      .map(([key, value]) => [key, Array.isArray(value) ? value.join(',') : value]));
    const originResponse = await fetch(originUrl, {
      compress: false, // don't uncompress gzips — for efficiency, and so that the content matches the content-type
      headers: reqHeaders,
      redirect: 'manual', // don't follow redirects; cache the redirect directive instead
    });

    // Relay the origin status, and add a cache header
    res.status(originResponse.status);
    res.setHeader(HTTP_RESPONSE_HEADER_CACHE_STATUS, 'MISS');

    // Copy headers from the origin response to the output response.
    // Modify Location headers to proxy them, in the case of a redirect.
    originResponse.headers.forEach((value, key) => {
      if (key === 'location' && isCdnUrl(value)) {
        value = encodeProxyPath(value);
      }
      res.setHeader(key, value);
    });

    // This test excludes 300 Multiple Choice, since that status code is rarely
    // used in practice, and would require rewriting the links in the HTML
    // response.
    const redirected = 300 < originResponse.status && originResponse.status < 400 && originResponse.headers.has('location');
    if (!originResponse.ok && !redirected) {
      // don't cache responses other than 200's and redirects
      debug(`Failed ${originResponse.ok} | ${originResponse.status} | ${originResponse.statusText}`);
      res.send(originResponse.statusText);
      return;
    }

    // expressjs.Response.headers serializes to {}. Copy it to an Object that can
    // be serialized to JSON.
    const responseHeaders = Object.fromEntries(
      Array.from(originResponse.headers.entries())
        .filter(([key]) => !uncacheableResponseHeaders.includes(key))
    )
    const cacheWriteStream = cacache.put.stream(cachePath, cacheKey, {
      metadata: {
        originUrl,
        headers: responseHeaders,
        status: originResponse.status
      }
    });

    // pipe the origin response body to both the client response and the cache
    // write stream. Collect the length of the response for logging.
    const streamLengthCounter = new class extends stream.Writable {
      length = 0;
      _write(chunk: unknown, _encoding: BufferEncoding, callback: () => void) {
        if (typeof chunk === 'string' || chunk instanceof Buffer || chunk instanceof Uint8Array) {
          this.length += chunk.length;
        }
        callback();
      }
    }
    originResponse.body.pipe(multiplexStreamWriter([cacheWriteStream, streamLengthCounter]));
    makeProxyReplacemenStream(originResponse.body, responseHeaders['content-type'], responseHeaders['content-encoding'], originUrl).pipe(res);
    await new Promise(resolve => streamLengthCounter.on('finish', resolve));
    debug('wrote', streamLengthCounter.length, 'bytes to cache for', originUrl);
  }

  function makeProxyReplacemenStream(stream: NodeJS.ReadableStream, contentType: string, contentEncoding: string, base: string): NodeJS.ReadableStream {
    if (contentType.startsWith('text/css')) {
      return makeCssRewriterStream(stream, base, contentEncoding);
    }
    return stream;
  }

  //#region proxy paths

  // exported for unit testing
  function encodeProxyPath(originUrl: string, { includePrefix = true } = {}): string {
    if (!/^https?:/i.test(originUrl)) return originUrl;
    let proxyPath = originUrl;
    if (/\?/.test(originUrl)) {
      // package the entire query string into a single query parameter, so that other query parameters can be added to the
      // URL without breaking the cache
      const u = new URL(originUrl);
      u.search = `?search=${encodeURIComponent(u.search.substr(1))}`;
      proxyPath = u.toString();
    }
    // The following transformation improves the readability of the developer console's source list.
    proxyPath = proxyPath
      .replace(/^https:\/\//i, '')
      .replace(/^http:\/\//i, 'http/')
    return includePrefix ? `${proxyPrefix}/${proxyPath}` : proxyPath;
  }

  // exported for unit testing
  function decodeProxyPath(proxyPath: string, query: RequestI['query'] = {}): string {
    let originUrl = proxyPath
      .replace(proxyPrefix, '')
      .replace(/^\//, '')
      .replace(/^http\//, 'http://');
    if (!/^https?:/i.test(originUrl)) originUrl = `https://${originUrl}`;
    if (originUrl.includes('?')) {
      const [pʹ, queryString, hash] = originUrl.match(/(.+)\?(.+)(#.*)?/)!.slice(1);
      originUrl = pʹ + (hash || '');
      new URLSearchParams(queryString).forEach((value, key) => {
        query[key] = value;
      });
    }
    if (query.search) {
      originUrl += `?${decodeURIComponent(query.search as string)}`;
    }
    return originUrl;
  }

  function isProxyPath(url: string): boolean {
    return url.startsWith(proxyPrefix);
  }

  //#endregion

  //#region cache warmup

  /** Verify that url is in the cache. Request it if it is not.
   *
   * Uses cdnProxyRouter to minimize different code paths that need to be
   * tested.
   *
   * Returns a Response-like structure, that warmCache can use to follow
   * referenced URLs.
   *
   * Follows redirections infinitely, and caches intermediate results.
   *
   */
  async function prefetch(url: string, { accept = '*/*', force = false }): Promise<{ status: number, ok: boolean, headers: Record<string, string>, data: Buffer }> {
    const reqHeaders = {
      accept,
      'accept-language': 'en-US,en;q=0.9',
      'accept-encoding': 'gzip, deflate',
      // TODO: use a different user-agent for prefetching?
      'user-agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/15.1 Safari/605.1.15',
    };
    const req = {
      headers: reqHeaders,
      path: encodeProxyPath(url, { includePrefix: false }),
      query: force ? { reload: 'true' } : {}
    };

    /* eslint-disable @typescript-eslint/no-empty-function */
    const res = new class extends stream.Writable {
      chunks = new Array<Buffer>();
      headers: Record<string, string> = {};
      statusCode?: number;

      setHeader(key: string, value: string) {
        this.headers[key] = value;
      }
      status(code: number) { this.statusCode = code; }
      send(chunk: string | Buffer) { this.chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk) }
      _write(chunk: unknown, _encoding: BufferEncoding, callback: () => void) {
        assert.ok(chunk instanceof Buffer);
        this.chunks.push(chunk as Buffer);
        callback();
      }
    };
    /* eslint-enable @typescript-eslint/no-empty-function */

    debug(`warm cache for ${url}`);
    await cdnProxyRouter(req, res);
    const status = res.statusCode!;
    const redirected = 300 < status && status < 400 && res.headers.location?.startsWith(proxyPrefix + '/');
    if (redirected) {
      const location = decodeURIComponent(res.headers.location.substring(proxyPrefix.length + 1));
      debug(`following redirect from ${url} -> ${location}`);
      return prefetch(location, { accept, force });
    }
    return {
      data: Buffer.concat(res.chunks),
      headers: res.headers,
      ok: status < 400,
      status,
    };
  }

  /** Warm the cache, by requesting all the urls in the manifest, and the urls that they reference.
   *
   * (Currently, only references in CSS files are prefetched.)
   */
  async function warmCache({ force }: { force?: boolean }, callback?: (message: CacheWarmMessage) => void): Promise<CacheWarmStats> {
    // Most of this function's complexity is due to requesting the URLs
    // concurrently.
    const concurrency = 20; // max number of requests to make at once
    const stats = { total: 0, failures: 0, hits: 0, misses: 0 };
    const urls = removeArrayDuplicates(cacheSeeds).sort();
    callback?.({ type: 'initial', total: urls.length });

    const seen = new Set<string>();
    const promises: Promise<void>[] = [];
    // `while` instead of `for`, because visit() can add to the array.
    while (urls.length > 0 || promises.length > 0) {
      const url = urls.shift();
      if (url) {
        if (seen.has(url)) continue;
        seen.add(url);
        callback?.({ type: 'prefetch', url });
        await visit(url);
      } else {
        // One of the pending promises could add more urls to the queue, so wait
        // for the next one inside the loop, instead of awaiting Promise.all()
        // at the end.
        await Promise.race(promises);
      }
    }

    return stats;

    // This function returns immediately once it adds a fetch promise to the
    // array. (It does not wait for the fetch to initiate.) If there are already
    // `concurrency` promises pending, it waits for one to resolve before adding
    // the new promise and returning.
    async function visit(url: string) {
      if (promises.length >= concurrency) {
        // debug('waiting for one of', promises.length, 'prefetches to settle');
        /* eslint-disable-next-line @typescript-eslint/no-empty-function */
        await Promise.race(promises);
      }
      const accept = {
        '.css': 'text/css',
        '.html': 'text/html',
      }[path.extname(url)] || '*/*';
      const p = prefetch(url, { accept, force })
        .then(({ status, ok, headers, data }) => {
          if (ok) {
            const hit = headers[HTTP_RESPONSE_HEADER_CACHE_STATUS] === 'HIT';
            if (hit) stats.hits++; else stats.misses++;
            // add this document's URLs to the list of URLs to prefetch
            if (headers['content-type']?.startsWith('text/css') && data.length > 0) {
              switch (headers['content-encoding']) {
                case 'deflate':
                  data = zlib.deflateSync(data);
                  break;
                case 'gzip':
                case 'x-gzip':
                  data = zlib.gunzipSync(data);
                  break;
              }
              const base = url;
              cssForEachUrl(data.toString(), (value) => {
                if (value.startsWith('data:')) return;
                // prefetch returns a document with the URLs replaced, so CDN URLs
                // appear as proxy paths (or relative URLs), not as URLs with CDN
                // hostnames.
                value = removeHash(value);
                if (isProxyPath(value)) {
                  const originUrl = decodeProxyPath(url);
                  urls.push(originUrl);
                } else if (isRelativeUrl(value)) {
                  const originUrl = urlResolve(base, value);
                  urls.push(originUrl);
                }
              });
            }
            callback?.({ type: 'progress', stats });
          } else {
            stats.failures++;
            callback?.({ type: 'error', url, status });
          }
        })
        .finally(() => {
          stats.total++;
          promises.splice(promises.indexOf(p), 1);
          // callback?.(stats);
        });
      promises.push(p);
    }
  }

  //#endregion

  //#region rewrite documents

  /** Replace CDN URLs in script[src] and link[href] with proxy cache paths.
   *
   * @param html the HTML to process
   * @returns the processed HTML
   */
  function replaceUrlsInHtml(html: string): string {
    const htmlRoot = parseHtml(html);
    let modified = false;

    // rewrite script[src]
    htmlRoot
      .querySelectorAll('script[src]')
      .filter(e => isCdnUrl(e.attributes.src))
      .forEach(e => {
        modified = true;
        e.setAttribute('src', encodeProxyPath(e.attributes.src));
      });

    // rewrite link[href]
    htmlRoot
      .querySelectorAll('link[rel=stylesheet][href]')
      .filter(e => isCdnUrl(e.attributes.href))
      .forEach(e => {
        modified = true;
        e.setAttribute('href', encodeProxyPath(e.attributes.href));
      });

    return modified ? htmlRoot.outerHTML : html;
  }

  /** Replace CDN URLs with proxy cache paths.
   *
   * @param html the HTML to process
   * @returns the processed HTML
   */
  function replaceUrlsInCss(text: string) {
    const stylesheet = parseCss(text);
    let modified = false;

    cssForEachUrl(stylesheet, value => {
      if (value.startsWith('data:'))
        return;
      if (isCdnUrl(value)) {
        const proxied = encodeProxyPath(value);
        modified = true;
        // debug(`rewriting ${value} to ${proxied}`);
        return proxied;
      }
    }
    );
    return modified ? csstree.generate(stylesheet) : text;
  }

  // TODO: change this to a Duplex stream; remove the `istream` parameter.
  //
  // Defer this change until we drop support for Node.js v14. (This will be when
  // moves to a more recent version of Electron, that upgrades to Node.js v16.)
  // The implementation will become simpler at that point.
  function makeCssRewriterStream(istream: NodeJS.ReadableStream, base: string, encoding?: string): NodeJS.ReadableStream {
    switch (encoding) {
      case 'deflate':
        {
          const z = zlib.createInflate();
          const uz = zlib.createDeflate();
          const ws = makeCssRewriterStream(uz, base);
          istream.pipe(uz);
          ws.pipe(z);
          return z;
        }
      case 'gzip':
      case 'x-gzip':
        {
          const z = zlib.createGzip();
          const uz = zlib.createGunzip();
          const ws = makeCssRewriterStream(uz, base);
          istream.pipe(uz);
          ws.pipe(z);
          return z;
        }
    }
    async function* iter() {
      const text = await fromReadable(istream);
      yield replaceUrlsInCss(text.toString());
    }
    return Readable.from(iter());
  }
}

//#endregion

//#region stream helpers

/** Read the remaining chunks from a ReadableStream, and combine them into a
 * single string (if they are all strings) or Buffer.
 *
 * Note: Doesn't handle chunks of type `Uint8Array`.
 */
async function fromReadable(stream: NodeJS.ReadableStream, emptyValue: string | Buffer = ''): Promise<string | Buffer> {
  const chunks: (string | Buffer)[] = [];
  for await (const chunk of stream) {
    assert.ok(typeof chunk === 'string' || Buffer.isBuffer(chunk));
    chunks.push(chunk);
  }
  return chunks.length === 0 ? emptyValue
    : chunks.length === 1 ? chunks[0]
      : chunks.every(chunk => typeof chunk === 'string') ? chunks.join('')
        : chunks.every(chunk => chunk instanceof Buffer) ? Buffer.concat(chunks as Buffer[])
          : Buffer.concat(chunks.map(chunk => typeof chunk === 'string' ? Buffer.from(chunk) : chunk));
}

function multiplexStreamWriter(streams: NodeJS.WritableStream[]): NodeJS.WritableStream {
  assert.notEqual(streams.length, 0);
  return new stream.PassThrough({
    write(chunk, encoding, callback) {
      let error: Error | null | undefined = null;
      let count = streams.length;
      for (const stream of streams) {
        stream.write(chunk, encoding, (err) => {
          error ??= err; // invoke the callback with only the first error
          if (--count === 0) {
            callback(error);
          }
        });
      }
    },
    final(callback) {
      let count = streams.length;
      for (const stream of streams) {
        stream.end(() => {
          if (--count === 0) {
            callback();
          }
        });
      }
    }
  });
}

//#endregion

//#region helpers

/** Call `callback` for each URL in the CSS stylesheet. If `callback` returns a
 * value, replace the URL with that value. */
function cssForEachUrl(stylesheet: csstree.CssNode | string, callback: (url: string) => void | string) {
  csstree.walk(typeof stylesheet === 'string' ? parseCss(stylesheet) : stylesheet, {
    visit: 'Url',
    enter(node) {
      // csstree's node.value is a string, but the latest @types/css-tree (v1)
      // declares it as a node.
      //
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const urlNode = node as any as { value: string };
      const transformed = callback(urlNode.value);
      if (transformed) {
        urlNode.value = transformed;
      }
    }
  });
}

function removeArrayDuplicates<T>(array: T[]): T[] {
  return Array.from(new Set(array));
}

function isRelativeUrl(url: string) {
  return !/^[a-z]+:/i.test(url);
}

function removeHash(url: string): string {
  return url.replace(/#.*/, '');
}

// Source: nodejs documentation for Url.resolve
function urlResolve(from: string, to: string): string {
  const resolvedUrl = new URL(to, new URL(from, 'resolve://'));
  if (resolvedUrl.protocol === 'resolve:') {
    const { pathname, search, hash } = resolvedUrl;
    return pathname + search + hash;
  }
  return resolvedUrl.toString();
}

//#endregion

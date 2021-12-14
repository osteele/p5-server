import express = require('express');
import * as cacache from 'cacache';
import * as csstree from 'css-tree';
import { parse as parseCss } from 'css-tree';
import fetch from 'node-fetch';
import { parse as parseHtml } from 'node-html-parser';
import { Cdn, Library } from 'p5-analysis';
import { p5Version } from 'p5-analysis/dist/models/Library';
import stream, { Readable } from 'stream';
import zlib from 'zlib';
import { isDefined } from '../ts-extras';
import path = require('path');
import assert = require('assert');
import { createHmac } from 'node:crypto';
export * as cacache from 'cacache';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const debug = require('debug')('p5-server:cdnProxy');

export const proxyPrefix = '/__p5_proxy_cache';
export const cachePath = process.env.HOME + '/.cache/p5-server';

const HTTP_RESPONSE_HEADER_CACHE_STATUS = 'x-p5-server-cache-hit';
const uncacheableResponseHeaders = [
  'accept-ranges', 'age', 'connection', 'content-accept-ranges',
  'content-length', 'strict-transport-security', 'transfer-encoding', 'vary'];

/** A list of CDNs that aren't listed in the p5-analysis Library model (because
 * they aren't specific to serving NPM packages).
 */
const cdnDomains = [
  'fonts.googleapis.com',
  'fonts.gstatic.com',
  'ghcdn.rawgit.org',
  // JSDelivr is a known npm package proxy, but the templates use a different path schema to request Highlight.js
  // distribution files.
  'cdn.jsdelivr.net',
]

/** URLs to warm the cache with, that can't be inferred from the libraries, in
 * addition to library loadPaths.
 *
 * It's okay if these have repeats. The cache warmer deduplicates URLs anyway.
 */
const cacheSeeds = [
  // TODO: use an API to retrieve this constant
  `https://cdn.jsdelivr.net/npm/p5@${p5Version}/lib/p5.min.js`, // p5importPath
  // TODO: read the following from the template file. Or, add these to the package.
  // directory.pug
  'https://cdn.jsdelivr.net/npm/jquery@3.6/dist/jquery.min.js',
  'https://cdn.jsdelivr.net/npm/semantic-ui@2.4/dist/semantic.min.js',
  'https://cdn.jsdelivr.net/npm/semantic-ui@2.4/dist/semantic.min.css',
  'https://cdn.jsdelivr.net/gh/highlightjs/cdn-release@11.2.0/build/styles/default.min.css',
  // markdown.pug
  'https://cdn.jsdelivr.net/npm/semantic-ui@2.4/dist/semantic.min.css',
  'https://cdn.jsdelivr.net/gh/highlightjs/cdn-release@11.2.0/build/styles/default.min.css',
  // source-view.pug
  "https://cdn.jsdelivr.net/gh/highlightjs/cdn-release@11.2.0/build/styles/github-dark.min.css",
  "https://cdn.jsdelivr.net/gh/highlightjs/cdn-release@11.2.0/build/highlight.min.js",
]

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

// Note that express.Request implements RequestI, and express.Response
// implements ResponseI.
//
// This function uses the more general type to allow prefetch to call
// cdnProxyRouter.
export async function cdnProxyRouter(req: RequestI, res: ResponseI): Promise<void> {
  const originUrl = decodeProxyPath(req.path, req.query);
  const cacheKey = createHmac('sha256', JSON.stringify({
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
  })).digest('hex');
  const cacheObject = await cacache.get.info(cachePath, cacheKey);

  if (cacheObject && !req.query.reload) {
    debug('cache hit', originUrl);
    // TODO: check if content has expired
    res.setHeader(HTTP_RESPONSE_HEADER_CACHE_STATUS, 'HIT');
    const { headers } = cacheObject.metadata;
    for (const key of Object.keys(headers)) {
      let value = headers[key];
      if (key === 'location' && isCdnUrl(value)) {
        value = encodeProxyPath(value);
      }
      const headerMap: Record<string, string> = { server: 'origin-server' };
      res.setHeader(headerMap[key] ?? key, value);
    }
    res.status(cacheObject.metadata.status);
    let stream = cacache.get.stream(cachePath, cacheKey);
    stream = makeProxyReplacemenStream(stream, headers['content-type'], headers['content-encoding'], originUrl);
    stream.pipe(res);
    await new Promise(resolve => res.on('finish', resolve));
    return;
  }

  debug('proxy request for', originUrl);
  // filter the headers, and combine string[] values back into strings
  const headerAcceptList = ['accept', 'user-agent', 'accept-language', 'accept-encoding']
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
export function encodeProxyPath(originUrl: string, { includePrefix = true } = {}): string {
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
export function decodeProxyPath(proxyPath: string, query: RequestI['query'] = {}): string {
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

/** Verify that url is in the cache. Request it if it is not. Uses
 * cdnProxyRouter to minimize different code paths that need to be tested.
 * Returns a Response-like structure, that warmCache can use to follow
 * referenced URLs.
 */
async function prefetch(url: string, { accept = '*/*', force = false }): Promise<{ status: number, ok: boolean, headers: Record<string, string>, data: Buffer }> {
  const reqHeaders = {
    accept,
    // TODO: use a different user-agent for prefetching?
    'user-agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/15.1 Safari/605.1.15',
    'accept-language': 'en-US,en;q=0.9',
    'accept-encoding': 'gzip, deflate',
  };
  const req = {
    headers: reqHeaders,
    path: encodeProxyPath(url, { includePrefix: false }),
    query: force ? { reload: 'true' } : {}
  };
  let status: number | undefined;
  /* eslint-disable @typescript-eslint/no-empty-function */
  const res = new class extends stream.Writable {
    headers: Record<string, string> = {};
    chunks = new Array<Buffer>();

    setHeader(key: string, value: string) {
      this.headers[key] = value;
    }
    status(statusCode: number) { status = statusCode; }
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
  const redirected = 300 < status! && status! < 400 && res.headers.location.startsWith(proxyPrefix + '/');
  if (redirected) {
    const location = decodeURIComponent(res.headers.location.substring(proxyPrefix.length + 1));
    debug(`following redirect from ${url} -> ${location}`);
    return prefetch(location, { accept, force });
  }
  return {
    data: Buffer.concat(res.chunks),
    headers: res.headers,
    ok: status! < 400,
    status: status!,
  };
}

/** Warm the cache, by requesting all the urls in the manifest, and the urls that they reference.
 *
 * (Currently, only references in CSS files are prefetched.)
 */
export async function warmCache({ force, verbose }: { force?: boolean, verbose?: boolean }): Promise<{ total: number, failures: number, hits: number, misses: number }> {
  const concurrency = 20; // max number of requests to make at once
  const stats = { total: 0, failures: 0, hits: 0, misses: 0 };
  // use Set to dedupe
  const urls = Array.from(new Set([...cacheSeeds, ...getLibraryImportPaths()]));
  if (!verbose) {
    process.stdout.write(`Warming cache from ${urls.length} seeds`);
  }

  const seen = new Set<string>();
  const promises: Promise<void>[] = [];
  // `while` instead of `for`, because visit() can add to the array.
  while (urls.length > 0) {
    const url = urls.shift()!;
    if (seen.has(url)) continue;
    seen.add(url);
    process.stdout.write(verbose ? `Prefetching ${url}...\n` : '.');
    await visit(url);
  }
  await Promise.all(promises);
  if (!verbose) {
    process.stdout.write('done\n');
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
      await Promise.any(promises).catch(() => {
        // TODO: I thought I had a reason to ignore the exception, but I should review this
      });
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
          if (headers['content-type'].startsWith('text/css')) {
            if (headers['content-encoding'] === 'gzip') {
              data = zlib.gunzipSync(data);
            }
            const base = url;
            cssForEachUrl(data.toString(), (value) => {
              if (value.startsWith('data:')) return;
              // prefetch returns a document with the URLs replaced, so CDN URLs
              // appear as proxy paths (or relative URLs), not as URLs with CDN
              // hostnames.
              if (isProxyPath(value)) {
                const originUrl = decodeProxyPath(url);
                urls.push(originUrl);
              } else if (isRelativeUrl(value)) {
                const originUrl = urlResolve(base, value);
                urls.push(originUrl);
              }
            });
          }
        } else {
          stats.failures++;
          if (!verbose) process.stdout.write('\n');
          process.stderr.write(`Error: failed to fetch ${url}; error code: ${status}\n`);
        }
      })
      .finally(() => {
        stats.total++;
        promises.splice(promises.indexOf(p), 1);
      });
    promises.push(p);
  }
}

//#endregion

//#region CDN recognition

// exported for unit tests
export function isCdnUrl(url: string): boolean {
  if (!/^https?:/.test(url)) return false;
  return Cdn.all.some(cdn => cdn.matchesUrl(url))
    || getLibraryImportPaths().has(url)
    || cdnDomains.includes(new URL(url).hostname);
}

/** Cache for memoizing getLibraryImportPaths. */
let _libraryImportPaths: Set<string>;

function getLibraryImportPaths() {
  _libraryImportPaths ??= new Set(Library.all.map(lib => lib.importPath).filter(isDefined));
  return _libraryImportPaths;
}

//#endregion

//#region rewrite documents

/** Replace CDN URLs in script[src] and link[href] with proxy cache paths.
 *
 * @param html the HTML to process
 * @returns the processed HTML
 */
export function replaceUrlsInHtml(html: string): string {
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
  if (encoding === 'gzip') {
    const z = zlib.createGzip();
    const uz = zlib.createGunzip();
    const ws = makeCssRewriterStream(uz, base);
    istream.pipe(uz);
    ws.pipe(z);
    return z;
  }
  async function* iter() {
    const text = await fromReadable(istream);
    yield replaceUrlsInCss(text.toString());
  }
  return Readable.from(iter());
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

function isRelativeUrl(url: string) {
  return !/^[a-z]+:/i.test(url);
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

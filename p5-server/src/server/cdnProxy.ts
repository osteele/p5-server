import express = require('express');
import * as cacache from 'cacache';
import * as csstree from 'css-tree';
import { parse as parseCss } from 'css-tree';
import fetch from 'node-fetch';
import { parse as parseHtml } from 'node-html-parser';
import { Cdn, Library } from 'p5-analysis';
import { p5Version } from 'p5-analysis/dist/models/Library';
import { Readable } from 'stream';
import zlib from 'zlib';
import { isDefined } from '../ts-extras';
export * as cacache from 'cacache';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const debug = require('debug')('p5-server:cdnProxy');
const proxyCss = true;

// This header is purely information; nothing else depends on it
const HTTP_RESPONSE_HEADER_CACHE_STATUS = 'x-p5-server-cache-hit';
export const proxyPrefix = '/__p5_proxy_cache';
export const cachePath = process.env.HOME + '/.cache/p5-server';

/** A list of CDNs that aren't listed in the Library model (because they aren't
 * specific to serving NPM packages).
 */
const cdnDomains = [
  'fonts.googleapis.com',
  'fonts.gstatic.com',
  'ghcdn.rawgit.org',
]

// URLs to warm the cache with, that can't be inferred from the libraries,
// in addition to library loadPaths.
const cacheWarmOrigins = [
  // TODO: use an API to retrieve this constant
  `https://cdn.jsdelivr.net/npm/p5@${p5Version}/lib/p5.min.js`, // p5importPath
  // TODO: read the following from the template file. Or, add these to the package.
  'https://cdn.jsdelivr.net/npm/jquery@3.6/dist/jquery.min.js',
  'https://cdn.jsdelivr.net/npm/semantic-ui@2.4/dist/semantic.min.js',
  'https://cdn.jsdelivr.net/npm/semantic-ui@2.4/dist/semantic.min.css',
  'https://cdn.jsdelivr.net/gh/highlightjs/cdn-release@11.2.0/build/styles/default.min.css',
  'https://cdn.jsdelivr.net/npm/semantic-ui@2.4/dist/semantic.min.css',
]


// The RequestI and ReponseI interfaces specify the part of express.Request and
// express.Response that cdnProxyRouter uses. It is done this way so that
// prefetch, which is used to warm the cache can call cdnProxyRouter instead of
// using separate logic to test and populate the cache.

interface RequestI {
  headers: typeof express.request.headers;
  path: typeof express.request.path;
  query: typeof express.request.query;
}

interface ResponseI {
  setHeader(key: string, value: string | number | readonly string[]): void;
  send(chunk: string | Buffer): void;
  status(code: number): void;
  write(chunk: unknown): void;
  end: typeof express.response.end;
}

// Note that express.Request implements RequestI, and express.Response implmenets ResponseI.
// This function uses the more general type to allow prefetch to call cdnProxyRouter.
export async function cdnProxyRouter(req: RequestI, res: ResponseI): Promise<void> {
  const originUrl = decodeProxyPath(req.path, req.query);
  const cacheKey = encodeURIComponent(originUrl);
  const cacheObject = await cacache.get.info(cachePath, cacheKey);

  if (cacheObject && !req.query.reload) {
    debug('cache hit', originUrl);
    // TODO: check if content has expired
    res.setHeader(HTTP_RESPONSE_HEADER_CACHE_STATUS, 'HIT');
    for (const key of Object.keys(cacheObject.metadata.headers)) {
      let value = cacheObject.metadata.headers[key];
      if (key === 'location' && isCdnUrl(value)) {
        value = encodeProxyPath(value);
      }
      const headerMap: Record<string, string> = { server: 'origin-server' };
      res.setHeader(headerMap[key] ?? key, value);
    }
    res.status(cacheObject.metadata.status);
    let stream = cacache.get.stream(cachePath, cacheKey);
    if (cacheObject.metadata.headers['content-type'].startsWith('text/css')) {
      stream = await makeCssRewriterStream(stream, originUrl, cacheObject.metadata.headers['content-encoding']);
    }
    for await (const chunk of stream) {
      res.write(chunk);
    }
    res.end();
    return;
  }

  debug('proxy request for', originUrl);
  const headerAcceptList = ['accept', 'user-agent', 'accept-language', 'accept-encoding']
  const reqHeaders: Record<string, string> = Object.fromEntries((Object.entries(req.headers)
    .filter(([key]) => headerAcceptList.includes(key))
    .filter(([_key, value]) => isDefined(value)) as [string, string | string[]][])
    .map(([key, value]) => [key, Array.isArray(value) ? value.join(' ') : value]));
  const originResponse = await fetch(originUrl, {
    compress: false, // store the gzip, for efficiency and to match the content-type
    headers: reqHeaders,
    redirect: 'manual', // don't follow redirects; cache the redirect directive
  });

  res.status(originResponse.status);
  res.setHeader(HTTP_RESPONSE_HEADER_CACHE_STATUS, 'MISS');
  relayOriginHeaders();

  // this test excludes 300 Multiple Choice
  const redirected = 300 < originResponse.status && originResponse.status < 400 && originResponse.headers.has('location');
  if (!originResponse.ok && !redirected) {
    // don't cache responses other than 200's and redirects
    debug(`Failed ${originResponse.ok} | ${originResponse.status} | ${originResponse.statusText}`);
    res.send(originResponse.statusText);
    return;
  }

  const responseHeaders = Object.fromEntries(
    Array.from(originResponse.headers.entries())
      .filter(([key]) => key !== 'content-accept-ranges')
  )
  const cacheWriteStream = cacache.put.stream(cachePath, cacheKey, {
    metadata: {
      headers: responseHeaders,
      status: originResponse.status
    }
  });

  let bodyLength = 0;
  for await (const chunk of originResponse.body) {
    bodyLength += chunk.length;
    cacheWriteStream.write(chunk);
    res.write(chunk);
  }
  cacheWriteStream.end();
  res.end();
  debug('wrote', bodyLength, 'bytes to cache for', originUrl);

  // Copy headers from the origin response to the output response `res`.
  // Modify Location headers to proxy them.
  function relayOriginHeaders() {
    originResponse.headers.forEach((value, key) => {
      if (key === 'location' && isCdnUrl(value)) {
        value = encodeProxyPath(value);
      }
      res.setHeader(key, value);
    });
  }
}

function encodeProxyPath(originUrl: string, { includePrefix = true } = {}): string {
  let proxyPath = originUrl;
  if (/\?/.test(originUrl)) {
    const u = new URL(originUrl);
    u.search = `?search=${encodeURIComponent(u.search.substr(1))}`;
    proxyPath = u.toString();
  }
  return includePrefix ? `${proxyPrefix}/${proxyPath}` : proxyPath;
}

function decodeProxyPath(proxyPath: string, query: RequestI['query']) {
  let originUrl = proxyPath.replace(/^\//, '');
  if (query.search) {
    originUrl += `?${decodeURIComponent(query.search as string)}`;
  }
  return originUrl;
}

/** Verify that url is in the cache. Request it if it is not.
 * Uses cdnProxyRouter to minimize different code paths that need to be tested.
 */
async function prefetch(url: string, { force = false }): Promise<{ status: number, ok: boolean, headers: Record<string, string>, data: Buffer }> {
  process.stdout.write(`Prefetching ${url}...\n`);
  const reqHeaders = {
    accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
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
  const res = {
    headers: {} as Record<string, string>,
    setHeader(key: string, value: string) {
      this.headers[key] = value;
    },
    status(statusCode: number) { status = statusCode },
    send(chunk: string | Buffer) { this.chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk) },
    write(chunk: string | Buffer) { this.chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk) },
    end() { },
    chunks: new Array<Buffer>(),
  };
  /* eslint-enable @typescript-eslint/no-empty-function */
  debug(`warm cache for ${url}`);
  await cdnProxyRouter(req, res);
  const redirected = 300 < status! && status! < 400 && res.headers.location.startsWith(proxyPrefix + '/');
  if (redirected) {
    const location = decodeURIComponent(res.headers.location.substring(proxyPrefix.length + 1));
    debug(`following redirect from ${url} -> ${location}`);
    return prefetch(location, { force });
  }
  return {
    data: Buffer.concat(res.chunks),
    headers: res.headers,
    ok: status! < 400,
    status: status!,
  };
}

/** Warm the cache with all the import paths.
 * @returns the number of entries
 */
export async function warmCache({ force }: { force?: boolean }): Promise<{ count: number, failures: number, hits: number, misses: number }> {
  const concurrency = 20;
  const seen = new Set<string>();
  const stats = { count: 0, failures: 0, hits: 0, misses: 0 };
  const urls = [...cacheWarmOrigins, ...getLibraryImportPaths()];
  const promises: Promise<void>[] = [];
  // `while` instead of `for`, because visit() can add to the array.
  while (urls.length > 0) {
    await visit(urls.shift()!);
  }
  await Promise.all(promises);
  return stats;

  // This returns immediately if once it adds a promise to the array. If there
  // are already `concurrency` promises pending, it waits for the first one to
  // resolve.
  async function visit(url: string) {
    if (seen.has(url)) return;
    seen.add(url);
    if (promises.length >= concurrency) {
      // debug('waiting for one of', promises.length, 'prefetches to settle');
      /* eslint-disable-next-line @typescript-eslint/no-empty-function */
      await Promise.any(promises).catch(() => {
        // TODO: I thought I had a reason to ignore the exception, but I should review this
      });
    }
    const p = prefetch(url, { force })
      .then(({ status, ok, headers, data }) => {
        if (ok) {
          const hit = headers[HTTP_RESPONSE_HEADER_CACHE_STATUS] === 'HIT';
          if (hit) stats.hits++; else stats.misses++;
          if (headers['content-type'].startsWith('text/css')) {
            if (headers['content-encoding'] === 'gzip') {
              data = zlib.gunzipSync(data);
            }
            const base = url;
            cssForEachUrl(data.toString(), (value) => {
              if (value.startsWith('data:')) return;
              value = urlResolve(base, value);
              if (isCdnUrl(value)) {
                urls.push(value);
              }
            });
          }
        } else {
          stats.failures++;
          process.stderr.write(`Error: failed to fetch ${url}; error code: ${status}\n`);
        }
      })
      .finally(() => {
        stats.count++;
        promises.splice(promises.indexOf(p), 1);
      });
    promises.push(p);
  }
}

/** Replace CDN URLs in script[src] and link[href] with local proxy URLs.
 * @param html the HTML to process
 * @returns the processed HTML
 */
export function rewriteCdnUrls(html: string): string {
  const htmlRoot = parseHtml(html);

  // rewrite script[src]
  htmlRoot
    .querySelectorAll('script[src]')
    .filter(e => isCdnUrl(e.attributes.src))
    .forEach(e => {
      e.setAttribute('src', encodeProxyPath(e.attributes.src));
    });

  // rewrite link[href]
  if (proxyCss) {
    htmlRoot
      .querySelectorAll('link[rel=stylesheet][href]')
      .filter(e => isCdnUrl(e.attributes.href))
      .forEach(e => {
        e.setAttribute('href', encodeProxyPath(e.attributes.href));
      });
  }
  return htmlRoot.outerHTML;
}

function isCdnUrl(url: string) {
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

// TODO: change this to transformer, and use pipe to handle buffering and compression
async function makeCssRewriterStream(stream: NodeJS.ReadableStream, base: string, encoding?: string): Promise<NodeJS.ReadableStream> {
  const input = await fromReadable(stream);
  if (encoding === 'gzip') {
    const innerStream = await makeCssRewriterStream(Readable.from(zlib.unzipSync(input)), base);
    const output = await fromReadable(innerStream);
    return Readable.from(zlib.gzipSync(output));
  }
  const text = typeof input === 'string' ? input : input.toString('utf8');
  const stylesheet = parseCss(text);
  cssForEachUrl(stylesheet, value => {
    if (value.startsWith('data:')) return;
    // if (!/^https?:/.test(value)) {
    //   value = urlResolve(base, value)
    // }
    if (isCdnUrl(value)) {
      const proxied = encodeProxyPath(value);
      // debug(`rewriting ${value} to ${proxied}`);
      return proxied;
    }
  }
  );
  return Readable.from(csstree.generate(stylesheet));
}

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

async function fromReadable(stream: NodeJS.ReadableStream): Promise<string | Buffer> {
  const chunks: (string | Buffer)[] = [];
  for await (const chunk of stream) {
    chunks.push(chunk);
  }
  return chunks.length === 0 ? ''
    : chunks.length === 1 ? chunks[0]
      : chunks.every(chunk => typeof chunk === 'string') ? chunks.join('')
        : chunks.every(chunk => chunk instanceof Buffer) ? Buffer.concat(chunks as Buffer[])
          : Buffer.concat(chunks.map(chunk => typeof chunk === 'string' ? Buffer.from(chunk) : chunk));
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

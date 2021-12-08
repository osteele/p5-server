import express = require('express');
import * as cacache from 'cacache';
import fetch from 'node-fetch';
import { parse as parseHtml } from 'node-html-parser';
import { Cdn } from 'p5-analysis';
import { Library } from 'p5-analysis';
import { p5Version } from 'p5-analysis/dist/models/Library';
export * as cacache from 'cacache';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const debug = require('debug')('p5-server:cdnProxy');

// This header is purely information; nothing else depends on it
const HTTP_RESPONSE_HEADER_CACHE_HIT = 'x-p5-server-cache-hit';
export const proxyPrefix = '/__p5_proxy_cache';
export const cachePath = process.env.HOME + '/.cache/p5-server';

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
  const cacheKey = req.path.split('/', 2)[1];
  const url = decodeURIComponent(req.path.split('/', 2)[1]);
  const cacheObject = await cacache.get.info(cachePath, cacheKey);

  if (cacheObject && !req.query.reload) {
    debug('cache hit', url);
    // TODO: check if content has expired
    res.setHeader(HTTP_RESPONSE_HEADER_CACHE_HIT, 'false');
    for (const key of Object.keys(cacheObject.metadata.headers)) {
      let value = cacheObject.metadata.headers[key];
      if (key === 'location' && isCdnUrl(value)) {
        value = proxyPrefix + '/' + encodeURIComponent(value);
      }
      res.setHeader(key, value);
    }
    res.status(cacheObject.metadata.status);
    for await (const chunk of cacache.get.stream(cachePath, cacheKey)) {
      res.write(chunk);
    }
    res.end();
    return;
  }

  debug('proxy request for', url);
  const headerAcceptList = ['accept', 'user-agent', 'accept-language', 'accept-encoding']
  const reqHeaders: Record<string, string> = Object.fromEntries((Object.entries(req.headers)
    .filter(([key]) => headerAcceptList.includes(key))
    .filter(([_key, value]) => isDefined(value)) as [string, string | string[]][])
    .map(([key, value]) => [key, Array.isArray(value) ? value.join(' ') : value]));
  const originResponse = await fetch(url, {
    compress: false, // store the gzip, for efficiency and to match the content-type
    headers: reqHeaders,
    redirect: 'manual', // don't follow redirects; cache the redirect directive
  });

  res.status(originResponse.status);
  res.setHeader(HTTP_RESPONSE_HEADER_CACHE_HIT, 'true');
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
  debug('wrote', bodyLength, 'bytes to cache for', url);

  // Copy headers from the origin response to the output response `res`.
  // Modify Location headers to proxy them.
  function relayOriginHeaders() {
    originResponse.headers.forEach((value, key) => {
      if (key === 'location' && isCdnUrl(value)) {
        value = proxyPrefix + '/' + encodeURIComponent(value);
      }
      res.setHeader(key, value);
    });
  }
}

/** Verify that url is in the cache. Request it if it is not.
 * Uses cdnProxyRouter to minimize different code paths that need to be tested.
 */
async function prefetch(url: string, { force = false }): Promise<{ status: number, ok: boolean }> {
  process.stdout.write(`Prefetching ${url}...\n`);
  const reqHeaders = {
    accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    'user-agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/15.1 Safari/605.1.15',
    'accept-language': 'en-US,en;q=0.9',
    'accept-encoding': 'gzip, deflate',
  };
  const req = {
    headers: reqHeaders,
    path: '/' + encodeURIComponent(url),
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
    send() { },
    write() { },
    end() { },
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
    ok: status! < 400,
    status: status!,
  };
}

// URLs to warm the cache with, that can't be inferred from the libraries.
const otherCachedUrls = [
  // TODO: use an API to retrieve this constant
  `https://cdn.jsdelivr.net/npm/p5@${p5Version}/lib/p5.min.js`, // p5importPath
  // TODO: read the following from the template file. Or, add these to the package.
  'https://cdn.jsdelivr.net/npm/jquery@3.6/dist/jquery.min.js',
  'https://cdn.jsdelivr.net/npm/semantic-ui@2.4/dist/semantic.min.js',
  'https://cdn.jsdelivr.net/npm/semantic-ui@2.4/dist/semantic.min.css',
  'https://cdn.jsdelivr.net/gh/highlightjs/cdn-release@11.2.0/build/styles/default.min.css',
  'https://cdn.jsdelivr.net/npm/semantic-ui@2.4/dist/semantic.min.css',
]

/** Warm the cache with all the import paths.
 * @returns the number of entries
 */
export async function warmCache({ force }: { force?: boolean }): Promise<{ count: number, failureCount: number }> {
  const concurrency = 20;
  let failureCount = 0;
  const urls = [...otherCachedUrls, ...getLibraryImportPaths()];
  const promises: Promise<void>[] = [];
  for (const url of urls) {
    if (promises.length >= concurrency) {
      // debug('waiting for one of', promises.length, 'prefetches to settle');
      /* eslint-disable-next-line @typescript-eslint/no-empty-function */
      await Promise.any(promises).catch(() => { });
    }
    const p = prefetch(url, { force })
      .then(({ status, ok }) => {
        if (!ok) {
          failureCount++;
          process.stderr.write(`Error: failed to fetch ${url}; error code: ${status}\n`);
        }
      })
      .finally(() => {
        promises.splice(promises.indexOf(p), 1);
      });
    promises.push(p);
  }
  await Promise.all(promises);
  return { count: urls.length, failureCount };
}

/** Replace CDN URLs in script[src] and link[href] with local proxy URLs.
 * @param html the HTML to process
 * @returns the processed HTML
 */
export function rewriteCdnUrls(html: string): string {
  const htmlRoot = parseHtml(html);
  // rewrite script[src]
  const scriptTags = htmlRoot
    .querySelectorAll('script[src]')
    .filter(e => isCdnUrl(e.attributes.src));
  scriptTags.forEach(e => {
    e.setAttribute('src', proxyPrefix + '/' + encodeURIComponent(e.attributes.src));
  });
  // rewrite link[href]
  const linkTags = htmlRoot
    .querySelectorAll('link[rel=stylesheet][href]')
    .filter(e => isCdnUrl(e.attributes.href));
  linkTags.forEach(e => {
    e.setAttribute('href', proxyPrefix + '/' + encodeURIComponent(e.attributes.href));
  });
  return htmlRoot.outerHTML;
}

function isCdnUrl(url: string) {
  return Cdn.all.some(cdn => cdn.matchesUrl(url))
    || url.startsWith('https://ghcdn.rawgit.org/')
    || getLibraryImportPaths().has(url);
}

/** Cache for memoizing getLibraryImportPaths. */
let _libraryImportPaths: Set<string>;

function getLibraryImportPaths() {
  _libraryImportPaths ??= new Set(Library.all.map(lib => lib.importPath).filter(isDefined));
  return _libraryImportPaths;
}

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

export const proxyPrefix = '/__p5_proxy_cache';
export const cachePath = process.env.HOME + '/.cache/p5-server';

interface RequestI {
  headers: typeof express.request.headers;
  path: string;
  query: typeof express.request.query;
}

interface ResponseI {
  setHeader(key: string, value: string | number | readonly string[]): void;
  send(chunk: string | Buffer): void;
  status(code: number): void;
  write(chunk: unknown): void;
  end(): void;
}

export async function cdnProxyRouter(
  req: RequestI,
  // req: express.Request,
  res: ResponseI
  // res: express.Response
): Promise<void> {
  const cacheKey = req.path.split('/', 2)[1];
  const url = decodeURIComponent(req.path.split('/', 2)[1]);
  const cacheObject = await cacache.get.info(cachePath, cacheKey);

  // cache hit
  if (cacheObject && !req.query.reload) {
    debug('cache hit', url);
    // TODO: check if content has expired
    res.setHeader('x-p5-server-cache-hit', 'true');
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
  const response = await fetch(url, {
    compress: false, // store the gzip, for efficiency and to match the content-type
    headers: reqHeaders,
    redirect: 'manual', // don't follow redirects; cache the redirect directive
  });

  res.status(response.status);
  res.setHeader('x-p5-server-cache-hit', 'true');
  sendHeaders();

  // this test excludes 300 Multiple Choice
  const redirected = 300 < response.status && response.status < 400 && response.headers.has('location');
  if (!response.ok && !redirected) {
    // don't cache responses other than 200's and redirects
    debug(`Failed ${response.ok} | ${response.status} | ${response.statusText}`);
    res.send(response.statusText);
    return;
  }

  const responseHeaders = Object.fromEntries(
    Array.from(response.headers.entries())
      .filter(([key]) => key !== 'content-accept-ranges')
  )
  const cacheWriteStream = cacache.put.stream(cachePath, cacheKey, {
    metadata: {
      headers: responseHeaders,
      status: response.status
    }
  });
  let bodyLength = 0;
  for await (const chunk of response.body) {
    bodyLength += chunk.length;
    cacheWriteStream.write(chunk);
    res.write(chunk);
  }
  cacheWriteStream.end();
  res.end();
  debug('wrote', bodyLength, 'bytes to cache for', url);

  function sendHeaders() {
    response.headers.forEach((value, key) => {
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

/** Warm the cache with all the import paths.
 * @returns the number of entries
*/
export async function warmCache({ force }: { force?: boolean }): Promise<{ count: number, failureCount: number }> {
  const concurrency = 20;
  let failureCount = 0;
  const p5importPath = `https://cdn.jsdelivr.net/npm/p5@${p5Version}/lib/p5.min.js`; // TODO: use an API to retrieve this constant
  const urls = [p5importPath, ...getLibraryImportPaths()];
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

// Parse the HTML, and replace any CDN URLs with local URLs.
export function rewriteCdnUrls(html: string): string {
  const htmlRoot = parseHtml(html);
  const scriptTags = htmlRoot
    .querySelectorAll('script[src]')
    .filter(e => isCdnUrl(e.attributes.src));
  scriptTags.forEach(e => {
    e.setAttribute('src', proxyPrefix + '/' + encodeURIComponent(e.attributes.src));
  });
  return htmlRoot.outerHTML;
}

function isCdnUrl(url: string) {
  return Cdn.all.some(cdn => cdn.matchesUrl(url))
    || url.startsWith('https://ghcdn.rawgit.org/')
    || getLibraryImportPaths().has(url);
}

let _libraryImportPaths: Set<string>;

function getLibraryImportPaths() {
  _libraryImportPaths ??= new Set(Library.all.map(lib => lib.importPath).filter(isDefined));
  return _libraryImportPaths;
}

/* This function is copied from https://github.com/sindresorhus/ts-extras.
 * See the note in p5-analysis/src/ts-extras.tst.
*/
function isDefined<T>(value: T | null | undefined): value is T {
  return value !== null && value !== undefined;
}

import express = require('express');
import * as cacache from 'cacache';
import fetch from 'node-fetch';
import { parse as parseHtml } from 'node-html-parser';
import { Cdn } from 'p5-analysis';
import { Library } from 'p5-analysis';
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
  if (cacheObject) {
    debug('cache hit', url);
    // TODO: check if content has expired
    for (const key of Object.keys(cacheObject.metadata.headers)) {
      res.setHeader(key, cacheObject.metadata.headers[key]);
    }
    res.status(cacheObject.metadata.status);
    for await (const chunk of cacache.get.stream(cachePath, cacheKey)) {
      res.write(chunk);
    }
    res.end();
    return;
  }

  debug('proxy request for', url);
  const headerWhitelist = ['accept', 'user-agent', 'accept-language', 'accept-encoding']
  const reqHeaders: Record<string, string> = Object.fromEntries((Object.entries(req.headers)
    .filter(([key]) => headerWhitelist.includes(key))
    .filter(([_key, value]) => isDefined(value)) as [string, string | string[]][])
    .map(([key, value]) => [key, Array.isArray(value) ? value.join(' ') : value]));
  const response = await fetch(url, {
    headers: reqHeaders,
    compress: false, redirect: 'manual'
  });
  if (!response.ok) {
    sendHeaders();
    res.status(response.status);
    res.send(response.statusText);
    return;
  }
  // TODO: remove from headers: accept-ranges
  // TODO: modify headers: age, cache-control, maybe others
  const cacheWriteStream = cacache.put.stream(cachePath, cacheKey, {
    metadata: {
      headers: Object.fromEntries(response.headers),
      status: response.status
    }
  });
  sendHeaders();
  res.status(response.status);
  let size = 0;
  for await (const chunk of response.body) {
    size += chunk.length;
    cacheWriteStream.write(chunk);
    res.write(chunk);
  }
  cacheWriteStream.end();
  res.end();
  debug('wrote', size, 'bytes to cache');

  function sendHeaders() {
    response.headers.forEach((value, key) => {
      res.setHeader(key, value);
    });
  }
}

export async function warmCache(): Promise<void> {
  const importPaths = getLibraryImportPaths();
  const reqHeaders = {
    accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    'user-agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/15.1 Safari/605.1.15',
    'accept-language': 'en-US,en;q=0.9',
    'accept-encoding': 'gzip, deflate',
  };
  for (const url of importPaths) {
    const req = {
      headers: reqHeaders,
      path:  '/' + encodeURIComponent(url),
      query: {}
    };
    /* eslint-disable @typescript-eslint/no-empty-function */
    const res = {
      setHeader() { },
      status() { },
      send() { },
      write() {  },
      end() { },
    };
    /* eslint-enable @typescript-eslint/no-empty-function */
    console.log(`warm cache for ${url}`);
    await cdnProxyRouter(req, res);
  }
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

let _libraryImportPaths: Set<string>; //|undefined;

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

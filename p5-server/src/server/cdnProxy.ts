import express = require('express');
import * as cacache from 'cacache';
import fetch from 'node-fetch';
import { parse as parseHtml } from 'node-html-parser';
import { Cdn } from 'p5-analysis';
export * as cacache from 'cacache';

export const proxyPrefix = '/__p5_proxy_cache';
export const cachePath = process.env.HOME + '/.cache/p5-server';

export async function cdnProxyRouter(
  req: express.Request,
  res: express.Response
): Promise<void> {
  const cacheKey = req.url.split('/', 2)[1];
  const url = decodeURIComponent(req.url.split('/', 2)[1]);
  const cacheObject = await cacache.get.info(cachePath, cacheKey);
  if (cacheObject) {
    // console.info('cache hit', url);
    // TODO: check if content is still valid
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
  // console.info('proxy request for', url);
  const response = await fetch(url, { compress: false, redirect: 'manual' });
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
  // let size = 0;
  for await (const chunk of response.body) {
    // size += chunk.length;
    cacheWriteStream.write(chunk);
    res.write(chunk);
  }
  cacheWriteStream.end();
  res.end();
  // console.info('wrote', size, 'bytes to cache');

  function sendHeaders() {
    response.headers.forEach((value, key) => {
      res.setHeader(key, value);
    });
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
  return Cdn.all.some(cdn => cdn.matchesUrl(url));
}

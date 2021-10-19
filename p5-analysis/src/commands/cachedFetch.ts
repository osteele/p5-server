import crypto from 'crypto';
import fs from 'fs';
import fetch from 'node-fetch';

/** Wrapper for node-fetch that looks in a cache directory before fetching from
 * the network. If the cache is missing, it will be created. If the file is
 * missing, it will be fetched from the network and saved to the cache. If the
 * file is present, it will be read from the cache.
 *
 * Usage: const fetch = require('node-fetch-cache'); const res = await
 *  fetch('https://example.com/file.json'); console.log(res.text());
 *
 *  const fetch = require('node-fetch-cache')('/path/to/cache/dir'); const res =
 *  await fetch('https://example.com/file.json'); console.log(res.text());
 */
export async function cachedFetch(url: string) {
  const cacheDir = '/tmp/node-fetch-cache';
  // compute the md5 of url
  const hash = crypto.createHash('md5').update(url).digest('hex');
  const cachePath = `${cacheDir}/${hash}`;
  if (!fs.existsSync(cacheDir)) {
    fs.mkdirSync(cacheDir);
  }
  // if the file is less than a day old, read it from the cache
  if (
    fs.existsSync(cachePath) &&
    fs.statSync(cachePath).mtime.getTime() > Date.now() - 86400000
  ) {
    const text = fs.readFileSync(cachePath, 'utf-8');
    return {
      ok: true,
      status: 200,
      statusText: 'OK',
      text: () => Promise.resolve(text),
    };
  } else {
    const res = await fetch(url);
    const text = await res.text();
    if (res.ok) {
      fs.writeFileSync(cachePath, text);
    }
    return {
      ...res,
      ok: res.ok && 200 <= res.status && res.status < 300,
      text: () => Promise.resolve(text),
    };
  }
}

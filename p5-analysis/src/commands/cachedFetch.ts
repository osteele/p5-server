import crypto from 'crypto';
import fs from 'fs';
import fetch from 'node-fetch';

const CACHE_DIR = '/tmp/node-cdn-fetch-cache';

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
export async function cachedFetch(url: string): Promise<Response> {
  const hash = crypto.createHash('md5').update(url).digest('hex');
  const cacheDir = `${CACHE_DIR}/${hash.slice(0, 2)}`;
  const cachePath = `${cacheDir}/${hash.slice(2)}`;
  const cacheDataPath = `${cachePath}.data`;
  const cacheMetaPath = `${cachePath}.meta`;

  if (!fs.existsSync(cacheDir)) {
    fs.mkdirSync(cacheDir, { recursive: true });
  }
  // if the file is more than a day old, fetch the URL from the network
  if (
    !fs.existsSync(cacheMetaPath) ||
    fs.statSync(cacheMetaPath).mtime.getTime() < Date.now() - 86400000
  ) {
    if (process.env.DEBUG_NODE_CDN_CACHE) {
      // eslint-disable-next-line no-console
      console.debug(`cache miss: ${url}`);
    }
    const res = await fetch(url);
    if (res.ok) {
      const text = await res.text();
      fs.writeFileSync(cacheDataPath, text);
    } else {
      // fs.unlinkSync(cacheDataPath);
    }
    const meta: CacheEntry = {
      headers: Object.fromEntries(res.headers.entries()),
      ok: res.ok,
      redirected: res.redirected,
      status: res.status,
      statusText: res.statusText,
      type: res.type,
    };
    fs.writeFileSync(cacheMetaPath, JSON.stringify(meta));
  }

  // Read from the cache we just wrote. In a development context, this has no
  // noticeable efficiency impact; and, it reduces the number of code paths.
  const meta = JSON.parse(fs.readFileSync(cacheMetaPath, 'utf-8')) as CacheEntry;
  const text = meta.ok ? fs.readFileSync(cacheDataPath, 'utf-8') : undefined;
  return {
    ...meta,
    text: () => (meta.ok ? Promise.resolve(text!) : Promise.reject(meta.statusText)),
    url,
  };
}

type Response = {
  headers: { [key: string]: string };
  ok: boolean;
  redirected: boolean;
  status: number;
  statusText: string;
  text: () => Promise<string>;
  type: string;
  url: string;
};

type CacheEntry = Omit<Response, 'text' | 'url'>;

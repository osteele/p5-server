import nunjucks from 'nunjucks';
import { contentProxyCache } from '../server/cdnProxy';

function configureNunjucks() {
  nunjucks.configure(`${__dirname}/templates`, { autoescape: false });
}

export async function clearCache(): Promise<void> {
  let count = 0;
  await contentProxyCache.ls().then(cache => {
    count = Object.keys(cache).length;
  });
  await contentProxyCache.clear();
  console.log(count ? `Cleared ${count} entries` : 'Cache cleared');
}

export async function fillCache({ force = false, verbose = false, reload = false }) {
  const stats = await contentProxyCache.warm({ force, reload }, (message) => {
    switch (message.type) {
      case 'initial':
        if (!verbose) {
          process.stdout.write(`Warming cache from ${message.total} ${reload ? 'keys' : 'seeds'}...`);
        }
        break;
      case 'prefetch':
        if (verbose) {
          process.stdout.write(verbose ? `Prefetching ${message.url}...\n` : '.');
        }
        break;
      case 'progress':
        if (!verbose) {
          process.stdout.write('.');
        }
        break;
      case 'error':
        if (!verbose) process.stdout.write('\n');
        process.stderr.write(`Error: failed to fetch ${message.url}; error code: ${message.status}\n`);
        break;
    }
  });
  if (!verbose) {
    process.stdout.write('done\n');
  }
  const { total, failures, misses } = stats;
  if (failures > 0) {
    process.exit(1);
  }
  console.log(
    misses > 0
      ? `Added ${misses} entries, for a total of ${total}`
      : `All ${total} entries were already in the cache`
  );
}

export async function lsCache({ json = false, verbose = false }): Promise<void> {
  configureNunjucks();
  const cache = await contentProxyCache.ls();
  const entries = Object.entries(cache).map(entryToObject);
  // sort entries by origin url
  entries.sort((a, b) => a.originUrl.localeCompare(b.originUrl));
  if (json) {
    console.log(JSON.stringify(entries, null, 2));
  } else {
    const formatTime = (dt?: Date) => dt?.toLocaleString() ?? 'n/a';
    console.log(nunjucks.render('proxy-cache-entries.njk', { entries, formatTime, verbose }));
  }
}

export async function printCacheInfo(urlOrPath?: string): Promise<void> {
  configureNunjucks();
  const cache = await contentProxyCache.ls();
  if (urlOrPath) {
    const originUrl = isProxyUrl(urlOrPath) ?
      contentProxyCache.decodeProxyPath(new URL(urlOrPath).pathname)
      : urlOrPath;
    const entries = Object.entries(cache).map(entryToObject).filter(entry => entry.originUrl === originUrl);
    for (const entry of entries) {
      console.log(JSON.stringify(entry, null, 2));
    }
    if (entries.length === 0) {
      console.log(`No entry found for ${urlOrPath}`);
    }
  } else {
    const entries = Object.values(cache);
    const totalSize = entries.reduce((acc, entry) => acc + entry.size, 0);
    const oldest = entries.reduce(
      (acc, entry) => Math.min(acc, entry.time),
      Number.MAX_SAFE_INTEGER
    );
    const info = {
      entries,
      totalSize,
      proxyCachePath: contentProxyCache.cachePath,
      oldest: oldest < Number.MAX_SAFE_INTEGER ? new Date(oldest) : null
    };
    process.stdout.write(nunjucks.render('proxy-cache-info.njk', info));
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function entryToObject([key, value]: [string, any]) {
  const cacheControl = value.metadata.headers['cache-control'];
  const maxAge = (cacheControl?.match(/(?:^|\b)s-maxage=(\d+)/) || cacheControl?.match(/(?:^|\b)max-age=(\d+)/))?.[1];
  const expires = maxAge ? new Date(value.time + Number(maxAge) * 1000) : null;
  const requestHeaders = { ...JSON.parse(key), url: undefined };
  return {
    ...value,

    // inline metadata
    metadata: undefined,
    ...value.metadata,

    // replace time (number) by created (Date)
    time: undefined,
    created: new Date(value.time),

    // add properties
    expires,
    maxAge,
    requestHeaders,
  };
}

function isProxyUrl(url: string) {
  const u = new URL(url);
  return u.protocol.match(/^https?/)
    && u.hostname.match(/^localhost|127\.0\.0\.1$/)
    && contentProxyCache.isProxyPath(u.pathname);
}

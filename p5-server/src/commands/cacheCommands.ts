import nunjucks from 'nunjucks';
import { contentProxyCache } from '../server/cdnProxy';


export async function clearCache(): Promise<void> {
  await contentProxyCache.clear();
  console.log(`Cache cleared`);
}

export async function fillCache({ force = false, verbose = false }) {
  const stats = await contentProxyCache.warm({ force }, (message) => {
    switch (message.type) {
      case 'initial':
        if (!verbose) {
          process.stdout.write(`Warming cache from ${message.total} seeds`);
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
      ? `Added ${misses} entries for a total of ${total}`
      : `All ${total} entries were already in the cache`
  );
}

export function lsCache({ json = false, verbose = false }): void {
  nunjucks.configure(`${__dirname}/templates`, { autoescape: false });
  contentProxyCache.ls().then(cache => {
    const entries = Object.values(cache).map(entry => {
      const cacheControl = entry.metadata.headers['cache-control'];
      const maxAge = (cacheControl?.match(/(?:^|\b)s-maxage=(\d+)/) || cacheControl?.match(/(?:^|\b)max-age=(\d+)/))?.[1];
      const expires = maxAge ? new Date(entry.time + Number(maxAge) * 1000) : null;
      return {
        ...entry,
        // inline metadata
        ...entry.metadata,
        metadata: undefined,
        // replace time by created
        time: undefined,
        created: new Date(entry.time),
        // add properties
        maxAge,
        expires,
      };
    });
    // sort entries by origin url
    entries.sort((a, b) => a.originUrl.localeCompare(b.originUrl));
    if (json) {
      console.log(JSON.stringify(entries, null, 2));
    } else {
      const formatTime = (dt: Date | undefined | null) => dt?.toLocaleString() ?? 'n/a';
      console.log(nunjucks.render('proxy-cache-entries.njk', { entries, formatTime, verbose }));
    }
  });
}

export function printCacheInfo(): void {
  nunjucks.configure(`${__dirname}/templates`, { autoescape: false });
  contentProxyCache.ls().then(cache => {
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
  });
}

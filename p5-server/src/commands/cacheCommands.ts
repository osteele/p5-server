import nunjucks from 'nunjucks';
import { cacache, cachePath as proxyCachePath } from '../server/proxyCache';

export function lsCache({ json = false, verbose = false }): void {
  nunjucks.configure(`${__dirname}/templates`, { autoescape: false });
  cacache.ls(proxyCachePath).then(cache => {
    const entries = Object.values(cache).map(entry => {
      const cacheControl = entry.metadata.headers['cache-control'];
      const maxAge = cacheControl?.match(/max-age=(\d+)/)?.[1];
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
      const formatTime = (dt: Date) => dt?.toLocaleString() ?? 'n/a';
      console.log(nunjucks.render('proxy-cache-entries.njk', { entries, formatTime, verbose }));
    }
  });
}

export function printCacheInfo(): void {
  nunjucks.configure(`${__dirname}/templates`, { autoescape: false });
  cacache.ls(proxyCachePath).then(cache => {
    const entries = Object.values(cache);
    const totalSize = entries.reduce((acc, entry) => acc + entry.size, 0);
    const oldest = entries.reduce(
      (acc, entry) => Math.min(acc, entry.time),
      Number.MAX_SAFE_INTEGER
    );
    const info = {
      entries,
      totalSize,
      proxyCachePath,
      oldest: oldest < Number.MAX_SAFE_INTEGER ? new Date(oldest) : null
    };
    process.stdout.write(nunjucks.render('proxy-cache-info.njk', info));
  });
}

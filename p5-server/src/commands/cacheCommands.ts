import nunjucks from 'nunjucks';
import { cacache, cachePath as proxyCachePath } from '../server/cdnProxy';

export function lsCache({ json = false, verbose = false }): void {
  nunjucks.configure(`${__dirname}/templates`, { autoescape: false });
  cacache.ls(proxyCachePath).then(cache => {
    const entries = Object.values(cache).map(entry => {
      const cacheControl = entry.metadata.headers['cache-control'];
      const maxAge = cacheControl?.match(/max-age=(\d+)/)?.[1];
      const expires = maxAge ? new Date(entry.time + Number(maxAge) * 1000) : null;
      return {
        created: new Date(entry.time),
        expires,
        expiresString: expires ? expires.toLocaleString() : null,
        maxAge,
        url: decodeURIComponent(entry.key),
        ...entry,
        ...entry.metadata,
        metadata: undefined
      };
    });
    if (json) {
      console.log(JSON.stringify(entries, null, 2));
    } else {
      console.log(nunjucks.render('proxy-cache-entries.njk', { entries, verbose }));
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

import nunjucks from 'nunjucks';
import { cacache, cachePath as proxyCachePath } from '../server/cdnProxy';

export function lsCache(): void {
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
        headers: entry.metadata.headers,
        url: decodeURIComponent(entry.key),
        ...entry
      };
    });
    console.log(nunjucks.render('proxyCache.njk', { entries, Object }));
  });
}

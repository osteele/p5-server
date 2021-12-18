import { Cdn, Library } from 'p5-analysis';
import { p5Version } from 'p5-analysis/dist/models/Library';
import { isDefined } from '../ts-extras';
import { createProxyCache } from './proxyCache';

export const proxyPrefix = '/__p5_proxy_cache';
export const cachePath = process.env.HOME + '/.cache/p5-server';

/** A list of CDNs that aren't listed in the p5-analysis Library model (because
 * they aren't specific to serving NPM packages).
 */
const cdnDomains = [
  'fonts.googleapis.com',
  'fonts.gstatic.com',
  // JSDelivr is a known npm package proxy, but the templates use a different path schema to request Highlight.js
  // distribution files.
  'cdn.jsdelivr.net',
]

/** URLs to warm the cache with, that can't be inferred from the libraries, in
 * addition to library loadPaths.
 *
 * It's okay if these have repeats. The cache warmer deduplicates URLs anyway.
 */
const cacheSeeds = [
  // TODO: use an API to retrieve this constant
  `https://cdn.jsdelivr.net/npm/p5@${p5Version}/lib/p5.min.js`, // p5importPath
  // TODO: read the following from the template file. Or, add these to the package.
  // directory.pug
  'https://cdn.jsdelivr.net/npm/jquery@3.6/dist/jquery.min.js',
  'https://cdn.jsdelivr.net/npm/semantic-ui@2.4/dist/semantic.min.js',
  'https://cdn.jsdelivr.net/npm/semantic-ui@2.4/dist/semantic.min.css',
  'https://cdn.jsdelivr.net/gh/highlightjs/cdn-release@11.2.0/build/styles/default.min.css',
  // markdown.pug
  'https://cdn.jsdelivr.net/npm/semantic-ui@2.4/dist/semantic.min.css',
  'https://cdn.jsdelivr.net/gh/highlightjs/cdn-release@11.2.0/build/styles/default.min.css',
  // source-view.pug
  "https://cdn.jsdelivr.net/gh/highlightjs/cdn-release@11.2.0/build/styles/github-dark.min.css",
  "https://cdn.jsdelivr.net/gh/highlightjs/cdn-release@11.2.0/build/highlight.min.js",
]

//#region CDN recognition

// exported for unit tests
export function isCdnUrl(url: string): boolean {
  if (!/^https?:/.test(url)) return false;
  return Cdn.all.some(cdn => cdn.matchesUrl(url))
    || getLibraryImportPaths().has(url)
    || cdnDomains.includes(new URL(url).hostname);
}

/** Cache for memoizing getLibraryImportPaths. */
let _libraryImportPaths: Set<string>;

function getLibraryImportPaths() {
  _libraryImportPaths ??= new Set(Library.all.map(lib => lib.importPath).filter(isDefined));
  return _libraryImportPaths;
}

//#endregion

export const contentProxyCache = createProxyCache({
  proxyPrefix,
  cachePath,
  cacheSeeds: [...cacheSeeds, ...getLibraryImportPaths()],
  shouldProxyPath: isCdnUrl,
});

export const { replaceUrlsInHtml, router: cdnProxyRouter } = contentProxyCache;

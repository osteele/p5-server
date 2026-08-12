import {
  clearCache as clearProxyCache,
  listCache,
  showCacheInfo,
  warmCache,
} from 'cdn-proxy-cache';
import { contentProxyCache } from '../server/cdnProxy.js';

export function clearCache(): Promise<void> {
  return clearProxyCache(contentProxyCache);
}

export function fillCache(
  options: NonNullable<Parameters<typeof warmCache>[1]> = {}
): Promise<void> {
  return warmCache(contentProxyCache, options);
}

export function lsCache(
  options: NonNullable<Parameters<typeof listCache>[1]> = {}
): Promise<void> {
  return listCache(contentProxyCache, options);
}

export function printCacheInfo(urlOrPath?: string): Promise<void> {
  return showCacheInfo(contentProxyCache, urlOrPath);
}

import { Cdn } from '../src';

test('Cdn.length', () => {
  expect(Cdn.all.length).toBe(3);
});

describe('Cdn.parseUrl', () => {
  test('recognizes all CDNs', () => {
    expect(Cdn.parseUrl('https://cdn.jsdelivr.net/npm/p5.rotate-about')?.packageName).toBe('p5.rotate-about');
    expect(Cdn.parseUrl('https://cdn.skypack.dev/p5.rotate-about')?.packageName).toBe('p5.rotate-about');
    expect(Cdn.parseUrl('https://unpkg.com/p5.rotate-about')?.packageName).toBe('p5.rotate-about');
  });

  test('recognizes version numbers', () => {
    expect(Cdn.parseUrl('https://cdn.jsdelivr.net/npm/p5.rotate-about')).toStrictEqual({ packageName: 'p5.rotate-about', version: undefined });
    expect(Cdn.parseUrl('https://cdn.jsdelivr.net/npm/p5.rotate-about@1.0')).toEqual({ packageName: 'p5.rotate-about', version: '1.0' });
    expect(Cdn.parseUrl('https://cdn.jsdelivr.net/npm/p5.rotate-about@1.0.0')).toEqual({ packageName: 'p5.rotate-about', version: '1.0.0' });
    expect(Cdn.parseUrl('https://cdn.jsdelivr.net/npm/p5.rotate-about@latest')).toEqual({ packageName: 'p5.rotate-about', version: 'latest' });
  });
});

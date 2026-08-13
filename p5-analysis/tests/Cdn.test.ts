import { Cdn, parseNpmSpecifier } from '../src';

test('Cdn.length', () => {
  expect(Cdn.all.length).toBe(3);
});

describe('Cdn.parseUrl', () => {
  test('recognizes all CDNs', () => {
    expect(
      Cdn.parseUrl('https://cdn.jsdelivr.net/npm/p5.rotate-about')?.packageName
    ).toBe('p5.rotate-about');
    expect(
      Cdn.parseUrl('https://cdn.skypack.dev/p5.rotate-about')?.packageName
    ).toBe('p5.rotate-about');
    expect(Cdn.parseUrl('https://unpkg.com/p5.rotate-about')?.packageName).toBe(
      'p5.rotate-about'
    );
  });

  test('recognizes version numbers', () => {
    expect(
      Cdn.parseUrl('https://cdn.jsdelivr.net/npm/p5.rotate-about')
    ).toStrictEqual({ packageName: 'p5.rotate-about', version: undefined });
    expect(
      Cdn.parseUrl('https://cdn.jsdelivr.net/npm/p5.rotate-about@1.0')
    ).toEqual({ packageName: 'p5.rotate-about', version: '1.0' });
    expect(
      Cdn.parseUrl('https://cdn.jsdelivr.net/npm/p5.rotate-about@1.0.0')
    ).toEqual({ packageName: 'p5.rotate-about', version: '1.0.0' });
    expect(
      Cdn.parseUrl('https://cdn.jsdelivr.net/npm/p5.rotate-about@latest')
    ).toEqual({ packageName: 'p5.rotate-about', version: 'latest' });
  });

  test('recognizes scoped packages', () => {
    expect(
      Cdn.parseUrl(
        'https://cdn.jsdelivr.net/npm/@gohai/p5.webserial/libraries/p5.webserial.js'
      )
    ).toEqual({ packageName: '@gohai/p5.webserial', version: undefined });
    expect(
      Cdn.parseUrl('https://unpkg.com/@scope/package@2.1.0/dist/index.js')
    ).toEqual({ packageName: '@scope/package', version: '2.1.0' });
    expect(
      Cdn.parseUrl('https://cdn.skypack.dev/@scope/package@latest')
    ).toEqual({ packageName: '@scope/package', version: 'latest' });
  });
});

describe('parseNpmSpecifier', () => {
  test('parses scoped and unscoped package specifiers', () => {
    expect(parseNpmSpecifier('p5.capture@1.0.0')).toEqual({
      packageName: 'p5.capture',
      version: '1.0.0',
    });
    expect(parseNpmSpecifier('@gohai/p5.webserial')).toEqual({
      packageName: '@gohai/p5.webserial',
      version: undefined,
    });
  });

  test('rejects paths and incomplete scopes', () => {
    expect(parseNpmSpecifier('@scope')).toBeNull();
    expect(parseNpmSpecifier('package/dist/index.js')).toBeNull();
  });
});

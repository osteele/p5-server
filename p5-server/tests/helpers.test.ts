import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { parse } from 'node-html-parser';
import {
  pathComponentsForBreadcrumbs,
  pathIsInDirectory,
  resolvePathInDirectory,
  transformHtml,
} from '../src/helpers';

test('pathIsInDirectory', () => {
  expect(pathIsInDirectory('a/b', 'a/b/c')).toBe(false);
  expect(pathIsInDirectory('a/b/c', 'a/b')).toBe(true);
  expect(pathIsInDirectory('a/b', 'a/c')).toBe(false);
  expect(pathIsInDirectory('/a/b', '/a/b/c')).toBe(false);
  expect(pathIsInDirectory('/a/b/c', '/a/b')).toBe(true);
  expect(pathIsInDirectory('/a/b', '/a/b')).toBe(true);
});

test('resolvePathInDirectory', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'p5-server-path-test-'));
  const outsideDir = fs.mkdtempSync(
    path.join(os.tmpdir(), 'p5-server-outside-path-test-')
  );
  try {
    fs.writeFileSync(path.join(dir, 'inside.js'), 'inside');
    fs.writeFileSync(path.join(outsideDir, 'outside.js'), 'outside');
    fs.symlinkSync(outsideDir, path.join(dir, 'linked'));

    expect(resolvePathInDirectory('/inside.js', dir)).toBe(
      path.join(dir, 'inside.js')
    );
    expect(resolvePathInDirectory('/../outside.js', dir)).toBeNull();
    expect(resolvePathInDirectory('/linked/outside.js', dir)).toBeNull();
  } finally {
    fs.rmSync(dir, { force: true, recursive: true });
    fs.rmSync(outsideDir, { force: true, recursive: true });
  }
});

test('pathComponentsForBreadcrumbs', () => {
  expect(pathComponentsForBreadcrumbs('')).toEqual([
    { path: '/', name: 'Home' },
  ]);
  expect(pathComponentsForBreadcrumbs('/')).toEqual([
    { path: '/', name: 'Home' },
  ]);
  expect(pathComponentsForBreadcrumbs('/a')).toEqual([
    { path: '/', name: 'Home' },
    { path: '/a', name: 'a' },
  ]);
  expect(pathComponentsForBreadcrumbs('/a/')).toEqual([
    { path: '/', name: 'Home' },
    { path: '/a', name: 'a' },
  ]);
  expect(pathComponentsForBreadcrumbs('/a/b')).toEqual([
    { path: '/', name: 'Home' },
    { path: '/a', name: 'a' },
    { path: '/a/b', name: 'b' },
  ]);
});

test('transformHtml batches scripts and URL rewrites', () => {
  const html = transformHtml(
    '<html><head><script src="https://cdn.example/app.js"></script></head><body></body></html>',
    {
      headScripts: [
        { source: '/after.js' },
        { source: { settings: { seed: 42 } }, prepend: true },
      ],
      transformUrl: (url) =>
        url.startsWith('https://cdn.example/')
          ? `/proxy/${url.slice('https://'.length)}`
          : undefined,
    }
  );
  const scripts = parse(html).querySelectorAll('script');

  expect(scripts).toHaveLength(3);
  expect(scripts[0].text).toContain('const settings = {"seed":42};');
  expect(scripts[1].attributes.src).toBe('/proxy/cdn.example/app.js');
  expect(scripts[2].attributes.src).toBe('/after.js');
});

test('transformHtml can rewrite relative URLs', () => {
  const html = transformHtml('<script src="app.js"></script>', {
    transformUrl: (url) => `/assets/${url}`,
  });

  expect(parse(html).querySelector('script')?.attributes.src).toBe(
    '/assets/app.js'
  );
});

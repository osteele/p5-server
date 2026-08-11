import fs from 'fs';
import os from 'os';
import path from 'path';
import {
  pathComponentsForBreadcrumbs,
  pathIsInDirectory,
  resolvePathInDirectory
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
  expect(pathComponentsForBreadcrumbs('')).toEqual([{ path: '/', name: 'Home' }]);
  expect(pathComponentsForBreadcrumbs('/')).toEqual([{ path: '/', name: 'Home' }]);
  expect(pathComponentsForBreadcrumbs('/a')).toEqual([
    { path: '/', name: 'Home' },
    { path: '/a', name: 'a' }
  ]);
  expect(pathComponentsForBreadcrumbs('/a/')).toEqual([
    { path: '/', name: 'Home' },
    { path: '/a', name: 'a' }
  ]);
  expect(pathComponentsForBreadcrumbs('/a/b')).toEqual([
    { path: '/', name: 'Home' },
    { path: '/a', name: 'a' },
    { path: '/a/b', name: 'b' }
  ]);
});

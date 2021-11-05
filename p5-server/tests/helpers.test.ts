import { pathComponentsForBreadcrumbs, pathIsInDirectory } from '../src/helpers';

test('pathIsInDirectory', () => {
  expect(pathIsInDirectory('a/b', 'a/b/c')).toBe(true);
  expect(pathIsInDirectory('a/b/c', 'a/b')).toBe(false);
  expect(pathIsInDirectory('a/b', 'a/c')).toBe(false);
  expect(pathIsInDirectory('/a/b', '/a/b/c')).toBe(true);
  expect(pathIsInDirectory('/a/b/c', '/a/b')).toBe(false);
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

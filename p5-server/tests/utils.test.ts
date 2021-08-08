import { pathComponentsForBreadcrumbs } from '../src/utils';

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

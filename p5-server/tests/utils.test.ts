import { pathComponentsForBreadcrumbs, terminalCodesToHtml } from '../src/utils';

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

describe('terminalCodesToHtml', () => {
  test('foreground colors', () => {
    expect(terminalCodesToHtml('\x1b[30ma')).toEqual(
      '<span style="color: black">a</span>'
    );
    expect(terminalCodesToHtml('\x1b[31ma')).toEqual(
      '<span style="color: red">a</span>'
    );
    expect(terminalCodesToHtml('\x1b[32ma')).toEqual(
      '<span style="color: green">a</span>'
    );
    expect(terminalCodesToHtml('\x1b[37ma')).toEqual(
      '<span style="color: white">a</span>'
    );
  });

  test('background colors', () => {
    expect(terminalCodesToHtml('\x1b[40ma')).toEqual(
      '<span style="background: black">a</span>'
    );
    expect(terminalCodesToHtml('\x1b[41ma')).toEqual(
      '<span style="background: red">a</span>'
    );
    expect(terminalCodesToHtml('\x1b[47ma')).toEqual(
      '<span style="background: white">a</span>'
    );
  });

  test('sequencing', () => {
    expect(terminalCodesToHtml('\x1b[31ma\x1b[0mb')).toEqual(
      '<span style="color: red">a</span>b'
    );
    expect(terminalCodesToHtml('\x1b[31ma\x1b[mb')).toEqual(
      '<span style="color: red">a</span>b'
    );
    expect(terminalCodesToHtml('\x1b[31mr\x1b[32mg\x1b[34mb')).toEqual(
      '<span style="color: red">r</span><span style="color: green">g</span><span style="color: blue">b</span>'
    );
  });
  // expect(terminalCodesToHtml('\x1b[31m\x1b[1m')).toEqual();
  // expect(terminalCodesToHtml('\x1b[31m\x1b[1m\x1b[2m')).toEqual();
  // expect(terminalCodesToHtml('\x1b[0m \x1b[90m 5 |\x1b[39m \x1b[36mfunction\x1b[39m draw() {\x1b[0m').toEqual();
});

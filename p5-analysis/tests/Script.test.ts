import { Script } from '../src/lib/Script';

test('Script.fromFile', () => {
  const filePath = './tests/testdata/circles.js';
  const script: Script = Script.fromFile(filePath);
  expect(script).toBeInstanceOf(Script);
  expect(script.filename).toBe(filePath);
});

test('Script.getErrors', () => {
  expect(() => Script.fromSource('const const;').defs).toThrow(
    /Unexpected keyword 'const'/
  );
  expect(Script.fromSource('let a;').getErrors()).toEqual([]);

  const errs = Script.fromSource('const const;').getErrors();
  expect(errs).toHaveLength(1);
  expect(errs[0].message).toMatch(/Unexpected keyword 'const'/);
});

describe('Script..defs', () => {
  test('finds function definitions', () => {
    expect(Script.fromSource('function f() {}').defs).toEqual(
      new Map([['f', 'function']])
    );

    expect(Script.fromSource('function f() {}; function g() {}').defs).toEqual(
      new Map([
        ['f', 'function'],
        ['g', 'function']
      ])
    );
  });

  test('ignores nested functions', () =>
    expect(Script.fromSource('function f() {function g(){}}').defs).toEqual(
      new Map([['f', 'function']])
    ));

  test('finds variable definitons', () =>
    expect(Script.fromSource('let a, b').defs).toEqual(
      new Map([
        ['a', 'variable'],
        ['b', 'variable']
      ])
    ));

  test('finds pattern variables', () => {
    expect(Script.fromSource('let [a, b, ...c] = [e, f]').defs).toEqual(
      new Map([
        ['a', 'variable'],
        ['b', 'variable'],
        ['c', 'variable']
      ])
    );

    expect(Script.fromSource('let {a, b:c, d:{e}} = {f}').defs).toEqual(
      new Map([
        ['a', 'variable'],
        ['c', 'variable'],
        ['e', 'variable']
      ])
    );
  });

  test('ignores local variables', () =>
    expect(Script.fromSource('function f() {function g(){let a;}}').defs).toEqual(
      new Map([['f', 'function']])
    ));

  test('ignores variable initializers', () =>
    expect(Script.fromSource('let a = b').defs).toEqual(new Map([['a', 'variable']])));

  test('finds class definitions', () =>
    expect(Script.fromSource('class C {}').defs).toEqual(new Map([['C', 'class']])));
});

describe('Script.refs', () => {
  const free = (code: string) => Array.from(Script.fromSource(code).refs).sort();

  test('finds references in functions', () => {
    expect(free('function f() {}')).toEqual([]);
    expect(free('function f(a) {a}')).toEqual([]);
    expect(free('function f(a) {b}')).toEqual(['b']);
    expect(free('function f() {g}')).toEqual(['g']);
    expect(free('function f() {g}; function g() {}')).toEqual([]);
  });

  test('ignores references to local variables', () => {
    expect(free('function f(a) {let b; b}')).toEqual([]);
    expect(free('function f(a) {let b; c}')).toEqual(['c']);
    expect(free('function f(a) {let b=c}')).toEqual(['c']);
    expect(free('function f(a) {let b=a; let c=b}')).toEqual([]);
  });

  test.skip('finds references to variables that are used before they are defined', () => {
    expect(free('function f() {let b=c; let c=b}')).toEqual(['c']);
  });

  test('finds references in expressions', () => {
    expect(free('function f() {a + b}')).toEqual(['a', 'b']);
    expect(free('function f() {a ? b : c}')).toEqual(['a', 'b', 'c']);
    expect(free('function f() {let a = b + c}')).toEqual(['b', 'c']);
    expect(free('let a = b + c')).toEqual(['b', 'c']);
  });

  test('finds references in function calls and nested functions', () => {
    expect(free('function f(a) {g()}')).toEqual(['g']);
    expect(free('function f(a) {f(a); g(b)}')).toEqual(['b', 'g']);
    expect(free('function f(a) {let b; function g(c) {a+b+c+d}}')).toEqual(['d']);
  });

  test('finds references in function expressions', () => {
    expect(free('let f = function(a) {a + b}')).toEqual(['b']);
    expect(free('let f = a => a + b')).toEqual(['b']);
  });

  test('finds references in control structures', () => {
    expect(free('function f() {for (i=a; i<b; i+=c) d;}')).toEqual([
      'a',
      'b',
      'c',
      'd',
      'i'
    ]);
    expect(free('function f() {for (let i=a; i<b; i+=c) d;}')).toEqual([
      'a',
      'b',
      'c',
      'd'
    ]);
    expect(free('function f() {for (p of obj) p, a;}')).toEqual(['a', 'obj', 'p']);
    expect(free('function f() {for (const p of obj) p, a;}')).toEqual(['a', 'obj']);
    expect(free('function f() {if(a)b;else c}')).toEqual(['a', 'b', 'c']);
  });

  test('finds references in class definitions', () => {
    expect(free('class A { constructor() { this.a = b; A} }')).toEqual(['b']);
    expect(free('class A { m(a) { a,b; } }')).toEqual(['b']);
    expect(free('class A extends B {}')).toEqual(['B']);
    expect(free('class A {}; class B extends A {}')).toEqual([]);
  });

  test('finds references in class expressions', () => {
    expect(free('const A = class { constructor() { this.a = b; A}}')).toEqual(['b']);
  });

  test('finds references in template literals', () => {
    expect(free('let a = `${b+c} ${d}}`')).toEqual(['b', 'c', 'd']);
    expect(free('let a = f`${b+c} ${d}`')).toEqual(['b', 'c', 'd', 'f']);
  });

  test('finds references in array spread', () => {
    expect(free('let a = [b, ...c, ...d]')).toEqual(['b', 'c', 'd']);
  });
  test.skip('finds references in object spread', () => {
    expect(free('let a = {b: c, ...d, ...e}')).toEqual(['c', 'd', 'e']);
  });

  test('finds references in the kitchen sink test', () => {
    expect(Script.fromFile('./tests/testdata/free-variables.js').refs).toEqual(
      new Set(['gf1', 'gf2', 'gv1', 'l3'])
    );
  });
});

test('Script.p5properties', () => {
  const props = (source: string) =>
    Array.from(Script.fromSource(source).p5propRefs).sort();

  expect(props('function f() {}')).toEqual([]);
  expect(props('function f() {p5.p}')).toEqual(['p']);
  expect(props('function f() {p5.m()}')).toEqual(['m']);
  expect(props('function f() {new p5.c}')).toEqual(['c']);
  expect(props('function f() {new p5.c()}')).toEqual(['c']);

  // function expressions
  expect(props('let f = function() {p5.c}')).toEqual(['c']);
  expect(props('let f = () => p5.c')).toEqual(['c']);
});

test('Script.loadCallArguments', () => {
  const calls = (source: string) =>
    Array.from(Script.fromSource(source).loadCallArguments).sort();

  expect(calls('function f() {}')).toEqual([]);
  expect(calls('function f() {loadImage("s")}')).toEqual(['s']);

  // function expressions
  expect(calls('let f = function() {loadImage("s")}')).toEqual(['s']);
  expect(calls('let f = () => loadImage("s")')).toEqual(['s']);
});

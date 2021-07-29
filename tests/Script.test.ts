import { Script } from "../src/models/Script";

test('Script.findGlobals', () => {
    expect(Script.fromSource('function f() {}').globals).toEqual(new Set(['f']));
    expect(Script.fromSource('function f() {}; function g() {}').globals).toEqual(new Set('fg'));
    expect(Script.fromSource('function f() {function g(){}}').globals).toEqual(new Set('f'));

    // for now, globals is only function definitions
    expect(Script.fromSource('let a, b').globals).toEqual(new Set());
    expect(Script.fromSource('class A {}').globals).toEqual(new Set());
});

test('Script.freeVariables', () => {
    expect(Script.fromSource('function f() {}').freeVariables).toEqual(new Set());
    expect(Script.fromSource('function f(a) {a}').freeVariables).toEqual(new Set());
    expect(Script.fromSource('function f(a) {b}').freeVariables).toEqual(new Set('b'));
    expect(Script.fromSource('function f() {g}').freeVariables).toEqual(new Set('g'));
    expect(Script.fromSource('function f() {g}; function g() {}').freeVariables).toEqual(new Set());

    // local variables
    expect(Script.fromSource('function f(a) {let b; b}').freeVariables).toEqual(new Set());
    expect(Script.fromSource('function f(a) {let b; c}').freeVariables).toEqual(new Set('c'));
    expect(Script.fromSource('function f(a) {let b=c}').freeVariables).toEqual(new Set('c'));
    expect(Script.fromSource('function f(a) {let b=a; let c=b}').freeVariables).toEqual(new Set());
    expect(Script.fromSource('function f() {let b=c; let c=b}').freeVariables).toEqual(new Set('c'));

    // expressions
    expect(Script.fromSource('function f() {a + b}').freeVariables).toEqual(new Set('ab'));
    expect(Script.fromSource('function f() {a ? b : c}').freeVariables).toEqual(new Set('abc'));

    expect(Script.fromSource('function f() {let a = b + c}').freeVariables).toEqual(new Set('bc'));
    expect(Script.fromSource('let a = b + c').freeVariables).toEqual(new Set('bc'));

    // function calls and nested functions
    expect(Script.fromSource('function f(a) {g()}').freeVariables).toEqual(new Set('g'));
    expect(Script.fromSource('function f(a) {f(a); g(b)}').freeVariables).toEqual(new Set('gb'));
    expect(Script.fromSource('function f(a) {let b; function g(c) {a+b+c+d}}').freeVariables).toEqual(new Set('d'));

    // function expressions
    expect(Script.fromSource('let f = function(a) {a + b}').freeVariables).toEqual(new Set('b'));
    expect(Script.fromSource('let f = a => a + b').freeVariables).toEqual(new Set('b'));

    // control structures
    expect(Script.fromSource('function f() {for (i=a; i<b; i+=c) d;}').freeVariables).toEqual(new Set('iabcd'));
    expect(Script.fromSource('function f() {for (let i=a; i<b; i+=c) d;}').freeVariables).toEqual(new Set('abcd'));
    expect(Script.fromSource('function f() {for (p of obj) p, a;}').freeVariables).toEqual(new Set(['obj', 'a', 'p']));
    // expect(Script.fromSource('function f() {for (const p of obj) p, a;}').freeVariables).toEqual(new Set(['obj', 'a']));
    expect(Script.fromSource('function f() {if(a)b;else c}').freeVariables).toEqual(new Set('abc'));

    // classes
    expect(Script.fromSource('class A { constructor() { this.a = b; } }').freeVariables).toEqual(new Set('b'));
    expect(Script.fromSource('class A { m(a) { a,b; } }').freeVariables).toEqual(new Set('b'));
    expect(Script.fromSource('class A extends B {}').freeVariables).toEqual(new Set('B'));
    expect(Script.fromSource('class A {}; class B extends A {}').freeVariables).toEqual(new Set());

    // template literals
    // eslint-disable-next-line no-useless-escape
    expect(Script.fromSource('let a = \`${b+c} ${d}}\`').freeVariables).toEqual(new Set('bcd'));
    expect(Script.fromSource('let a = f`${b+c} ${d}`').freeVariables).toEqual(new Set('fbcd'));
});

test('Script.p5properties', () => {
    expect(Script.fromSource('function f() {}').p5properties).toEqual(new Set());
    expect(Script.fromSource('function f() {p5.p}').p5properties).toEqual(new Set('p'));
    expect(Script.fromSource('function f() {p5.m()}').p5properties).toEqual(new Set('m'));
    expect(Script.fromSource('function f() {new p5.c}').p5properties).toEqual(new Set('c'));
    expect(Script.fromSource('function f() {new p5.c()}').p5properties).toEqual(new Set('c'));

    // function expressions
    expect(Script.fromSource('let f = function() {p5.c}').p5properties).toEqual(new Set('c'));
    expect(Script.fromSource('let f = () => p5.c').p5properties).toEqual(new Set('c'));
});

test('Script.loadalls', () => {
    expect(Script.fromSource('function f() {}').loadCallArguments).toEqual(new Set());
    expect(Script.fromSource('function f() {loadImage("s")}').loadCallArguments).toEqual(new Set('s'));

    // function expressions
    expect(Script.fromSource('let f = function() {loadImage("s")}').loadCallArguments).toEqual(new Set('s'));
    expect(Script.fromSource('let f = () => loadImage("s")').loadCallArguments).toEqual(new Set('s'));
});

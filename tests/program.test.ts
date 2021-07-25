import { analyzeScript } from "../src/models/program";

test('analyzeScript globals', () => {
    expect(analyzeScript('function f() {}').globals).toEqual(new Set(['f']));
    expect(analyzeScript('function f() {}; function g() {}').globals).toEqual(new Set(['f', 'g']));
    expect(analyzeScript('function f() {function g(){}}').globals).toEqual(new Set(['f']));
});

test('analyzeScript free variables', () => {
    expect(analyzeScript('function f() {}').freeVariables).toEqual(new Set());
    expect(analyzeScript('function f(a) {a}').freeVariables).toEqual(new Set());
    expect(analyzeScript('function f(a) {b}').freeVariables).toEqual(new Set('b'));
    expect(analyzeScript('function f() {g}').freeVariables).toEqual(new Set('g'));
    expect(analyzeScript('function f() {g}; function g() {}').freeVariables).toEqual(new Set());

    // local variables
    expect(analyzeScript('function f(a) {let b; b}').freeVariables).toEqual(new Set());
    expect(analyzeScript('function f(a) {let b; c}').freeVariables).toEqual(new Set('c'));

    // expressions
    expect(analyzeScript('function f() {a + b}').freeVariables).toEqual(new Set(['a', 'b']));
    // expect(analyzeScript('function f() {a ? b : c}').freeVariables).toEqual(new Set(['a', 'b', 'c']));

    expect(analyzeScript('function f() {let a = b + c}').freeVariables).toEqual(new Set(['b', 'c']));
    // expect(analyzeScript('let a = b + c').freeVariables).toEqual(new Set(['b', 'c']));

    // function calls and nested functions
    expect(analyzeScript('function f(a) {g()}').freeVariables).toEqual(new Set('g'));
    expect(analyzeScript('function f(a) {f(a); g(b)}').freeVariables).toEqual(new Set(['g', 'b']));
    expect(analyzeScript('function f(a) {let b; function g(c) {a+b+c+d}}').freeVariables).toEqual(new Set('d'));

    // control structures
    expect(analyzeScript('function f() {for (i=0; i<10; i++) a;}').freeVariables).toEqual(new Set(['i', 'a']));
    // expect(analyzeScript('function f() {for (let i=0; i<10; i++) a;}').freeVariables).toEqual(new Set(['i', 'a']));
    expect(analyzeScript('function f() {for (p of obj) p, a;}').freeVariables).toEqual(new Set(['obj', 'a', 'p']));
    // expect(analyzeScript('function f() {for (const p of obj) p, a;}').freeVariables).toEqual(new Set(['obj', 'a']));
    expect(analyzeScript('function f() {if(a)b;else c}').freeVariables).toEqual(new Set(['a', 'b', 'c']));
});

test('analyzeScript p5 property references', () => {
    expect(analyzeScript('function f() {}').p5properties).toEqual(new Set());
    expect(analyzeScript('function f() {p5.p}').p5properties).toEqual(new Set("p"));
    expect(analyzeScript('function f() {p5.m()}').p5properties).toEqual(new Set("m"));
    expect(analyzeScript('function f() {new p5.c}').p5properties).toEqual(new Set("c"));
    expect(analyzeScript('function f() {new p5.c()}').p5properties).toEqual(new Set("c"));
});

test('analyzeScript loadXXX calls', () => {
    expect(analyzeScript('function f() {}').loadCallArguments).toEqual(new Set());
    expect(analyzeScript('function f() {loadImage("s")}').loadCallArguments).toEqual(new Set("s"));
});

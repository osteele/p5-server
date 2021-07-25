import { analyzeScript } from "../src/models/program";

test('analyzeScript globals', () => {
    expect(analyzeScript('function f() {}').globals).toEqual(new Set(['f']));
    expect(analyzeScript('function f() {}; function g() {}').globals).toEqual(new Set(['f', 'g']));
    expect(analyzeScript('function f() {function g(){}}').globals).toEqual(new Set(['f']));
});

test('analyzeScript free variables', () => {
    expect(analyzeScript('function f() {}', { deep: true }).freeVariables).toEqual(new Set());
    expect(analyzeScript('function f(a) {a}', { deep: true }).freeVariables).toEqual(new Set());
    expect(analyzeScript('function f(a) {b}', { deep: true }).freeVariables).toEqual(new Set('b'));

    // local variables
    expect(analyzeScript('function f(a) {let b; b}', { deep: true }).freeVariables).toEqual(new Set());
    expect(analyzeScript('function f(a) {let b; c}', { deep: true }).freeVariables).toEqual(new Set('c'));

    // expressions
    expect(analyzeScript('function f() {a + b}', { deep: true }).freeVariables).toEqual(new Set(['a', 'b']));
    // expect(analyzeScript('function f() {a ? b : c}', { deep: true }).freeVariables).toEqual(new Set(['a', 'b', 'c']));

    expect(analyzeScript('function f() {let a = b + c}', { deep: true }).freeVariables).toEqual(new Set(['b', 'c']));
    // expect(analyzeScript('let a = b + c', { deep: true }).freeVariables).toEqual(new Set(['b', 'c']));

    // function calls and nested functions
    expect(analyzeScript('function f(a) {g()}', { deep: true }).freeVariables).toEqual(new Set('g'));
    expect(analyzeScript('function f(a) {f(a); g(b)}', { deep: true }).freeVariables).toEqual(new Set(['g', 'b']));
    expect(analyzeScript('function f(a) {let b; function g(c) {a+b+c+d}}', { deep: true }).freeVariables).toEqual(new Set('d'));

    // control structures
    expect(analyzeScript('function f() {for (i=0; i<10; i++) a;}', { deep: true }).freeVariables).toEqual(new Set(['i', 'a']));
    // expect(analyzeScript('function f() {for (let i=0; i<10; i++) a;}', { deep: true }).freeVariables).toEqual(new Set(['i', 'a']));
    expect(analyzeScript('function f() {for (p of obj) p, a;}', { deep: true }).freeVariables).toEqual(new Set(['obj', 'a', 'p']));
    // expect(analyzeScript('function f() {for (const p of obj) p, a;}', { deep: true }).freeVariables).toEqual(new Set(['obj', 'a']));
    expect(analyzeScript('function f() {if(a)b;else c}', { deep: true }).freeVariables).toEqual(new Set(['a', 'b', 'c']));
});

test('analyzeScript p5 references', () => {
    expect(analyzeScript('function f() {}', { deep: true }).p5Properties).toEqual(new Set());
    expect(analyzeScript('function f() {p5.p}', { deep: true }).p5Properties).toEqual(new Set("p"));
    expect(analyzeScript('function f() {p5.m()}', { deep: true }).p5Properties).toEqual(new Set("m"));
});

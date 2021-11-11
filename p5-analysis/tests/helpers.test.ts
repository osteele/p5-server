import { sizeof } from '../src/helpers';

describe('sizeof', () => {
  test('boolean', () => {
    expect(sizeof(true)).toBe(4);
    expect(sizeof(false)).toBe(4);
  });

  test('null', () => {
    expect(sizeof(undefined)).toBe(0);
  });

  test('number', () => {
    expect(sizeof(1)).toBe(8);
  });

  test('string', () => {
    expect(sizeof('')).toBe(4);
    expect(sizeof('hello')).toBe(14);
  });

  test('undefined', () => {
    expect(sizeof(undefined)).toBe(0);
  });

  test('array', () => {
    expect(sizeof([])).toBe(8);
    expect(sizeof([1, 2, 3])).toBe(32);
  });

  test('object', () => {
    expect(sizeof({})).toBe(60);
    expect(sizeof({ a: 1, b: 2 })).toBe(88);
    expect(sizeof({ a: 'hello', b: 'world' })).toBe(100);
  });

  test('function', () => {
    // eslint-disable-next-line @typescript-eslint/no-empty-function
    expect(sizeof(() => {})).toBe(40);
  });

  test('bigint', () => {
    expect(sizeof(BigInt(1))).toBe(32);
  });

  test('Set', () => {
    expect(sizeof(new Set())).toBe(40);
    expect(sizeof(new Set([1, 2, 3, 4]))).toBe(72);
    expect(sizeof(new Set(['hello', 'world']))).toBe(68);
  });

  test('Map', () => {
    expect(sizeof(new Map())).toBe(40);
    expect(
      sizeof(
        new Map([
          ['a', 1],
          ['b', 2]
        ])
      )
    ).toBe(68);
  });
});

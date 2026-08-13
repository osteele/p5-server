import { jsonCycleStringifier } from '../src/jsonCycleStringifier';

test('round-trips shared references and cycles without changing identity', () => {
  const shared: { label: string; self?: unknown } = { label: 'shared' };
  shared.self = shared;
  const input = { first: shared, second: shared };
  const { parse, stringify } = jsonCycleStringifier();

  const output = parse(stringify(input));

  expect(output.first).toBe(output.second);
  expect(output.first.self).toBe(output.first);
  expect(output.first.label).toBe('shared');
});

test('round-trips BigInt values', () => {
  const { parse, stringify } = jsonCycleStringifier();

  expect(parse(stringify({ value: 12n }))).toEqual({ value: 12n });
});

test('keeps ordinary JSON in its ordinary representation', () => {
  const { stringify } = jsonCycleStringifier();

  expect(stringify({ value: [1, 2, 3] })).toBe('{"value":[1,2,3]}');
});

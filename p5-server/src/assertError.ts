import { types } from 'node:util';

/** Assert that a caught value is an Error with an optional Node.js error code. */
export function assertError(
  value: unknown
): asserts value is Error & { code?: string } {
  if (!types.isNativeError(value)) {
    throw new TypeError(
      `Expected an \`Error\`, got \`${JSON.stringify(value)}\` (${typeof value})`
    );
  }
}

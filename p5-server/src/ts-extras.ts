/** This function is adapted from https://github.com/sindresorhus/ts-extras.
 */

const { toString } = Object.prototype;

// Modified to add optional `code` property.
export function assertError(
  value: unknown
): asserts value is Error & { code?: string } {
  if (!(value instanceof Error || toString.call(value) === '[object Error]')) {
    throw new TypeError(
      `Expected an \`Error\`, got \`${JSON.stringify(value)}\` (${typeof value})`
    );
  }
}

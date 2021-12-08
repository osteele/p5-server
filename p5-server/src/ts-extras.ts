/** These functions are adapted from https://github.com/sindresorhus/ts-extras.
 *
 * They are here so that I don't have to debug why esbuild-jest produces an
 * error (`SyntaxError: Unexpected token 'export'`) when it tries to compile a
 * file that imports the ts-extras package. (Possibly something that could be
 * fixed via `transformIgnorePatterns`, but the standard
 * "node_modules/(?!(@etc." value did not fix this.)
 */

const { toString } = Object.prototype;

// Modified from the original to add optional `code` property.
export function assertError(
  value: unknown
): asserts value is Error & { code?: string } {
  if (!(value instanceof Error || toString.call(value) === '[object Error]')) {
    throw new TypeError(
      `Expected an \`Error\`, got \`${JSON.stringify(value)}\` (${typeof value})`
    );
  }
}

/** Check whether a value is defined (non-nullable), meaning it is neither
 * `null` or `undefined`.
 */
export function isDefined<T>(value: T | null | undefined): value is T {
  return value !== null && value !== undefined;
}

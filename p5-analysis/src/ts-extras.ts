/** This function is copied from https://github.com/sindresorhus/ts-extras.
 *
 * It is here so that I don't have to debug why esbuild-jest produces an error
 * (`SyntaxError: Unexpected token 'export'`) when it tries to compile a file
 * that imports the ts-extras package. (Possibly something that could be fixed
 * via `transformIgnorePatterns`, but the standard "node_modules/(?!(@etc."
 * value did not fix this.)
 */
export function isDefined<T>(value: T | null | undefined): value is T {
  return value !== null && value !== undefined;
}

/** Print the message to standard output; then exit with status code 1.
 */
export function die(message: string, ...optionalParams: unknown[]): never {
  console.error(`Error: ${message}`, ...optionalParams);
  process.exit(1);
}

import chalk from 'chalk';
import path from 'path';

/** Print the message to standard output; then exit with status code 1.
 */
export function die(message: string): never {
  console.error(chalk.red('Error:', message));
  process.exit(1);
}

export function escapeHTML(str: string) {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function pathComponentsForBreadcrumbs(
  relDirPath: string
): { name: string; path: string }[] {
  // normalize the path: remove the final '/' if it exists
  return (
    relDirPath
      .replace(/\/$/, '')
      .split('/')
      // skip the first element. We're going to use an init arg to reduce()
      // instead.
      .slice(1)
      .reduce(
        (crumbs, name) => [
          ...crumbs,
          {
            name,
            path: (crumbs[crumbs.length - 1].path + '/').replace('//', '/') + name
          }
        ],
        [{ name: 'Home', path: '/' }]
      )
  );
}

export function pathIsInDirectory(filepath: string, dir: string) {
  return !(path.relative(filepath, dir) + path.sep).startsWith('..' + path.sep);
}

export const stringToOptions = (str: string | null) =>
  str
    ? Object.fromEntries<boolean>(
        str.split(',').map(s => (/no-/.test(s) ? [s.substring(3), false] : [s, true]))
      )
    : {};

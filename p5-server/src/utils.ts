import chalk from 'chalk';
import { HTMLElement, parse as parseHtml } from 'node-html-parser';
import open from 'open';
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

// This is similar to open.open, except that it also accepts 'safari' as an app name
export function openInBrowser(url: string, browser?: string) {
  const appName: open.AppName | 'safari' | undefined =
    browser === 'safari'
      ? 'safari'
      : browser! in open.apps
      ? (browser as open.AppName)
      : undefined;
  if (browser && !browser) {
    die(`Unknown browser: ${browser}`);
  }
  const openApps = { safari: 'safari', ...open.apps };
  const openOptions: open.Options = appName ? { app: { name: openApps[appName] } } : {};
  open(url, openOptions);
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
            path: (crumbs[crumbs.length - 1].path + '/').replace('//', '/') + name,
          },
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

export function addScriptToHtmlHead(
  html: string,
  source: string | Record<string, unknown>
): string {
  const htmlRoot = parseHtml(html);
  const scriptNode = new HTMLElement(
    'script',
    {},
    typeof source === 'string' ? `src=${JSON.stringify(source)}` : '',
    null
  );
  if (source instanceof Object) {
    scriptNode.textContent = Object.entries(source)
      .map(([k, v]) => `const ${k} = ${JSON.stringify(v)};`)
      .join('\n');
  }
  htmlRoot.querySelector('head').appendChild(scriptNode);

  return htmlRoot.outerHTML;
}

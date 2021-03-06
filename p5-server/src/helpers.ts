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

/** Escape HTML special characters in a string.
 */
export function escapeHTML(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 *	Open a URL in the browser.
 *
 * This is a wrapper for `open()` from the 'open' package. It has the same API,
 *	 except that it also accepts 'safari' as an app name.
 */
export function openInBrowser(
  url: string,
  browser?: string
): Promise<import('child_process').ChildProcess> {
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
  return open(url, openOptions);
}

/**
 * 'a/b/c' => [{name: 'Home', path: '/'}, {name: 'a', path: '/a'}, {name: 'b', path: '/a/b'}, {name: 'c', path: '/a/b/c'}]
 */
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

/** Tests whether filepath is inside the directory `dir`. */
export function pathIsInDirectory(filepath: string, dir: string): boolean {
  return !(path.relative(filepath, dir) + path.sep).startsWith('..' + path.sep);
}

/** Returns true iff pathname ends in a markdown file suffix. */
export function pathIsMarkdown(filepath: string): boolean {
  return /\.(md|mkd|mkdn|mdwn|mdown|markdown)$/i.test(filepath);
}

/**
 * Examples:
 * 'a,b,c' => {a: true, b: true, c: true}
 * 'a,no-b,c' => {a: true, b: false, c: true}
 */
export function stringToOptions(str: string | null): { [k: string]: boolean } {
  return str
    ? Object.fromEntries<boolean>(
        str.split(',').map(s => [s.replace(/^no-/, ''), !s.startsWith('no-')])
      )
    : {};
}

let warnedAboutMissingHtmlBody = false;

/** Insert a <script> element in an HTML document's head.
 *
 * If the source argument is a string, it becomes the value of the element's
 * `src` attribute.
 *
 * If it is an object with a key `script` it becomes the text content of the
 * element.
 *
 * Otherwise it is an Object; the script tag defines its keys as global
 * variables, that are initialized to the corresponding values.
 */
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
    scriptNode.textContent =
      'script' in source
        ? (source.script as string)
        : Object.entries(source)
            .map(([k, v]) => `const ${k} = ${JSON.stringify(v)};`)
            .join('\n');
  }
  // The following works during development. Previously it has failed in distr:
  // htmlRoot.querySelector(tagName) always returns null.
  if (!htmlRoot.querySelector('head')) {
    const body = htmlRoot.querySelector('body');
    if (body) body.appendChild(new HTMLElement('head', {}, '', null));
    else if (!warnedAboutMissingHtmlBody) {
      console.warn('HTML document did not have a body');
      warnedAboutMissingHtmlBody = true;
    }
  }
  const head = htmlRoot.querySelector('head');
  if (!head) {
    return html.replace(/(<\/head>)/, '$1' + scriptNode.outerHTML);
  }
  head.appendChild(scriptNode);
  return htmlRoot.outerHTML;
}

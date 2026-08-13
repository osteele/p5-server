import type { ChildProcess } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import chalk from 'chalk';
import { HTMLElement, parse as parseHtml } from 'node-html-parser';
import open, { type AppName, apps, type Options as OpenOptions } from 'open';

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
): Promise<ChildProcess> {
  const appName: AppName | 'safari' | undefined =
    browser === 'safari'
      ? 'safari'
      : browser && browser in apps
        ? (browser as AppName)
        : undefined;
  if (browser && !appName) {
    die(`Unknown browser: ${browser}`);
  }
  const openApps = { safari: 'safari', ...apps };
  const openOptions: OpenOptions = appName
    ? { app: { name: openApps[appName] } }
    : {};
  return open(url, openOptions);
}

/**
 * 'a/b/c' => [{name: 'Home', path: '/'}, {name: 'a', path: '/a'}, {name: 'b', path: '/a/b'}, {name: 'c', path: '/a/b/c'}]
 */
export function pathComponentsForBreadcrumbs(
  relDirPath: string
): { name: string; path: string }[] {
  // normalize the path: remove the final '/' if it exists
  const names = relDirPath.replace(/\/$/, '').split('/').slice(1);
  const crumbs = [{ name: 'Home', path: '/' }];
  for (const name of names) {
    const parentPath = crumbs[crumbs.length - 1].path;
    crumbs.push({
      name,
      path: path.posix.join(parentPath, encodeURIComponent(name)),
    });
  }
  return crumbs;
}

/** Tests whether filepath is inside the directory `dir`. */
export function pathIsInDirectory(filepath: string, dir: string): boolean {
  const relativePath = path.relative(path.resolve(dir), path.resolve(filepath));
  return (
    relativePath === '' ||
    (relativePath !== '..' &&
      !relativePath.startsWith(`..${path.sep}`) &&
      !path.isAbsolute(relativePath))
  );
}

/** Canonicalize a path for collision checks on common macOS and Windows filesystems. */
export function portablePathKey(filePath: string): string {
  const resolved = path.resolve(filePath);
  const { root } = path.parse(resolved);
  const relative = resolved.slice(root.length);
  return (
    root.toLowerCase() +
    relative.split(path.sep).map(portablePathComponentKey).join(path.sep)
  );
}

/** Reject relative path components that cannot name regular files on Windows. */
export function assertPortableRelativePath(relativePath: string): void {
  if (path.sep !== '\\' && relativePath.includes('\\')) {
    throw new Error(
      `Path is not portable to Windows because it contains an invalid filename character: ${relativePath}`
    );
  }
  for (const component of relativePath.split(/[\\/]/u).filter(Boolean)) {
    const normalized = component.normalize('NFD').replace(/[ .]+$/u, '');
    const stem = normalized.split('.', 1)[0];
    if (/^(con|prn|aux|nul|com[1-9¹²³]|lpt[1-9¹²³])$/iu.test(stem)) {
      throw new Error(
        `Path is not portable to Windows because it uses a reserved device name: ${relativePath}`
      );
    }
    if (
      [...component].some((character) => character.charCodeAt(0) <= 31) ||
      /[<>:"|?*]/u.test(component)
    ) {
      throw new Error(
        `Path is not portable to Windows because it contains an invalid filename character: ${relativePath}`
      );
    }
    if (/[ .]$/u.test(component)) {
      throw new Error(
        `Path is not portable to Windows because it ends in a dot or space: ${relativePath}`
      );
    }
  }
}

function portablePathComponentKey(component: string): string {
  const normalized = component
    .normalize('NFD')
    .toLowerCase()
    .replace(/[ .]+$/u, '');
  const regularName = normalized.split(':', 1)[0];
  const stem = regularName.split('.', 1)[0];
  return /^(con|prn|aux|nul|com[1-9¹²³]|lpt[1-9¹²³])$/iu.test(stem)
    ? `\0device:${stem}`
    : regularName;
}

/** Resolve a relative path inside `dir`, rejecting lexical and symlink escapes. */
export function resolvePathInDirectory(
  filepath: string,
  dir: string
): string | null {
  const resolvedDir = path.resolve(dir);
  const relativePath = filepath.replace(/^[/\\]+/, '');
  const resolvedPath = path.resolve(resolvedDir, relativePath);
  if (!pathIsInDirectory(resolvedPath, resolvedDir)) return null;

  const realDir = fs.realpathSync(resolvedDir);
  let existingAncestor = resolvedPath;
  while (!fs.existsSync(existingAncestor)) {
    const parent = path.dirname(existingAncestor);
    if (parent === existingAncestor) return null;
    existingAncestor = parent;
  }
  const realAncestor = fs.realpathSync(existingAncestor);
  if (!pathIsInDirectory(realAncestor, realDir)) return null;
  return resolvedPath;
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
        str.split(',').map((s) => [s.replace(/^no-/, ''), !s.startsWith('no-')])
      )
    : {};
}

let warnedAboutMissingHtmlBody = false;

export type HtmlHeadScript = {
  source: string | Record<string, unknown>;
  prepend?: boolean;
};

export type HtmlTransformOptions = {
  headScripts?: readonly HtmlHeadScript[];
  transformUrl?: (url: string) => string | undefined;
};

/** Apply script insertions and URL rewrites in a single HTML parse. */
export function transformHtml(
  html: string,
  { headScripts = [], transformUrl }: HtmlTransformOptions
): string {
  if (headScripts.length === 0 && !transformUrl) return html;

  const htmlRoot = parseHtml(html);
  let modified = false;

  if (transformUrl) {
    const attributes: readonly [selector: string, attribute: string][] = [
      ['script[src]', 'src'],
      ['link[rel=stylesheet][href]', 'href'],
    ];
    for (const [selector, attribute] of attributes) {
      for (const element of htmlRoot.querySelectorAll(selector)) {
        const value = element.attributes[attribute];
        const replacement = transformUrl(value);
        if (replacement !== undefined && replacement !== value) {
          element.setAttribute(attribute, replacement);
          modified = true;
        }
      }
    }
  }

  if (headScripts.length === 0) {
    return modified ? htmlRoot.outerHTML : html;
  }

  const scriptNodes = headScripts.map(({ source }) => createScriptNode(source));
  if (!htmlRoot.querySelector('head')) {
    const body = htmlRoot.querySelector('body');
    if (body) {
      body.appendChild(
        new HTMLElement('head', {}, '', undefined, undefined, undefined)
      );
    } else if (!warnedAboutMissingHtmlBody) {
      console.warn('HTML document did not have a body');
      warnedAboutMissingHtmlBody = true;
    }
  }
  const head = htmlRoot.querySelector('head');
  if (!head) {
    return html.replace(
      /(<\/head>)/,
      `$1${scriptNodes.map((node) => node.outerHTML).join('')}`
    );
  }
  for (const [index, { prepend }] of headScripts.entries()) {
    const scriptHtml = scriptNodes[index].outerHTML;
    if (prepend) {
      head.insertAdjacentHTML('afterbegin', scriptHtml);
    } else {
      head.appendChild(scriptNodes[index]);
    }
  }
  return htmlRoot.outerHTML;
}

export function addScriptsToHtmlHead(
  html: string,
  scripts: readonly HtmlHeadScript[]
): string {
  return transformHtml(html, { headScripts: scripts });
}

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
  source: string | Record<string, unknown>,
  options: { prepend?: boolean } = {}
): string {
  return addScriptsToHtmlHead(html, [{ source, prepend: options.prepend }]);
}

function createScriptNode(
  source: string | Record<string, unknown>
): HTMLElement {
  const scriptNode = new HTMLElement(
    'script',
    {},
    typeof source === 'string' ? `src=${JSON.stringify(source)}` : '',
    undefined,
    undefined,
    undefined
  );
  if (source instanceof Object) {
    scriptNode.textContent =
      'script' in source
        ? (source.script as string)
        : Object.entries(source)
            .map(([k, v]) => `const ${k} = ${JSON.stringify(v)};`)
            .join('\n');
  }
  return scriptNode;
}

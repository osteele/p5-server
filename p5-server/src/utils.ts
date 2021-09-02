import chalk from 'chalk';

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

const escapeCodeColors = [
  'black',
  'red',
  'green',
  'yellow',
  'blue',
  'magenta',
  'cyan',
  'white'
];

const colorNamesToRGB: Record<string, number> = {
  black: 0x000000,
  red: 0xcc0000,
  green: 0x4e9a06,
  yellow: 0xc4a000,
  blue: 0x729fcf,
  magenta: 0x75507b,
  cyan: 0x06989a,
  white: 0xd3d7cf
};

export function terminalCodesToHtml(s: string, usePalette: boolean = false) {
  let output = '';
  const stack = [];
  const state: { color: string | null; background: string | null } = {
    color: null,
    background: null
  };
  // eslint-disable-next-line no-control-regex
  for (const f of s.split(/(\x1b\[\d*m)/)) {
    if (f.startsWith('\x1b')) {
      const code = parseInt(f.slice(2), 10) || 0;
      if (code === 0) {
        state.color = null;
        state.background = null;
      } else if (30 <= code && code <= 39) {
        state.color = color(code - 30);
      } else if (40 <= code && code <= 49) {
        state.background = color(code - 40);
      }
      while (stack.length > 0) output += stack.pop();
      const style = Object.entries(state)
        .filter(([_k, v]) => v)
        .map(([k, v]) => `${k}: ${v}`)
        .join(';');
      if (style) {
        output += `<span style="${style}">`;
        stack.push('</span>');
      }
    } else {
      output += f
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
    }
  }
  while (stack.length > 0) output += stack.pop();
  return output;

  function color(code: number) {
    if (code >= 8) return null;
    const name = escapeCodeColors[code];
    if (usePalette) {
      const hex = (0x1000000 + colorNamesToRGB[name]).toString(16).substring(1);
      return `#${hex}`;
    } else {
      return name;
    }
  }
}

import { writeFile } from 'fs/promises';
import open from 'open';
import path from 'path/posix';
import { die } from '../utils';
import { Server } from '../server/Server';

type Options = {
  output?: string;
  browser: 'safari' | 'chrome' | 'firefox' | 'edge';
  skipFrames: number;
};

export default async function screenshot(source: string, options: Options) {
  const output =
    options.output || path.basename(source).replace(/\.(js|html?)$/, '') + '.png';
  if (!/\.png$/.test(output)) {
    die('The output file extension must be .png');
  }
  let skipFrames = Number(options.skipFrames || 0);
  const serverOptions = {
    root: source,
    screenshot: { onFrame },
  };
  const server = await Server.start(serverOptions);
  const appName: open.AppName | 'safari' | null =
    options.browser === 'safari'
      ? 'safari'
      : options.browser in open.apps
      ? options.browser
      : null;
  if (options.browser && !appName) {
    die(`Unknown browser: ${options.browser}`);
  }
  const openApps = { safari: 'safari', ...open.apps };
  const openOptions: open.Options = appName ? { app: { name: openApps[appName] } } : {};
  open(server.url!, openOptions);

  let savedFrames = 0;
  async function onFrame({ data }: { data: Buffer }) {
    if (skipFrames-- >= 0) return;
    if (savedFrames++ > 0) return;

    // run this asynchronously
    saveAndQuit();
    return { close: true };

    async function saveAndQuit() {
      await writeFile(output, data);
      console.log(`Saved screenshot from ${source} to ${output}`);

      // FIXME: why doesn't server.stop() work?
      // server.server?.on('close', () => console.info('server closed'));
      // server.server?.close();
      setTimeout(() => process.exit(0), 100);
    }
  }
}

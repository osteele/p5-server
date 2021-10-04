import { writeFile } from 'fs/promises';
import open from 'open';
import { Sketch } from 'p5-analysis';
import path from 'path/posix';
import { Server } from '../server/Server';
import { die } from '../utils';

type Options = {
  output?: string;
  browser?: 'safari' | 'chrome' | 'firefox' | 'edge';
  canvasSize: string;
  pixelDensity: string;
  skipFrames: number;
};

export default async function screenshot(source: string, options: Options) {
  if (await Sketch.isSketchDir(source)) {
    // const sketch = await Sketch.fromDirectory(source);
    // source = sketch.mainFilePath;
  } else if (!(await Sketch.isSketchFile(source))) {
    die(`${source} is not a sketch file`);
  }

  const output =
    options.output ||
    path
      .basename(source.replace(/(.+)\/index\.html?/i, '$1'))
      .replace(/\.(js|html?)$/i, '') + '.png';
  if (!/\.png$/i.test(output)) {
    die('The output file extension must be .png');
  }

  let savedFrames = 0;
  const skipFrames = Number(options.skipFrames || 0);

  let canvasDimensions = undefined;
  if (options.canvasSize) {
    const m = options.canvasSize.match(/^(\d+)(?:[x, ](\d+))?$/);
    if (!m) {
      die(`Invalid canvas size: ${options.canvasSize}`);
    }
    canvasDimensions = { width: Number(m[1]), height: Number(m[2] ?? m[1]) };
  }

  let pixelDensity = undefined;
  if (options.pixelDensity) {
    const m = options.pixelDensity.match(
      /^(\d+(?:\.\d*)?|\.\d+)(?:\/(\d+(?:\.\d*)?|\.\d+))?$/
    );
    if (!m) {
      die(`Invalid pixel density: ${options.pixelDensity}`);
    }
    pixelDensity = Number(m[1]) / Number(m[2] || 1);
  }

  const serverOptions = {
    root: source,
    screenshot: {
      onFrameData,
      skipFrames,
      canvasDimensions,
      pixelDensity,
      type: {
        png: 'image/png',
      },
    },
  };
  const server = await Server.start(serverOptions);

  openInBrowser(server.url!, options.browser?.toLowerCase());

  async function onFrameData({ data }: { data: Buffer }) {
    if (savedFrames++ > 0) return;

    await writeFile(output, data);
    console.log(`Saved screenshot from ${source} to ${output}`);

    // FIXME: why doesn't server.stop() work?
    // server.server?.on('close', () => console.info('server closed'));
    // server.server?.close();
    setTimeout(() => process.exit(0), 100);
  }
}

function openInBrowser(url: string, browser?: string) {
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

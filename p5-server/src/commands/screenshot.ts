import { mkdir, writeFile } from 'fs/promises';
import { Sketch } from 'p5-analysis';
import path from 'path/posix';
import { Server } from '../server/Server';
import { die, openInBrowser } from '../utils';

type Options = {
  output?: string;
  browser?: 'safari' | 'chrome' | 'firefox' | 'edge';
  canvasSize: string;
  frameCount: string;
  pixelDensity: string;
  skipFrames: string;
};

const typeMap: Record<string, 'jpeg' | 'png'> = {
  jpeg: 'jpeg',
  jpg: 'jpeg',
  png: 'png'
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
      .replace(/\.(js|html?)$/i, '') +
      (Number(options.frameCount || 1) > 1 ? '-%d.png' : '.png');

  const ext = output.split('.').pop() ?? 'png';
  const imageType = typeMap[ext.toLowerCase()];
  if (!imageType) {
    die('The output file extension must be .png or .jpeg');
  }

  const serverOptions: Server.Options = {
    root: source,
    screenshot: {
      onFrameData,
      imageType,
      ...parseScreenshotOptions(options)
    }
  };
  let remainingFrames = serverOptions.screenshot?.frameCount || 1;
  if (remainingFrames > 1 && !/%\d*d/.test(output)) {
    console.warn(
      'Warning: For best results, include a %d in the output filename when capturing multiple frames'
    );
  }

  const server = await Server.start(serverOptions);
  openInBrowser(server.url!, options.browser?.toLowerCase());

  async function onFrameData({
    data,
    frameNumber
  }: {
    data: Buffer;
    frameNumber: number;
  }) {
    if (remainingFrames < 0) return;

    const fname = output.replace(/%\d*d/g, fmt => {
      let s = String(frameNumber);
      const m = fmt.match(/%(0)?(\d+)/);
      if (m) {
        const pad = m[1] || '0';
        const len = Number(m[2]);
        s = s.padStart(len, pad);
      }
      return s;
    });
    await mkdir(path.dirname(fname), { recursive: true });
    await writeFile(fname, data);
    console.log(`Saved screenshot from ${source} to ${fname}`);

    if (--remainingFrames == 0) {
      // Give the client time to receive the request response, so that it knows
      // to close.
      setTimeout(() => process.exit(0), 100);
    }
  }
}

function parseScreenshotOptions(options: Options): Server.Options['screenshot'] {
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

  const frameCount = Number(options.frameCount || 1);

  return {
    canvasDimensions,
    frameCount,
    pixelDensity,
    skipFrames
  };
}

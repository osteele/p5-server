import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { Sketch } from 'p5-analysis';
import { die, openInBrowser } from '../helpers.js';
import { Server } from '../server/Server.js';
import {
  parseDimensions,
  parseNonNegativeInteger,
  parsePositiveNumber,
} from './agentOptions.js';

type Options = {
  output?: string;
  browser?: 'safari' | 'chrome' | 'firefox' | 'edge';
  canvasSize: string;
  frameCount: string;
  pixelDensity: string;
  skipFrames: string;
  timeout?: string;
};

type ScreenshotFrame = {
  data: Buffer;
  frameNumber: number;
};

type ScreenshotFrameWriterDependencies = {
  mkdir: typeof mkdir;
  writeFile: typeof writeFile;
  log: (message: string) => void;
};

const typeMap: Record<string, 'jpeg' | 'png'> = {
  jpeg: 'jpeg',
  jpg: 'jpeg',
  png: 'png',
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

  const screenshotOptions = parseScreenshotOptions(options);
  const frameWriter = createScreenshotFrameWriter(
    output,
    source,
    screenshotOptions.frameCount ?? 1
  );
  const serverOptions: Server.Options = {
    root: source,
    screenshot: {
      onFrameData: frameWriter.onFrameData,
      imageType,
      ...screenshotOptions,
    },
  };
  const timeoutMs = 1_000 * parseScreenshotTimeout(options.timeout || '30');
  const frameCount = serverOptions.screenshot?.frameCount || 1;
  if (frameCount > 1 && !/%\d*d/.test(output)) {
    console.warn(
      'Warning: For best results, include a %d in the output filename when capturing multiple frames'
    );
  }

  const server = await Server.start(serverOptions);
  let timeout: ReturnType<typeof setTimeout> | undefined;
  const deadline = new Promise<never>((_resolve, reject) => {
    timeout = setTimeout(
      () => reject(new Error('The screenshot timed out')),
      timeoutMs
    );
  });
  let operationError: unknown;
  try {
    await Promise.race([
      (async () => {
        await openInBrowser(server.url!, options.browser?.toLowerCase());
        await frameWriter.completion;
      })(),
      deadline,
    ]);
  } catch (error) {
    operationError = error;
  } finally {
    clearTimeout(timeout);
    const cleanup = await Promise.allSettled([
      server.close(),
      frameWriter.stopAndDrain(),
    ]);
    const cleanupErrors = cleanup.flatMap((result) =>
      result.status === 'rejected' ? [result.reason] : []
    );
    if (cleanupErrors.length) {
      const errors = operationError
        ? [operationError, ...cleanupErrors]
        : cleanupErrors;
      operationError =
        errors.length === 1
          ? errors[0]
          : new AggregateError(
              errors,
              'The screenshot operation and cleanup did not complete cleanly'
            );
    }
  }
  if (operationError) throw operationError;
}

export function createScreenshotFrameWriter(
  output: string,
  source: string,
  frameCount: number,
  dependencies: ScreenshotFrameWriterDependencies = {
    log: console.log,
    mkdir,
    writeFile,
  }
): {
  completion: Promise<void>;
  onFrameData(frame: ScreenshotFrame): Promise<void>;
  stopAndDrain(): Promise<void>;
} {
  let remainingFrames = frameCount;
  let acceptingFrames = true;
  let resolveCompletion: () => void = () => undefined;
  let rejectCompletion: (reason: unknown) => void = () => undefined;
  const completion = new Promise<void>((resolve, reject) => {
    resolveCompletion = resolve;
    rejectCompletion = reject;
  });
  const writes: Promise<void>[] = [];
  const pathTails = new Map<string, Promise<void>>();

  return { completion, onFrameData, stopAndDrain };

  async function onFrameData({ data, frameNumber }: ScreenshotFrame) {
    if (!acceptingFrames || remainingFrames <= 0) return;
    remainingFrames -= 1;
    const fname = screenshotFrameFilename(output, frameNumber);
    const previous = pathTails.get(fname) ?? Promise.resolve();
    const write = previous
      .catch(() => undefined)
      .then(async () => {
        await dependencies.mkdir(screenshotOutputDirectory(fname), {
          recursive: true,
        });
        await dependencies.writeFile(fname, data);
        dependencies.log(`Saved screenshot from ${source} to ${fname}`);
      });
    pathTails.set(fname, write);
    writes.push(write);
    void write.catch(() => undefined);

    if (remainingFrames === 0) {
      void Promise.allSettled(writes).then((results) => {
        const errors = results.flatMap((result) =>
          result.status === 'rejected' ? [result.reason] : []
        );
        if (errors.length === 0) resolveCompletion();
        else if (errors.length === 1) rejectCompletion(errors[0]);
        else {
          rejectCompletion(
            new AggregateError(errors, 'Failed to save every screenshot frame')
          );
        }
      });
    }
    await write;
  }

  async function stopAndDrain(): Promise<void> {
    acceptingFrames = false;
    const results = await Promise.allSettled(writes);
    const errors = results.flatMap((result) =>
      result.status === 'rejected' ? [result.reason] : []
    );
    if (errors.length === 1) throw errors[0];
    if (errors.length > 1) {
      throw new AggregateError(errors, 'Failed to save every accepted frame');
    }
  }
}

function screenshotFrameFilename(output: string, frameNumber: number): string {
  return output.replace(/%\d*d/g, (format) => {
    let frame = String(frameNumber);
    const match = format.match(/%(0)?(\d+)/);
    if (match) {
      const pad = match[1] || '0';
      frame = frame.padStart(Number(match[2]), pad);
    }
    return frame;
  });
}

export function parseScreenshotOptions(
  options: Options
): NonNullable<Server.Options['screenshot']> {
  const skipFrames = parseNonNegativeInteger(
    options.skipFrames || '0',
    'skip frames'
  );

  let canvasDimensions: { width: number; height: number } | undefined;
  if (options.canvasSize) {
    canvasDimensions = parseDimensions(options.canvasSize, 'canvas size');
  }

  let pixelDensity: number | undefined;
  if (options.pixelDensity) {
    const m = options.pixelDensity.match(
      /^(\d+(?:\.\d*)?|\.\d+)(?:\/(\d+(?:\.\d*)?|\.\d+))?$/
    );
    if (!m) {
      die(`Invalid pixel density: ${options.pixelDensity}`);
    }
    pixelDensity = Number(m[1]) / Number(m[2] || 1);
    if (!Number.isFinite(pixelDensity) || pixelDensity <= 0) {
      throw new Error(
        `pixel density must be positive; received ${options.pixelDensity}`
      );
    }
  }

  const frameCount = parseNonNegativeInteger(
    options.frameCount || '1',
    'frame count'
  );
  if (frameCount === 0) throw new Error('frame count must be positive');
  if (options.timeout) parseScreenshotTimeout(options.timeout);

  return {
    canvasDimensions,
    frameCount,
    pixelDensity,
    skipFrames,
  };
}

const maximumTimerDelayMilliseconds = 2_147_483_647;

function parseScreenshotTimeout(value: string): number {
  const seconds = parsePositiveNumber(value, 'timeout');
  if (seconds * 1_000 > maximumTimerDelayMilliseconds) {
    throw new Error(`timeout is too large; received ${value}`);
  }
  return seconds;
}

export function screenshotOutputDirectory(
  output: string,
  pathImplementation: Pick<typeof path, 'dirname'> = path
): string {
  return pathImplementation.dirname(output);
}

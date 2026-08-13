import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import {
  createScreenshotFrameWriter,
  parseScreenshotOptions,
  screenshotOutputDirectory,
} from '../src/commands/screenshotCommand';

function deferred(): {
  promise: Promise<void>;
  resolve: () => void;
} {
  let resolve: () => void = () => undefined;
  const promise = new Promise<void>((resolvePromise) => {
    resolve = resolvePromise;
  });
  return { promise, resolve };
}

test('a setup-only sketch captures its first callback by default', async () => {
  const source = fs.readFileSync('src/client/screenshot.js', 'utf-8');
  let onReady: (() => void) | undefined;
  let posts = 0;
  let closeCount = 0;
  const windowObject: Record<string, unknown> = {
    addEventListener(name: string, listener: () => void) {
      if (name === 'DOMContentLoaded') onReady = listener;
    },
    close: () => {
      closeCount += 1;
    },
    setup: () => undefined,
  };
  vm.runInNewContext(source, {
    __p5_server_screenshot_settings: {},
    console,
    fetch: async () => {
      posts += 1;
      return { ok: true, status: 200 };
    },
    p5: { prototype: {} },
    window: windowObject,
  });

  onReady?.();
  const sketch = {
    canvas: { toDataURL: () => 'data:image/png;base64,AA==' },
    noLoop: () => undefined,
  };
  (windowObject.setup as (this: typeof sketch) => void).call(sketch);
  await new Promise((resolve) => setTimeout(resolve, 0));

  expect(posts).toBe(1);
  expect(closeCount).toBe(1);
});

test('a rejected screenshot POST reports its status and does not close the window', async () => {
  const source = fs.readFileSync('src/client/screenshot.js', 'utf-8');
  let onReady: (() => void) | undefined;
  let closeCount = 0;
  const errors: unknown[] = [];
  const windowObject: Record<string, unknown> = {
    addEventListener(name: string, listener: () => void) {
      if (name === 'DOMContentLoaded') onReady = listener;
    },
    close: () => {
      closeCount += 1;
    },
    setup: () => undefined,
  };
  vm.runInNewContext(source, {
    __p5_server_screenshot_settings: {},
    console: { error: (error: unknown) => errors.push(error) },
    fetch: async () => ({ ok: false, status: 500 }),
    p5: { prototype: {} },
    window: windowObject,
  });

  onReady?.();
  const sketch = {
    canvas: { toDataURL: () => 'data:image/png;base64,AA==' },
    noLoop: () => undefined,
  };
  (windowObject.setup as (this: typeof sketch) => void).call(sketch);
  await new Promise((resolve) => setTimeout(resolve, 0));

  expect(closeCount).toBe(0);
  expect(errors).toHaveLength(1);
  expect(String(errors[0])).toContain('HTTP 500');
});

test('screenshot options reject non-terminating numeric values', () => {
  const defaults = {
    canvasSize: '',
    frameCount: '1',
    pixelDensity: '',
    skipFrames: '0',
  };

  expect(() =>
    parseScreenshotOptions({ ...defaults, frameCount: '-1' })
  ).toThrow(/non-negative integer/);
  expect(() =>
    parseScreenshotOptions({ ...defaults, frameCount: '1.5' })
  ).toThrow(/non-negative integer/);
  expect(() =>
    parseScreenshotOptions({ ...defaults, pixelDensity: '1/0' })
  ).toThrow(/must be positive/);
  expect(() =>
    parseScreenshotOptions({ ...defaults, skipFrames: 'Infinity' })
  ).toThrow(/non-negative integer/);
  expect(() => parseScreenshotOptions({ ...defaults, timeout: '0' })).toThrow(
    /must be positive/
  );
  expect(() =>
    parseScreenshotOptions({ ...defaults, timeout: '9007199254740991' })
  ).toThrow(/too large/);
  expect(() =>
    parseScreenshotOptions({ ...defaults, canvasSize: '9'.repeat(400) })
  ).toThrow(/safe integers/);
});

test('screenshot output directories use native Windows separators', () => {
  expect(screenshotOutputDirectory('shots\\frame.png', path.win32)).toBe(
    'shots'
  );
});

test('multi-frame completion waits for every concurrent output write', async () => {
  const first = deferred();
  const second = deferred();
  const writes = new Map<string, ReturnType<typeof deferred>>([
    ['frame-0.png', first],
    ['frame-1.png', second],
  ]);
  const writer = createScreenshotFrameWriter('frame-%d.png', 'sketch.js', 2, {
    log: () => undefined,
    mkdir: async () => undefined,
    writeFile: async (filename) => writes.get(String(filename))!.promise,
  });
  let completed = false;
  writer.completion.then(() => {
    completed = true;
  });

  const firstWrite = writer.onFrameData({ data: Buffer.of(0), frameNumber: 0 });
  const secondWrite = writer.onFrameData({
    data: Buffer.of(1),
    frameNumber: 1,
  });
  second.resolve();
  await secondWrite;
  expect(completed).toBe(false);

  first.resolve();
  await Promise.all([firstWrite, writer.completion]);
  expect(completed).toBe(true);
});

test('multi-frame writes to one output path are serialized in frame order', async () => {
  const first = deferred();
  const firstStarted = deferred();
  const started: number[] = [];
  const writer = createScreenshotFrameWriter('frame.png', 'sketch.js', 2, {
    log: () => undefined,
    mkdir: async () => undefined,
    writeFile: async (_filename, data) => {
      started.push(data[0]);
      if (data[0] === 0) {
        firstStarted.resolve();
        await first.promise;
      }
    },
  });

  const firstWrite = writer.onFrameData({ data: Buffer.of(0), frameNumber: 0 });
  const secondWrite = writer.onFrameData({
    data: Buffer.of(1),
    frameNumber: 1,
  });
  await firstStarted.promise;
  expect(started).toEqual([0]);

  first.resolve();
  await Promise.all([firstWrite, secondWrite, writer.completion]);
  expect(started).toEqual([0, 1]);
});

test('multi-frame completion rejects when any output write fails', async () => {
  const failure = new Error('disk full');
  const second = deferred();
  const writer = createScreenshotFrameWriter('frame-%d.png', 'sketch.js', 2, {
    log: () => undefined,
    mkdir: async () => undefined,
    writeFile: async (filename) => {
      if (String(filename) === 'frame-0.png') throw failure;
      await second.promise;
    },
  });
  const completionError = writer.completion.then(
    () => null,
    (error: unknown) => error
  );

  await expect(
    writer.onFrameData({ data: Buffer.of(0), frameNumber: 0 })
  ).rejects.toBe(failure);
  const secondWrite = writer.onFrameData({
    data: Buffer.of(1),
    frameNumber: 1,
  });
  let completed = false;
  completionError.then(() => {
    completed = true;
  });
  await Promise.resolve();
  expect(completed).toBe(false);

  second.resolve();
  await secondWrite;
  expect(await completionError).toBe(failure);
});

test('stopping screenshot capture drains writes that were already accepted', async () => {
  const write = deferred();
  const writer = createScreenshotFrameWriter('frame.png', 'sketch.js', 2, {
    log: () => undefined,
    mkdir: async () => undefined,
    writeFile: async () => write.promise,
  });
  const acceptedWrite = writer.onFrameData({
    data: Buffer.of(0),
    frameNumber: 0,
  });
  let drained = false;
  const drain = writer.stopAndDrain().then(() => {
    drained = true;
  });
  await Promise.resolve();
  expect(drained).toBe(false);

  await writer.onFrameData({ data: Buffer.of(1), frameNumber: 1 });
  write.resolve();
  await Promise.all([acceptedWrite, drain]);
  expect(drained).toBe(true);
});

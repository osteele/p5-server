import fs from 'node:fs';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Script, Sketch } from 'p5-analysis';
import { type Browser, chromium, type Page } from 'playwright-core';
import { assertError } from '../assertError.js';
import { replaceUrlsInStack } from '../server/browserScriptEventRelay.js';
import { proxyPrefix } from '../server/cdnProxy.js';
import { Server } from '../server/Server.js';
import {
  parseDimensions,
  parseFiniteNumber,
  parseNonNegativeInteger,
  parsePositiveNumber,
} from './agentOptions.js';

export type RenderOptions = {
  browser?: 'chrome' | 'chromium' | 'msedge';
  browserPath?: string;
  canvasSize?: string;
  frame?: string;
  fullPage?: boolean;
  output?: string;
  pixelDensity?: string;
  seed?: string;
  timeout?: string;
  viewport?: string;
};

export type RenderMessage = {
  location?: string;
  text: string;
};

export type RenderConsoleMessage = RenderMessage & {
  level: string;
};

export type RenderReport = {
  actualFrame?: number;
  browser?: string;
  canvas?: { height: number; width: number };
  consoleMessages: RenderConsoleMessage[];
  elapsedMs: number;
  errors: RenderMessage[];
  files: readonly string[];
  libraries: readonly string[];
  mainFile?: string;
  output?: string;
  requestedFrame: number;
  source: string;
  success: boolean;
  viewport: { height: number; width: number };
  warnings: RenderMessage[];
};

type AgentStatus = {
  canvas: { height: number; width: number } | null;
  frame: number;
};

export default async function render(
  source: string,
  options: RenderOptions
): Promise<RenderReport> {
  const startedAt = Date.now();
  const report: RenderReport = {
    consoleMessages: [],
    elapsedMs: 0,
    errors: [],
    files: [],
    libraries: [],
    requestedFrame: 1,
    source: path.resolve(source),
    success: false,
    viewport: { height: 600, width: 800 },
    warnings: [],
  };
  let browser: Browser | undefined;
  let server: Server | undefined;

  try {
    const requestedFrame = parseNonNegativeInteger(
      options.frame ?? '1',
      'frame'
    );
    const timeoutMs =
      1000 * parsePositiveNumber(options.timeout ?? '15', 'timeout');
    const viewport = parseDimensions(options.viewport ?? '800x600', 'viewport');
    const canvasDimensions = options.canvasSize
      ? parseDimensions(options.canvasSize, 'canvas size')
      : undefined;
    const pixelDensity = options.pixelDensity
      ? parsePositiveNumber(options.pixelDensity, 'pixel density')
      : 1;
    const seed = options.seed
      ? parseFiniteNumber(options.seed, 'seed')
      : undefined;
    report.requestedFrame = requestedFrame;
    report.viewport = viewport;
    const deadline = Date.now() + timeoutMs;

    const sketch = await resolveSketch(source);
    report.mainFile = path.resolve(sketch.mainFilePath);
    report.files = sketch.files.map((file) => path.resolve(sketch.dir, file));
    report.libraries = sketch.libraries.map((library) =>
      library.importPath
        ? `${library.name}: ${library.importPath}`
        : library.name
    );
    collectStaticDiagnostics(sketch, report);
    if (report.errors.length) return report;

    server = await Server.start({
      agentSupport: { canvasDimensions, pixelDensity, seed },
      liveServer: false,
      port: 0,
      quiet: true,
      relayConsoleMessages: false,
      root: sketch.mainFilePath,
    });

    const browserName = options.browser ?? 'chrome';
    browser = await chromium.launch({
      channel:
        !options.browserPath && browserName !== 'chromium'
          ? browserName
          : undefined,
      executablePath: options.browserPath,
      headless: true,
      timeout: remainingTime(deadline),
    });
    report.browser = `${formatBrowserName(browserName)} ${browser.version()}`;

    const page = await browser.newPage({
      deviceScaleFactor: 1,
      viewport,
    });
    const runtimeFailure = subscribeToPage(page, report, server);
    await page.goto(server.url!, {
      timeout: remainingTime(deadline),
      waitUntil: 'load',
    });
    await page.waitForFunction(() => Boolean(window.__p5Agent), undefined, {
      timeout: remainingTime(deadline),
    });
    const outcome = await Promise.race([
      page
        .evaluate(
          async ({ frame, timeout }) => {
            await window.__p5Agent.waitForReady(timeout);
            return frame > 0
              ? window.__p5Agent.waitForFrame(frame, timeout)
              : window.__p5Agent.getStatus();
          },
          { frame: requestedFrame, timeout: remainingTime(deadline) }
        )
        .then((status) => ({ status: status as AgentStatus })),
      runtimeFailure.then(() => ({ status: undefined })),
    ]);
    const status =
      outcome.status ??
      ((await page.evaluate(() =>
        window.__p5Agent.getStatus()
      )) as AgentStatus);
    report.actualFrame = status.frame;
    report.canvas = status.canvas ?? undefined;

    const output = path.resolve(
      options.output ?? defaultOutputPath(sketch.mainFilePath)
    );
    await mkdir(path.dirname(output), { recursive: true });
    if (options.fullPage) {
      await page.screenshot({
        fullPage: true,
        path: output,
        timeout: remainingTime(deadline),
      });
    } else {
      if (!report.canvas) {
        report.errors.push({ text: 'The sketch did not create a canvas.' });
        return report;
      }
      const imageType = imageTypeForPath(output);
      const dataUrl = await page.evaluate(
        (type) => window.__p5Agent.captureCanvas(type),
        imageType
      );
      await writeFile(output, Buffer.from(dataUrl.split(',')[1], 'base64'));
    }
    report.output = output;
    report.success = report.errors.length === 0;
    return report;
  } catch (error) {
    assertError(error);
    report.errors.push({ text: cleanErrorMessage(error) });
    return report;
  } finally {
    try {
      await browser?.close();
    } catch (error) {
      assertError(error);
      report.errors.push({
        text: `Could not close the browser: ${cleanErrorMessage(error)}`,
      });
      report.success = false;
    }
    try {
      await server?.close();
    } catch (error) {
      assertError(error);
      report.errors.push({
        text: `Could not close the server: ${cleanErrorMessage(error)}`,
      });
      report.success = false;
    }
    report.elapsedMs = Date.now() - startedAt;
  }
}

export function formatRenderReport(report: RenderReport): string {
  const lines = [
    `${report.success ? 'Render succeeded' : 'Render failed'}: ${report.source}`,
    '',
    `Sketch: ${report.mainFile ?? 'Could not identify the sketch entry file'}`,
    `Browser: ${report.browser ?? 'Not started'}`,
    `Viewport: ${report.viewport.width} x ${report.viewport.height}`,
    `Frame: ${formatFrame(report)}`,
    `Canvas: ${report.canvas ? `${report.canvas.width} x ${report.canvas.height} pixels` : 'Not available'}`,
    `Screenshot: ${report.output ?? 'Not written'}`,
    `Elapsed time: ${(report.elapsedMs / 1000).toFixed(2)} seconds`,
    '',
    `Files (${report.files.length}):`,
    ...formatItems(report.files),
    '',
    `Libraries (${report.libraries.length}):`,
    ...formatItems(report.libraries),
    '',
    `Console messages (${report.consoleMessages.length}):`,
    ...formatConsoleMessages(report.consoleMessages),
    '',
    `Warnings (${report.warnings.length}):`,
    ...formatMessages(report.warnings),
    '',
    `Errors (${report.errors.length}):`,
    ...formatMessages(report.errors),
  ];
  return `${lines.join('\n')}\n`;
}

function formatFrame(report: RenderReport): string {
  if (report.actualFrame === undefined) {
    return `${report.requestedFrame} requested; not reached`;
  }
  return report.actualFrame === report.requestedFrame
    ? String(report.actualFrame)
    : `${report.actualFrame} reached; ${report.requestedFrame} requested`;
}

function formatItems(items: readonly string[]): string[] {
  return items.length ? items.map((item) => `  - ${item}`) : ['  None'];
}

function formatConsoleMessages(messages: RenderConsoleMessage[]): string[] {
  return messages.length
    ? messages.map(
        ({ level, location, text }) =>
          `  - ${level}: ${indentContinuation(text)}${location ? ` (${location})` : ''}`
      )
    : ['  None'];
}

function formatMessages(messages: RenderMessage[]): string[] {
  return messages.length
    ? messages.map(
        ({ location, text }) =>
          `  - ${indentContinuation(text)}${location ? ` (${location})` : ''}`
      )
    : ['  None'];
}

function subscribeToPage(
  page: Page,
  report: RenderReport,
  server: Server
): Promise<void> {
  let signalFailure: () => void = () => undefined;
  const failure = new Promise<void>((resolve) => {
    signalFailure = resolve;
  });
  page.on('console', (message) => {
    const location = formatLocation(message.location(), server);
    report.consoleMessages.push({
      level: message.type(),
      location,
      text: message.text(),
    });
    if (message.type() === 'error') {
      report.errors.push({ location, text: message.text() });
      signalFailure();
    } else if (message.type() === 'warning') {
      report.warnings.push({ location, text: message.text() });
    }
  });
  page.on('pageerror', (error) => {
    report.errors.push({
      text: formatErrorStack(error, server),
    });
    signalFailure();
  });
  page.on('requestfailed', (request) => {
    report.errors.push({
      location: formatUrl(request.url(), server),
      text: request.failure()?.errorText ?? 'Request failed',
    });
    signalFailure();
  });
  page.on('response', (response) => {
    if (response.status() >= 400) {
      report.errors.push({
        location: formatUrl(response.url(), server),
        text: `Request returned HTTP ${response.status()} ${response.statusText()}`.trim(),
      });
      signalFailure();
    }
  });
  return failure;
}

async function resolveSketch(source: string): Promise<Sketch> {
  if (!fs.existsSync(source)) {
    throw new Error(`No such file or directory: ${source}`);
  }
  return fs.statSync(source).isDirectory()
    ? Sketch.fromDirectory(source)
    : Sketch.fromFile(source);
}

function collectStaticDiagnostics(sketch: Sketch, report: RenderReport): void {
  for (const filename of sketch.files) {
    const filePath = path.resolve(sketch.dir, filename);
    if (!fs.existsSync(filePath)) {
      report.errors.push({
        location: filePath,
        text: 'Referenced file does not exist',
      });
      continue;
    }
    if (!filename.endsWith('.js')) continue;
    for (const error of Script.fromFile(filePath).getErrors()) {
      const loc = (
        error as SyntaxError & {
          loc?: { column: number; line: number };
        }
      ).loc;
      report.errors.push({
        location: loc ? `${filePath}:${loc.line}:${loc.column}` : filePath,
        text: error.message,
      });
    }
  }
}

function defaultOutputPath(mainFilePath: string): string {
  const basename = path.basename(mainFilePath).replace(/\.(html?|js)$/i, '');
  return `${basename}.png`;
}

function imageTypeForPath(output: string): 'image/jpeg' | 'image/png' {
  const extension = path.extname(output).toLowerCase();
  if (extension === '.png') return 'image/png';
  if (extension === '.jpg' || extension === '.jpeg') return 'image/jpeg';
  throw new Error(
    'The screenshot output file must end in .png, .jpg, or .jpeg'
  );
}

function formatBrowserName(
  browser: NonNullable<RenderOptions['browser']>
): string {
  switch (browser) {
    case 'chrome':
      return 'Google Chrome';
    case 'msedge':
      return 'Microsoft Edge';
    default:
      return 'Chromium';
  }
}

function indentContinuation(text: string): string {
  return text.replace(/\n/g, '\n    ');
}

function remainingTime(deadline: number): number {
  const remaining = deadline - Date.now();
  if (remaining <= 0) throw new Error('The render timed out');
  return remaining;
}

function formatLocation(
  location: {
    columnNumber?: number;
    lineNumber?: number;
    url?: string;
  },
  server: Server
): string | undefined {
  if (!location.url) return undefined;
  const line = location.lineNumber ? `:${location.lineNumber}` : '';
  const column = location.columnNumber ? `:${location.columnNumber}` : '';
  return `${formatUrl(location.url, server)}${line}${column}`;
}

function formatUrl(url: string, server: Server): string {
  const proxyUrlPrefix = `${server.url}${proxyPrefix}/`;
  if (url.startsWith(proxyUrlPrefix)) {
    return `https://${url.slice(proxyUrlPrefix.length)}`;
  }
  const fileUrl = server.serverUrlToFileUrl(url);
  return fileUrl ? fileURLToPath(fileUrl) : url;
}

function formatErrorStack(error: Error, server: Server): string {
  const stack = replaceUrlsInStack(server, error.stack);
  if (!stack) return cleanErrorMessage(error);
  const proxyUrlPrefix = `${server.url}${proxyPrefix}/`;
  return stack.replaceAll(proxyUrlPrefix, 'https://');
}

function cleanErrorMessage(error: Error): string {
  return error.message.replace(/\n=+ logs =+[\s\S]*/m, '').trim();
}

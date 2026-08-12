type AgentSettings = {
  canvasDimensions?: { width: number; height: number };
  pixelDensity?: number;
  seed?: number;
};

type AgentStatus = {
  canvas: { height: number; width: number } | null;
  documentReady: boolean;
  frame: number;
  looping: boolean | null;
  ready: boolean;
};

type P5Instance = {
  _loop?: boolean;
  canvas?: HTMLCanvasElement;
  frameCount?: number;
  noiseSeed?: (seed: number) => void;
  pixelDensity?: (density: number) => void;
  randomSeed?: (seed: number) => void;
};

type P5Constructor = {
  lifecycleHooks?: {
    postsetup?: Array<(this: P5Instance) => void>;
  };
  prototype: P5Instance & Record<string, (...args: unknown[]) => unknown>;
};

declare global {
  const __p5_server_agent_settings: AgentSettings | undefined;

  interface Window {
    __p5Agent: {
      captureCanvas: (type?: 'image/jpeg' | 'image/png') => string;
      getStatus: () => AgentStatus;
      setSeed: (seed: number) => void;
      version: number;
      waitForFrame: (frame: number, timeout?: number) => Promise<AgentStatus>;
      waitForReady: (timeout?: number) => Promise<AgentStatus>;
    };
    frameCount?: number;
    noiseSeed?: (seed: number) => void;
    p5?: P5Constructor;
    randomSeed?: (seed: number) => void;
  }
}

const settings: AgentSettings =
  typeof __p5_server_agent_settings === 'object'
    ? { ...__p5_server_agent_settings }
    : {};
let observedFrame = 0;
let observedInstance: P5Instance | null = null;

window.__p5Agent = {
  version: 1,
  captureCanvas(type = 'image/png') {
    const canvas = findCanvas();
    if (!canvas) throw new Error('The sketch has not created a canvas');
    return canvas.toDataURL(type);
  },
  getStatus,
  setSeed,
  waitForFrame(frame, timeout = 10000) {
    if (!Number.isInteger(frame) || frame < 0) {
      return Promise.reject(
        new Error(`Frame must be a non-negative integer; received ${frame}`)
      );
    }
    return waitUntil(
      () => getStatus().frame >= frame,
      timeout,
      `Timed out waiting for frame ${frame}`
    );
  },
  waitForReady(timeout = 10000) {
    return waitUntil(
      () => getStatus().ready,
      timeout,
      'Timed out waiting for the sketch canvas'
    );
  },
};

installP5Hook();

function getStatus(): AgentStatus {
  const canvas = findCanvas();
  const globalFrame = Number(window.frameCount);
  const instanceFrame = Number(observedInstance?.frameCount);
  observedFrame = Math.max(
    observedFrame,
    Number.isFinite(globalFrame) ? globalFrame : 0,
    Number.isFinite(instanceFrame) ? instanceFrame : 0
  );
  return {
    canvas: canvas ? { width: canvas.width, height: canvas.height } : null,
    documentReady: document.readyState === 'complete',
    frame: observedFrame,
    looping:
      typeof observedInstance?._loop === 'boolean'
        ? observedInstance._loop
        : null,
    ready: Boolean(canvas),
  };
}

function findCanvas(): HTMLCanvasElement | null {
  return observedInstance?.canvas || document.querySelector('canvas');
}

function setSeed(seed: number): void {
  if (!Number.isFinite(seed)) {
    throw new Error(`Seed must be a finite number; received ${seed}`);
  }
  settings.seed = seed;
  window.randomSeed?.(seed);
  window.noiseSeed?.(seed);
  observedInstance?.randomSeed?.(seed);
  observedInstance?.noiseSeed?.(seed);
}

async function waitUntil(
  predicate: () => boolean,
  timeout: number,
  timeoutMessage: string
): Promise<AgentStatus> {
  const deadline = performance.now() + timeout;
  while (!predicate()) {
    if (performance.now() >= deadline) throw new Error(timeoutMessage);
    await new Promise((resolve) => setTimeout(resolve, 16));
  }
  return getStatus();
}

function installP5Hook(): void {
  if (window.p5) {
    patchP5(window.p5);
    return;
  }

  let p5Constructor: P5Constructor | undefined;
  Object.defineProperty(window, 'p5', {
    configurable: true,
    enumerable: true,
    get: () => p5Constructor,
    set(value: P5Constructor) {
      p5Constructor = value;
      patchP5(value);
      Object.defineProperty(window, 'p5', {
        configurable: true,
        enumerable: true,
        value,
        writable: true,
      });
    },
  });
}

function patchP5(p5Constructor: P5Constructor): void {
  const prototype = p5Constructor.prototype;
  p5Constructor.lifecycleHooks?.postsetup?.push(function () {
    observedInstance = this;
    observedFrame = Math.max(observedFrame, 1);
  });
  wrapMethod(prototype, '_setup', function (original, args) {
    observedInstance = this;
    applySettings(this);
    const result = original.apply(this, args);
    if (isPromiseLike(result)) {
      return result.then((value) => {
        observedFrame = Math.max(observedFrame, 1);
        return value;
      });
    }
    observedFrame = Math.max(observedFrame, 1);
    return result;
  });
  wrapMethod(prototype, '_draw', function (original, args) {
    observedInstance = this;
    const result = original.apply(this, args);
    observedFrame = Math.max(observedFrame, Number(this.frameCount) || 0);
    return result;
  });
  wrapMethod(prototype, 'createCanvas', function (original, args) {
    observedInstance = this;
    const dimensions = settings.canvasDimensions;
    const finalArgs = dimensions
      ? [dimensions.width, dimensions.height, ...args.slice(2)]
      : args;
    const result = original.apply(this, finalArgs);
    if (settings.pixelDensity !== undefined) {
      this.pixelDensity?.(settings.pixelDensity);
    }
    return result;
  });
}

function applySettings(instance: P5Instance): void {
  if (settings.pixelDensity !== undefined) {
    instance.pixelDensity?.(settings.pixelDensity);
  }
  if (settings.seed !== undefined) {
    instance.randomSeed?.(settings.seed);
    instance.noiseSeed?.(settings.seed);
  }
}

function wrapMethod(
  target: P5Constructor['prototype'],
  name: string,
  wrapper: (
    this: P5Instance,
    original: (...args: unknown[]) => unknown,
    args: unknown[]
  ) => unknown
): void {
  const original = target[name];
  if (typeof original !== 'function') return;
  target[name] = function (this: P5Instance, ...args: unknown[]) {
    return wrapper.call(this, original, args);
  };
}

function isPromiseLike(value: unknown): value is PromiseLike<unknown> {
  return (
    typeof value === 'object' &&
    value !== null &&
    'then' in value &&
    typeof value.then === 'function'
  );
}

export {};

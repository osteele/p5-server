import livereload from 'livereload';
import { addScriptsToHtmlHead, type HtmlHeadScript } from '../helpers.js';

export type Options = {
  fileWatchProvider?: FileWatchProvider;
  host?: string;
  port?: number;
  scanPorts?: boolean;
  watchDirs?: string[];
};

export type FileWatchSubscription = {
  dispose(): void;
};

/**
 * Watches paths and reports created, changed, or deleted files.
 *
 * Hosts can supply this to integrate p5-server with an existing file-watching
 * service instead of starting LiveReload's Chokidar watcher.
 */
export type FileWatchProvider = (
  paths: readonly string[],
  onDidChange: (filePath: string) => void
) => FileWatchSubscription;

export type LiveReloadServer = ReturnType<typeof livereload.createServer>;

export const liveReloadTemplate = `
  document.write('<script src="http://' + (location.hostname || 'localhost') +
  ':$(port)/livereload.js?snipver=1"></' + 'script>')`;

export function injectLiveReloadScript(
  html: string,
  liveReloadServer: LiveReloadServer | null | undefined
): string {
  return addScriptsToHtmlHead(html, liveReloadHeadScripts(liveReloadServer));
}

export function liveReloadHeadScripts(
  liveReloadServer: LiveReloadServer | null | undefined
): HtmlHeadScript[] {
  if (!liveReloadServer) return [];
  const address = liveReloadServer.server.address();
  if (!address) {
    throw new Error('liveReloadServer.address returned null');
  }
  if (typeof address === 'string') {
    throw new Error(
      `liveReloadServer.address is a string ${address}; expected a WebSocket.AddressInfo`
    );
  }
  const liveReloadScript = liveReloadTemplate.replace(
    '$(port)',
    address.port.toString()
  );
  return [{ source: { script: liveReloadScript } }];
}

export async function createLiveReloadServer({
  fileWatchProvider,
  host = '127.0.0.1',
  port = 35729,
  scanPorts = true,
  watchDirs = <string[]>[],
}: Options): Promise<LiveReloadServer> {
  const lastPort = port + 9;
  let lrServer: LiveReloadServer | undefined;
  while (!lrServer) {
    try {
      lrServer = await listen(port, host);
    } catch (err) {
      if (!isAddressInUseError(err) || !scanPorts) throw err;
      port = port < lastPort ? port + 1 : 0;
    }
  }
  try {
    if (watchDirs.length > 0) {
      if (fileWatchProvider) {
        const subscription = fileWatchProvider(watchDirs, (filePath) =>
          lrServer.filterRefresh(filePath)
        );
        disposeSubscriptionOnClose(lrServer, subscription);
      } else {
        lrServer.watch(watchDirs);
      }
    }
  } catch (error) {
    lrServer.close();
    throw error;
  }
  return lrServer;
}

function disposeSubscriptionOnClose(
  server: LiveReloadServer,
  subscription: FileWatchSubscription
): void {
  const close = server.close.bind(server);
  let disposed = false;
  server.close = () => {
    const errors: unknown[] = [];
    if (!disposed) {
      disposed = true;
      try {
        subscription.dispose();
      } catch (error) {
        errors.push(error);
      }
    }
    try {
      close();
    } catch (error) {
      errors.push(error);
    }
    if (errors.length === 1) throw errors[0];
    if (errors.length > 1) {
      throw new AggregateError(
        errors,
        'Failed to dispose the file watcher and close LiveReload'
      );
    }
  };
}

function isAddressInUseError(err: unknown): err is NodeJS.ErrnoException {
  return err instanceof Error && 'code' in err && err.code === 'EADDRINUSE';
}

function listen(port: number, host: string): Promise<LiveReloadServer> {
  return new Promise((resolve, reject) => {
    type ServerOptions = NonNullable<
      Parameters<typeof livereload.createServer>[0]
    > & {
      host: string;
    };
    const options: ServerOptions = { host, noListen: true, port };
    const server = livereload.createServer(options);
    server.once('error', reject);
    server.listen(() => {
      server.off('error', reject);
      resolve(server);
    });
  });
}

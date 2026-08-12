import type http from 'node:http';
import type net from 'node:net';
import type express from 'express';

/** A wrapper for express.Application#listen that returns a Promise.
 *
 * The Promise succeeds if server.address() returns truthy within `interval` ms.
 *
 * It fails if the server sends on 'error' event or fails to produce and address
 * within the specified interval.
 * */
export function promiseListen(
  app: express.Application | http.Server,
  port?: number,
  host?: string,
  timeout: number = 1000
): Promise<http.Server> {
  return new Promise<http.Server>((resolve, reject) => {
    const listenPort = port ?? 0;
    const server = host ? app.listen(listenPort, host) : app.listen(listenPort);
    server.on('error', onError);
    const timeoutTimer = setTimeout(() => {
      const address = server.address();
      removeListeners();
      if (address) {
        resolve(server);
      } else {
        reject(new Error('Failed to start server'));
      }
    }, timeout);
    const intervalTimer = setInterval(() => {
      const address = server.address();
      if (address) {
        removeListeners();
        resolve(server);
      }
    }, 50);

    function onError(e: Error): void {
      removeListeners();
      reject(e);
    }
    function removeListeners() {
      server.off('error', onError);
      clearTimeout(timeoutTimer);
      clearInterval(intervalTimer);
    }
  });
}

/** A wrapper for http.Server#close that returns a Promise.
 *
 * The Promise succeeds if the server sends a 'close' event within `interval`
 * ms.
 *
 * It fails if the server sends an 'error' event or fails to close within the
 * specified interval.
 */
export function promiseClose(
  server: net.Server,
  timeout: number = 10000
): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    // server.close((err?: Error) => (err ? reject(err) : resolve()));
    server.close();
    server.on('close', onClose);
    server.on('error', onError);
    const timeoutTimer = setTimeout(() => {
      removeListeners();
      onError(new Error('Failed to close server within the timeout period'));
    }, timeout);

    function onClose() {
      removeListeners();
      resolve();
    }
    function onError(e: Error) {
      removeListeners();
      reject(e);
    }
    function removeListeners() {
      server.off('close', onClose);
      server.off('error', onError);
      clearTimeout(timeoutTimer);
    }
  });
}

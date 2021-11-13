import express from 'express';
import http = require('http');
import net = require('net');

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
  timeout: number = 1000
): Promise<http.Server> {
  return new Promise<http.Server>((resolve, reject) => {
    const server = app.listen(port);
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

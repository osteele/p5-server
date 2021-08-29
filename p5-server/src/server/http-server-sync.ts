import express from 'express';
import http = require('http');

export function listenSync(
  app: express.Application,
  port?: number,
  timeout: number = 1000
): Promise<http.Server> {
  return new Promise<http.Server>((resolve, reject) => {
    const server = app.listen(port);
    server.on('error', onError);
    const timeoutTimer = setTimeout(() => {
      const address = server.address();
      if (address) {
        clear();
        resolve(server);
      } else {
        clear();
        reject(new Error('Failed to start server'));
      }
    }, timeout);
    const intervalTimer = setInterval(() => {
      const address = server.address();
      if (address) {
        clear();
        resolve(server);
      }
    }, 50);

    function onError(e: Error): void {
      clear();
      reject(e);
    }
    function clear() {
      server.off('error', onError);
      clearTimeout(timeoutTimer);
      clearInterval(intervalTimer);
    }
  });
}

export function closeSync(server: http.Server, timeout: number = 1000) {
  return new Promise<void>((resolve, reject) => {
    server.close();
    server.on('close', onClose);
    server.on('error', onError);
    const timeoutTimer = setTimeout(() => {
      onError(new Error('Failed to close server'));
    }, timeout);

    function onClose() {
      clear();
      resolve();
    }
    function onError(e: Error) {
      clear();
      reject(e);
    }
    function clear() {
      server.off('close', onClose);
      server.off('error', onError);
      clearTimeout(timeoutTimer);
    }
  });
}

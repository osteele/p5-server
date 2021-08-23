import express from 'express';
import { URL } from 'url';
import { SketchConsoleEvent, ErrorMessageEvent, SketchErrorEvent } from './types';
import { cyclicJsonBodyMiddleware } from './cyclicJsonMiddleware';

export interface BrowserScriptRelay {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  emitScriptEvent(eventName: string | symbol, ...args: any[]): boolean;
  filePathToUrl(filePath: string): string | null;
  urlPathToFilePath(urlPath: string): string | null;
}

export function browserScriptEventRelayRouter(relay: BrowserScriptRelay): express.Router {
  const router = express.Router();

  router.post('/__script_event/console', cyclicJsonBodyMiddleware(), (req, res) => {
    const body: SketchConsoleEvent = req.body;
    const url = req.headers['referer']!;
    const data: SketchConsoleEvent = {
      ...body,
      args: body.args.map(decodeUnserializableValue),
      file: urlToFilePath(url),
      url
    };
    relay.emitScriptEvent('console', data);
    res.sendStatus(200);
  });

  router.post('/__script_event/error', express.json(), (req, res) => {
    const body: ErrorMessageEvent = req.body;
    const url = req.headers['referer'] || req.body.url;
    const data: SketchErrorEvent = {
      ...body,
      url,
      file: urlToFilePath(url),
      stack: replaceUrlsInStack(req.body.stack)
    };
    relay.emitScriptEvent('error', data);
    res.sendStatus(200);
  });

  router.post('/__script_event/window', express.json(), (req, res) => {
    const url = req.headers['referer']!;
    const data: SketchConsoleEvent = { ...req.body, url, file: urlToFilePath(url) };
    relay.emitScriptEvent('window', data);
    res.sendStatus(200);
  });

  return router;

  function urlToFilePath(url: string | undefined): string | undefined {
    return (url && relay.urlPathToFilePath(new URL(url).pathname)) || undefined;
  }

  function replaceUrlsInStack(stack: string | undefined): string | undefined {
    return stack
      ? stack.replace(/\bhttps?:\/\/localhost(?::\d+)?(\/[^\s:]+)/g, (s, p) => relay.urlPathToFilePath(p) || s)
      : stack;
  }
}

export function injectScriptEventRelayScript(html: string) {
  return html.replace(/(?=<\/head>)/, '<script src="/__p5_server_static/console-relay.js"></script>');
}

const serializationPrefix = '__p5_server_serialization_:';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function decodeUnserializableValue(value: any) {
  return typeof value === 'string' && value.startsWith(serializationPrefix)
    ? eval(value.slice(serializationPrefix.length))
    : value;
}

import express from 'express';
import { Request, Response } from 'express-serve-static-core';
import fs from 'fs';
import { readFile } from 'fs/promises';
import { Script, Sketch } from 'p5-analysis';
import path from 'path';
import { addScriptToHtmlHead } from '../helpers';
import { assertError } from '../ts-extras';
import { injectScriptEventRelayScript } from './browserScriptEventRelay';
import { defaultDirectoryExclusions } from './directoryListing';
import { injectLiveReloadScript } from './liveReload';
import {
  createSyntaxErrorJsReporter,
  markdownToHtmlPage,
  sourceViewTemplate
} from './templates';
import { RouterConfig, sendDirectoryListing } from './Server';

export function createRouter(config: RouterConfig): express.Router {
  const router = express.Router();

  router.get('/', async (req, res) => {
    const sketchFile = config.sketchFile;
    const file = path.join(config.root, decodeURIComponent(req.path));

    if (sketchFile) {
      if (await Sketch.isSketchScriptFile(sketchFile)) {
        const sketch = await Sketch.fromFile(sketchFile);
        sendHtml(req, res, await sketch.getHtmlContent());
      } else {
        sendHtml(req, res, await readFile(sketchFile, 'utf-8'));
      }
    } else if (config.screenshot) {
      const { sketches } = fs.statSync(file).isDirectory()
        ? await Sketch.analyzeDirectory(file, {
            exclusions: defaultDirectoryExclusions
          })
        : { sketches: [] };
      if (sketches.length !== 1)
        throw new Error(`Expected exactly one sketch in ${file}`);
      const [sketch] = sketches;
      const html = sketch.htmlFile
        ? await readFile(sketch.htmlFilePath!, 'utf-8')
        : await sketch.getHtmlContent();
      sendHtml(req, res, html);
    } else {
      await sendDirectoryListing(config, req, res);
    }
  });

  router.post(
    '/__p5_server/screenshot',
    express.json({ limit: '50mb' }),
    async (req, res) => {
      const { dataURL } = req.body;
      const m = dataURL.match(/^data:image\/(.+?);base64,(.*)$/);
      if (!m || !config.screenshot?.onFrameData) return res.sendStatus(200);
      await config.screenshot.onFrameData({
        imageType: m[1],
        data: Buffer.from(m[2], 'base64'),
        frameNumber: req.body.frameNumber
      });
      res.sendStatus(200);
    }
  );

  router.get('/*.html?', (req, res, next) => {
    const file = path.join(config.root, decodeURIComponent(req.path));
    try {
      if (req.query.fmt === 'view') {
        res.set('Content-Type', 'text/plain');
        res.sendFile(req.path, { root: config.root });
        return;
      }
      if (req.headers['accept']?.match(/\btext\/html\b/)) {
        sendHtml(req, res, fs.readFileSync(file, 'utf-8'));
        return;
      }
    } catch (err) {
      assertError(err);
      if (err.code !== 'ENOENT') {
        throw err;
      }
    }
    next();
  });

  // A request for the HTML of a JavaScript file returns HTML that includes the sketch.
  // A request for the HTML of a main sketch js file redirects to the sketch's index page.
  router.get('/*.js', async (req, res, next) => {
    const filepath = path.join(config.root, decodeURIComponent(req.path));

    // bare-javascript sketch; not view source
    if (
      req.headers['accept']?.match(/\btext\/html\b/) &&
      req.query.fmt !== 'view' &&
      (await Sketch.isSketchScriptFile(filepath))
    ) {
      const { sketches } = await Sketch.analyzeDirectory(path.dirname(filepath), {
        exclusions: defaultDirectoryExclusions
      });
      const sketch = sketches.find(sketch =>
        sketch.files.includes(path.basename(filepath))
      );
      if (sketch) {
        return sendHtml(req, res, await sketch.getHtmlContent());
      }
    }

    // view source
    if (req.headers['accept']?.match(/\btext\/html\b/) && req.query.fmt === 'view') {
      const source = await readFile(filepath, 'utf-8');
      const title = req.path.replace(/^\//, '');
      const html = sourceViewTemplate({ source, title });
      res.set('Content-Type', 'text/html');
      return res.send(html);
    }

    try {
      const errs = Script.fromFile(filepath).getErrors();
      if (errs.length) {
        res.set('Content-Type', 'text/html');
        return res.send(createSyntaxErrorJsReporter(errs, filepath));
      }
    } catch (err) {
      assertError(err);
      if (err.code === 'ENOENT') {
        return next();
      } else {
        throw err;
      }
    }

    next();
  });

  router.get('/*.md', (req, res, next) => {
    if (req.headers['accept']?.match(/\btext\/html\b/)) {
      const file = path.join(config.root, decodeURIComponent(req.path));
      if (!fs.existsSync(file)) {
        return next();
      }
      const data = fs.readFileSync(file, 'utf-8');
      res.set('Content-Type', 'text/html');
      return res.send(markdownToHtmlPage(data));
    }
    return next();
  });

  router.get('*', (req, res, next) => {
    if (req.headers['accept']?.match(/\btext\/html\b/)) {
      const file = path.join(config.root, decodeURIComponent(req.path));
      if (fs.existsSync(file) && fs.statSync(file).isDirectory()) {
        return sendDirectoryListing(config, req, res);
      }
    }
    next();
  });

  return router;

  function sendHtml<T>(
    req: Request<unknown, unknown, unknown, Record<string, unknown>, T>,
    res: Response<string, T>,
    html: string
  ) {
    html = injectLiveReloadScript(html, req.app.locals.liveReloadServer);
    if (
      config.relayConsoleMessages ||
      'send-console-messages' in req.query ||
      'vscodeBrowserReqId' in req.query
    ) {
      html = injectScriptEventRelayScript(html);
    }
    if (config.screenshot && req.path === '/') {
      html = addScriptToHtmlHead(html, '/__p5_server_static/screenshot.min.js');
      html = addScriptToHtmlHead(html, {
        __p5_server_screenshot_settings: config.screenshot
      });
    }
    res.set('Content-Type', 'text/html');
    res.send(html);
  }
}

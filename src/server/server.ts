import express from 'express';
import fs from 'fs';
import { createServer as createLiveReloadServer } from 'livereload';
import ejs from 'ejs';
import path from 'path';
import minimatch from 'minimatch';

const directoryListingExclusions = ['node_modules', 'package.json', 'package-lock.json'];
const templateDir = path.join(path.dirname(__filename), '../../templates');

type ServerOptions = {
  port: number;
  root: string;
  sketchPath: string | null;
};

let serverOptions: ServerOptions;

const liveReloadPort = 35729;
const liveReloadTemplate = `<script>
  document.write('<script src="http://' + (location.host || 'localhost').split(':')[0] +
  ':35729/livereload.js?snipver=1"></' + 'script>')
</script>`;

const app = express();

app.get('/', (_req, res) => {
  const liveReloadString = liveReloadTemplate.replace('35729', liveReloadPort.toString());
  let content: string;
  try {
    content = fs.readFileSync(`${serverOptions.root}/index.html`, 'utf8');
  } catch (e) {
    if (e.code !== 'ENOENT') {
      throw e;
    }
    content = serverOptions.sketchPath
      ? createTemplateIndex(serverOptions.sketchPath)
      : createIndexPage(serverOptions.root);
  }
  // TODO: more robust injection
  // TODO: warn when injection is not possible
  content = content.replace(/(?=<\/head>)/, liveReloadString);
  res.send(content);
});

function createIndexPage(dirPath: string) {
  const files = fs.readdirSync(dirPath)
    .filter(s => !s.startsWith('.')
      && !directoryListingExclusions.some(exclusion => minimatch(s, exclusion))
    );
  files.sort((a, b) => a.toLowerCase().localeCompare(b.toLowerCase()));
  const filename = path.join(templateDir, 'directory.html');
  const template = ejs.compile(fs.readFileSync(filename, 'utf-8'), { filename });
  return template({ files });
}

function createTemplateIndex(sketchPath: string) {
  // TODO: DRY w/ project generation
  const filename = path.join(templateDir, 'index.html');
  const template = ejs.compile(fs.readFileSync(filename, 'utf-8'), { filename });
  // TODO: derive project title from root when sketch path is sketch.js
  const title = serverOptions.sketchPath?.replace(/_/g, ' ').replace(/\.js$/, '');
  return template({ title, sketchPath });
}

function run(options: ServerOptions) {
  // TODO: scan for another port when default port is in use and was not
  // explicitly specified
  serverOptions = options;
  app.use('/', express.static(options.root));
  app.listen(options.port, () => {
    console.log(`Serving ${options.root} at http://localhost:${options.port}`);
  });
  // TODO: scan for another live reload port when in use
  createLiveReloadServer({ port: liveReloadPort })
    .watch(options.root);
}

export default {
  app,
  run
};

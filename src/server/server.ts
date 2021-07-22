import express from 'express';
import fs from 'fs';
import livereload from 'livereload';

const app = express();

let serverRoot: string;

const liveReloadPort = 35729;
const liveReloadTemplate = `<script>
  document.write('<script src="http://' + (location.host || 'localhost').split(':')[0] +
  ':35729/livereload.js?snipver=1"></' + 'script>')
</script>`

app.get('/', (_req, res) => {
  const liveReloadString = liveReloadTemplate.replace('35729', liveReloadPort.toString());
  let content = fs.readFileSync(`${serverRoot}/index.html`, 'utf8');
  content = content.replace(/(?=<\/head>)/, liveReloadString);
  res.send(content);
});

function useDirectory(rootPath: string) {
  serverRoot = rootPath;
  app.use('/', express.static(rootPath));
}

function run(port: number) {
  app.listen(port, () => {
    console.log(`Serving ${serverRoot} at http://localhost:${port}`);
  });
  livereload.createServer().watch(serverRoot);
}

export default {
  app,
  useDirectory,
  run
};

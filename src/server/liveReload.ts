import livereload from 'livereload';

export const liveReloadPort = 35729;
export const liveReloadTemplate = `<script>
  document.write('<script src="http://' + (location.host || 'localhost').split(':')[0] +
  ':35729/livereload.js?snipver=1"></' + 'script>')
</script>`;

export function injectLiveReloadScript(content: string) {
  // TODO: more robust injection
  // TODO: warn when injection is not possible
  const liveReloadString = liveReloadTemplate.replace('35729', liveReloadPort.toString());
  return content.replace(/(?=<\/head>)/, liveReloadString);
}

export function createLiveReloadServer(watchDir: string) {
  // TODO: scan for another live reload port when in use
  livereload.createServer({ port: liveReloadPort })
    .watch(watchDir);
}

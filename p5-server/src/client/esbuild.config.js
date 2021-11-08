// eslint-disable-next-line no-undef
const { buildSync } = require('esbuild');

['console-relay.ts', 'iframe-manager.js', 'screenshot.js',]
  .forEach(input =>
    buildSync({
      entryPoints: [`./src/client/${input}`],
      outfile: `./src/server/static/${input.replace(/\.(js|ts)$/, '.min.js')}`,
      bundle: true,
      minify: true,
    }));

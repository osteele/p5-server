import { buildSync } from 'esbuild';

for (const input of [
  'console-relay.ts',
  'iframe-manager.js',
  'screenshot.js',
]) {
  buildSync({
    entryPoints: [`./src/client/${input}`],
    outfile: `./src/server/static/${input.replace(/\.(js|ts)$/, '.min.js')}`,
    bundle: true,
    minify: true,
  });
}

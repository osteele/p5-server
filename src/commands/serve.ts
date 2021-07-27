import fs from 'fs';
import open from 'open';
import path from 'path';
import * as server from '../server/server';

export default async function serve(name: string, options = { open: false, port: '3000' }) {
  let root: string;
  let sketchPath: string | null = null;

  if (name) {
    if (fs.statSync(name).isDirectory()) {
      root = name;
    } else {
      root = path.dirname(name);
      sketchPath = path.basename(name);
    }
  } else {
    root = process.cwd()
  }

  const serverOptions = {
    root,
    port: Number(options.port),
    sketchPath,
  };
  server.run(serverOptions, (url) => {
    if (options.open) open(url);
  });
}

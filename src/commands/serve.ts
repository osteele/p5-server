import fs from 'fs';
import open from 'open';
import path from 'path';
import { Server } from '../server/Server';

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
  const server = await Server.start(serverOptions);
  console.log(`Serving ${name} at ${server.url}`);
  if (options.open && server.url) open(server.url);
}

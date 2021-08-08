import open from 'open';
import { Server } from '../server/Server';

export default async function serve(file: string, options = { open: false, port: '3000' }) {
  const displayName = file === '.' ? process.cwd() : file;
  const server = await Server.start({
    root: file,
    port: Number(options.port)
  });
  console.log(`Serving ${displayName} at ${server.url}`);
  if (options.open && server.url) open(server.url);
}

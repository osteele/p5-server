import fs from 'fs';
import path from 'path';
import { die } from './utils';
import server from '../server/server'

export default function serve(name: string, options = { port: '3000' }) {
    const cwd = process.cwd();
    server.useDirectory(name ? path.join(cwd, name) : cwd);
    server.run(parseInt(options.port, 10));
}

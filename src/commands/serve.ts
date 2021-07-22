import fs from 'fs';
import path from 'path';
import { die } from './utils';
import server from '../server/server'

export default function serve(name: string, options = { port: '3000' }) {
    let root = process.cwd();
    let sketchPath: string | null = null;

    if (name) {
        if (fs.statSync(name).isDirectory()) {
            root = path.join(root, name);
        } else {
            root = path.dirname(name);
            sketchPath = path.basename(name);
        }
    }
    server.run({
        root,
        sketchPath,
        port: parseInt(options.port, 10)
    });
}

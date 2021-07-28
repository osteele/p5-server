import path from 'path';
import { DirectoryExistsError, Sketch } from '../models/Sketch';
import { die } from '../utils';

export default function create(name: string = 'sketch', options: { force: boolean, html: boolean, title: string, options: string }) {
  const base = path.basename(name);
  const project = options.html
    ? new Sketch(name, 'index.html', 'sketch.js', options)
    : new Sketch(path.dirname(name), null, base.endsWith('.js') ? base : `${base}.js`, options);
  const generationOptions = Object.fromEntries((options.options || '')
    .split(',')
    .map(s => /no-/.test(s) ? [s.substring(3), false] : [s, true]));
  try {
    project.generate(options.force, generationOptions);
  } catch (err) {
    if (err instanceof DirectoryExistsError) {
      die(err.message);
    } else {
      throw err;
    }
  }
}

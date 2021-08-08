import { DirectoryExistsError, Sketch } from 'p5-analysis';
import { die } from '../utils';

export default function create(
  name: string = 'sketch',
  options: { force: boolean; html: boolean; title: string; options: string }
) {
  const generationOptions = Object.fromEntries(
    (options.options || '').split(',').map(s => (/no-/.test(s) ? [s.substring(3), false] : [s, true]))
  );

  const sketch = options.html
    ? Sketch.create(/\.html?$/i.test(name) ? name : `${name}.html`, options)
    : Sketch.create(name.endsWith('.js') ? name : `${name}.js`, options);

  try {
    sketch.generate(options.force, generationOptions);
  } catch (err) {
    if (err instanceof DirectoryExistsError) {
      die(err.message);
    } else {
      throw err;
    }
  }
  console.log(`Created ${name}`);
}

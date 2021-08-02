import { Sketch, SketchType } from '../models/Sketch';
import { die } from '../utils';

const sketchTypes: SketchType[] = ['html', 'javascript']

export default function convert(sketchPath: string, options: { to?: SketchType }) {
  const sketch = Sketch.fromFile(sketchPath);
  let targetType = options.to || (sketch.sketchType === 'html' ? 'javascript' : 'html');

  if (!sketchTypes.includes(targetType)) {
    die(`Invalid option --to ${options.to}; must be `);
  }

  if (sketch.sketchType === options.to) {
    console.log("Nothing to do");
    return;
  }
  try {
    sketch.convert({ type: targetType });
  } catch (err) {
    die(err.message);
  }
}

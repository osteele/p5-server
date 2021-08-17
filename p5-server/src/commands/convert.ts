import { Sketch, SketchType } from 'p5-analysis';
import { die } from '../utils';

const sketchTypes: SketchType[] = ['html', 'javascript'];

export default async function convert(sketchPath: string, options: { to?: SketchType }) {
  const sketch = await Sketch.fromFile(sketchPath);
  const targetType = options.to || (sketch.sketchType === 'html' ? 'javascript' : 'html');

  if (!sketchTypes.includes(targetType)) {
    die(`Invalid option --to ${options.to}; must be `);
  }

  if (sketch.sketchType === options.to) {
    console.log('Nothing to do');
    return;
  }
  try {
    await sketch.convert({ type: targetType });
  } catch (err) {
    die(err.message);
  }
}

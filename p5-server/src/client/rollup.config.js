import { babel } from '@rollup/plugin-babel';
import path from 'path/posix';
import { terser } from "rollup-plugin-terser";

let production = !process.env.ROLLUP_BUILD || process.env.ROLLUP_BUILD === 'production';
const plugins = [
  babel({ babelHelpers: 'bundled' }),
  production && terser()
];

export default [
  {
    input: 'console-relay.js',
    output: { strict: false },
  },
  { input: 'iframe-manager.js' },
  { input: 'screenshot.js' },
].map(config => ({
  ...config,
  input: path.join('./src/client', config.input),
  output: {
    file: path.join('./src/server/static', config.input.replace(/\.js$/, '.min.js')),
    format: 'iife',
    ...config.output,
  },
  plugins,
}));

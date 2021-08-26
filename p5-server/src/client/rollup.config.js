import { babel } from '@rollup/plugin-babel';
import { terser } from "rollup-plugin-terser";

export default [
  {
    input: './src/client/console-relay.js',
    output: {
      file: './src/server/static/console-relay.js',
      format: 'iife',
    },
    plugins: [babel({ babelHelpers: 'bundled' }), terser()]
  }
]

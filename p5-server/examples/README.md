# Examples

This directory contains example sketches for p5-server.

`circles.js` and `squares.js` are JavaScript-only sketches. These can be run by
navigating to the JavaScript file in the browser; they don't require an HTML
file.

`collection` is a directory that contains several sketches.

`single-sketch-directory` contains an HTML file and several JavaScript files.
Opening the directory presents the sketch.

`libraries` contains sketches that depend on libraries. The server recognizes
which libraries they depend on, and automatically includes them.

`syntax-error-demo` demonstrates how the development server reports a syntax
error. A static build produces a page that does not run; the browser's
developer console shows the error.

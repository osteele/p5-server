# About this directory

This directory contains a set of test cases for p5-server.

`circles.js` and `squares.js` are examples JavaScript-only sketches. These can
be run by navigating to the JavaScript file in the browser; they don't require
an HTML file.

`collection` is a directory that contains several sketches.

`sketch-dir` contains an HTML file and a sketch JavaScript. Visiting it should
present the sketch.

`libraries` contains sketches that depend on libraries. The server recognizes
which libraries they depend on, and automatically includes them.

`syntax-error` is an example of how a script that contains a syntax error is
displayed in the browser.

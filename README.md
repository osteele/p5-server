# P5.js Server

This is a work in progress.

This project is a command-line interface for [p5.js](https://p5js.org/). It
provides features that make it easier to manage large numbers of sketches (smart
directory listings, JavaScript-only sketches), and that automate some of the
features that I see beginners struggle with (syntax error reporting, adding
libraries).

## Features

Live reload
: The browser reloads the page, when any file in its directory is modified.

JavaScript-only sketches

: Click on a JavaScript sketch file (or run e.g. `p5 serve sketch.js`) to run a
  p5.js sketch that consists of a single JavaScript file, without an associated
  HTML file.

Automatic library inclusion

: JavaScript-only sketches automatically include many of the libraries that are
  listed on the [p5.js Libraries page](https://p5js.org/libraries/), as well as
  [dat.gui](https://github.com/dataarts/dat.gui). For example, if the sketch
  calls  `loadSound`, it will include the p5.sound library. If it refers to
  `ml5`, it will include the ml5.js library.

In-Page Syntax errors

: Syntax error are displayed in the HTML body. This way you see them even if you
  don't open the browser developer console.

  (Yes, everybody should do program development with the console open or a
  debugger attached. I've still found this to be a barrier to getting started
  with p5.js: no matter of classroom instruction reduces the time to build that
  habit to zero.)

Directory listing
: Visiting a directory lists its sketches and non-sketch files

Sketch generation
: `p5 generate` creates an `index.html` / `sketch.js` pair of files.

## Installation

Install [Node.js](https://nodejs.org/).

In the command line, `cd` to this repository's directory and enter:

```sh
npm install
```

(This step be replaced by one that uses the npmjs package directory, once I find
an unoccupied package name.)

## Commands

Run `p5 --help` to see a list of commands.

Run `p5 <command> --help` to see command-line options.

### `p5 create [sketch-name]`

Creates a folder named `sketch-name` (default `sketch`), that contains an
`index.html` file and a `sketch.js` file.

### `p5 run [filename]`

### `p5 serve [filename]`

Runs a web server that serves the current directory (if there is no argument),
or the `filename` subdirectory of the current directory.

`p5 serve filename` runs a sketch in the browser.

- If `filename` is an HTML file (for example, `index.html`), this command serves
  that page.
- If `filename` is a JavaScript file that contains a p5.js sketch (for example,
  `sketch.js`), the browser runs the sketch. (In this case, the server creates a
  HTML document that includes the sketch.)
- If `filename` is a directory, the browser displays a list of sketches and files in that directory.
- If `filename` is not supplied, the browser displays sketches and files in the
  current directory.

## Notes

Generated sketches use a CDN. I may add an option to use local files instead.

A “JavaScript-only sketch file” is a JavaScript file that includes a function
definition for either the `setup()` or `draw()` functions.

Automatic library loading is done by examining the free variables in the sketch.
A list of libraries, and the global variables that trigger including a library,
is in `./config/libraries.json`.

I haven't tested this on instance-mode sketches, or on Windows.

## License

ISC

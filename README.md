# P5.js Runner

This is a work in progress.

This project is a command-line interface for
[p5.js](https://p5js.org/reference/#/p5/loadSound). It provides features that
make it easier to manage large numbers of sketches (smart directory listings,
JavaScript-only sketches), and that automate some of the features that I see
beginners struggle with (syntax error reporting, adding libraries).

## Features

Live reload
: The browser reloads the page, when any file in its directory is modified.

JavaScript-only sketches

: Click on a JavaScript sketch file (or run e.g. `p5 serve sketch.js`) to run a
  p5.js sketch that consists of a single JavaScript file, without an associated
  HTML file.

Automatic library inclusion

: JavaScript-only sketches automatically include the p5.sound library, if the
  code uses any functions (such as `loadSound`) from this library. (I am working
  on extending this to other libraries.)

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

In the command line, enter:

```sh
npm install -g p5-runner
```

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

Recognition of p5.js HTML files is currently done using regular expressions, and
is therefore fragile.

I haven't tested this on instance-mode sketches.

## License

ISC

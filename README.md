# P5.js Runner

This is a work in progress.

This project is a command-line interface for p5.js. It can generate sketch
files, and it includes a server, with live reload, that can serve
JavaScript-only sketches (JavaScript files without an associated HTML file). so
that they run in the browser.

I wrote this to make it easier to manage and run collections of p5.js sketches.

## Features

`p5 generate` creates an `index.html` / `sketch.js` pair.

`p5 serve` runs a server with these features:

Live reload
: The browser reloads the page, when any file in the directory is
  modified.

Directory listing
: A list of sketches and non-sketch files is displayed

JavaScript-only sketches
: Click on a JavaScript sketch file (or run e.g. `p5 serve sketch.js`) to run a
p5.js sketch that consists of a single JavaScript file, without an associated
HTML file.

### Planned Features

- [ ] display parse errors in the browser
- [ ] recognize when a sketch requires a library file
- [ ] commands to add and update libraries

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

A “bare JavaScript sketch file” is a JavaScript file that includes a definition
for the `setup()` and/or `draw()` functions.

Recognition of p5.js HTML and JavaScript files is currently done using regular
expressions, and is therefore fragile.

## License

ISC

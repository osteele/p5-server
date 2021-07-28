# P5.js Server

This project is a command-line interface for [p5.js](https://p5js.org/).

It provides features that make it easier to manage collections of sketches
(smart directory listings, JavaScript-only sketches); and that automate some of
the features that I see beginners struggle with (noticing syntax errors, adding
libraries).

For example, serving the `examples` directory in this project is rendered as the
following screenshot. Clicking on a project runs it, even if there is no
associated HTML file.

![screenshot](docs/screenshot.png)

This is a work in progress.

## Features

* **Live reload**. The browser reloads the page, when any file in its directory is
  modified.
* **JavaScript-only sketches**. Run a sketch that's just a JavaScript file (e.g.
  `p5 serve sketch.js`). You don't need to create an HTML wrapper.
* **Automatic library includes**. If the server detects that your JavaScript-only
  sketch requires a [p5.js library](https://p5js.org/libraries/), it will
  automatically include it. (See
  [here](https://github.com/osteele/p5-server#automatic-library-inclusion) for
  how this works.)
* **In-Page syntax errors**. If a JavaScript file has a syntax error, it is
  displayed in the body of the page (you don't have to check the console).
* **P5-aware directory listings**. Viewing a directory in the browser lists the
  sketches, folders, other files in that directory.
* **Sketch generation**. `p5 generate` creates an `index.html` / `sketch.js` pair of files.

## Installation and Quick Start

### Installation

1. Install [Node.js](https://nodejs.org/).

2. In a terminal window, enter:

    ```sh
    npm install p5-server
    ```

### Usage

* `p5 serve` starts a server in the current directory
* `p5 serve <directory>` to serve a different directory
* `p5 serve sketch.html` or `p5 serve sketch.js` serve a specific file.
* `p5 serve --open` opens the URl in the browser automatically

Any of these will display a URL that can be entered into a browser. (In some
terminal programs, you can command-click on the URL instead of copying and
pasting it.)

## Commands

Run `p5 --help` to see a list of commands.

Run `p5 <command> --help` to see command-line options.

### `p5 create [sketch-name]`

Creates a folder named `sketch-name` (default `sketch`), that contains an
`index.html` file and a `sketch.js` file.

### `p5 create [sketch-name] --no-html`

Creates a file named `sketch-name.js` in the current directory.

Use `-options <options>` to control what is places in the JavaScript file.
`<options>` is a comma-separate list of option names, such as `resizeCanvas` or
`preload,static`.

The option names are:

* `comments` – include comments (e.g. `// put setup code here`) inside the
  functions
* `preload` – include an (empty) `preload()` function
* `windowResized` – include a `windowResized()` function, that resizes the
  canvas when the window is resized
* `no-draw` – omit the `draw()` function, in order to create a "static" sketch
* `no-examples` – omit the example call inside of `draw()`

### `p5 serve [filename]`

Runs a web server that serves the current directory (if there is no argument),
or the `filename` subdirectory of the current directory.

`p5 serve filename` runs a sketch in the browser.

* If `filename` is an HTML file (for example, `index.html`), this command serves
  that page.
* If `filename` is a JavaScript file that contains a p5.js sketch (for example,
  `sketch.js`), the browser runs the sketch. (In this case, the server creates a
  HTML document that includes the sketch.)
* If `filename` is a directory, the browser displays a list of sketches and files in that directory.
* If `filename` is not supplied, the browser displays sketches and files in the
  current directory.

## Implementation Notes

### Sketch file recognition

A “JavaScript-only sketch file” is a JavaScript file that includes a function
definition for `setup()` function, and a call to `createCanvas()`.

An HTML sketch file is an HTML file that includes a `<script>` tag that sources
a URL that ends in `p5.js` or `p5.min.js`.

### Automatic library inclusion

JavaScript-only sketches automatically include many of the libraries that are
isted on the [p5.js Libraries page](https://p5js.org/libraries/), as well as
[dat.gui](https://github.com/dataarts/dat.gui). For example, if the sketch calls
`loadSound`, it will include the p5.sound library. If it refers to `ml5`, it
will include the ml5.js library.

Automatic library loading is done by examining the free variables, and
references to `p5.prop` where `prop` is any property name, in the sketch.

A list of libraries, and the global variables that trigger including a library,
is in `./config/libraries.json`.

## Limitations

* Generated sketches use a CDN. (I may add an option to use local files instead.)
* I haven't tested this code on instance-mode sketches.
* The code hasn't been tested on Windows.
* The code doesn't recognize scripts inside of HTML files.
* Library inference probably doesn't work on ES modules. (It parses them, but
  doesn't pay attention to exports)

## Acknowledgements

This project builds on these libraries and frameworks:

* commander, for parsing command-line arguments
* esprima and node-html-parser for parsing JavaScript and HTML, respectively
* expressjs for the web server
* livereload for the live reload functionality
* marked for converting Markdown to HTML
* nunjucks and pug for template generation
* The Semantic UI CSS framework

## License

ISC © Oliver Steele

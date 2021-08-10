# P5.js Server

[![npm version](https://badge.fury.io/js/p5-server.svg)](https://www.npmjs.com/package/p5-server)

This project is a command-line interface for [p5.js](https://p5js.org/). It
provides a web server with live reload, that knows how to server JavaScript-only
sketches and figure out which libraries a sketch needs  in order to run.

It is also available as a [Visual Studio Code
extension](https://github.com/osteele/vscode-p5server#readme).

The directory and script analysis tools that make this possible are available
via a [programmatic API](https://github.com/osteele/p5-server/tree/master/p5-analysis#readme).

![screenshot](docs/screenshot.png)

## Features

* **Live reload**. The browser reloads the page, when any file in its directory is
  modified.
* **JavaScript-only sketches**. Run a sketch that's just a JavaScript file (e.g.
  `p5 serve sketch.js`). You don't need to create an HTML wrapper.
* **Automatic library includes**. If the server detects that a JavaScript-only
  sketch requires a [p5.js library](https://p5js.org/libraries/), it will
  automatically include it. (See
  [here](https://github.com/osteele/p5-server#automatic-library-inclusion) for
  how this works.)
* **In-Page syntax errors**. If a JavaScript file has a syntax error, it is
  displayed in the body of the page (you don't have to check the console).
* **P5-aware directory listings**. Viewing a directory in the browser lists the
  sketches, folders, other files in that directory.
* **Sketch generation**. `p5 generate` creates an `index.html` / `sketch.js` pair of files.

## Usage

In a terminal window:

* `p5 serve` starts a server in the current directory
* `p5 serve <directory>` to serve a different directory
* `p5 serve sketch.html` or `p5 serve sketch.js` serve a specific file.
* `p5 serve [directory] --open` runs the server and opens the URL in the browser.

Any of these will display a URL that can be entered into a browser. (In some
terminal programs, you can command-click on the URL instead of copying and
pasting it.)

### Create a sketch

`p5 create` creates a sketch file named `sketch.js` in the current directory.

This is a **JavaScript-only sketch**. The server (below) can run this, and you
can paste it into online editors such as the [P5 web
editor](https://editor.p5js.org) and
[OpenProcessing.org](https://openprocessing.org).

`p5 create my-sketch` and `p5 create my-sketch.js` create a sketch file named
`my-sketch.js`.

`p5 create my-sketch.html` creates an HTML file named `my-sketch.html` and a
JavaScript file named `my-sketch.js`.

`p5 create my-sketch --folder` creates a folder named `my-sketch`, and creates
`index.html` and `sketch.js` files inside this folder.

The default generated script contains `setup()` and `draw()` functions. The
`setup()` functions creates a canvas, and the `draw()` functions draws circles
that follow the mouse. `--options` can be used to customize this script.
See the reference, below.

### Start the server

`p5 server` starts a sketch-aware server. The server is set to serve files from
the current directory.

`p5 server DIR` starts a server that serves files from the directory at DIR.

By default, the server runs on port 3000. You can open it in a browser by
visiting <http://localhost:3000>. The `--open` option will do this
automatically.

If another server is already running on port 3000, the server will choose
another port.

### Convert JavaScript <-> HTML sketches

`p5 convert sketch.html` converts an HTML sketch to a JavaScript-only sketch, by
deleting the HTML file. It first inspects this file, to insure that the sketch
contains only a single script file, and that all the information necessary to
run the sketch is in the script.

`p5 convert sketch.js` creates an HTML file that can be used to run the sketch.

## Installation

1. Install [Node.js](https://nodejs.org/).

2. In a terminal window, enter:

    ```sh
    npm install p5-server
    ```

## Reference

Run `p5 --help` to see a list of commands.

Run `p5 <command> --help` to see command-line options.

### `p5 create [NAME]`

* `p5 create` – creates `sketch.js`
* `p5 create my-sketch.js` – creates just the JavaScript file
* `p5 create my-sketch.html` – creates `my-sketch.html` and `my-sketch.js`
* `p5 create my-sketch --type folder` – creates a folder named `my-sketch`, that
  contains files `index.html` and `sketch.js`.

`p5 create --options comments,preload` specifies a comma-separated set of
template options. The options are:

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
  `sketch.js`), the server serves a page that runs the sketch.
* If `filename` is a directory, the browser displays a list of sketches and files in that directory.
* If `filename` is not supplied, the browser displays sketches and files in the
  current directory. (This is the same as `p5 serve .`.)

### `p5 convert filename --to html | javascript`

Converts between HTML and JavaScript-only sketches.

Converting a JavaScript-only sketch is simple. An HTML file with the same base name is created.
This will only fail if the directory already contains a HTML file with this name.

Converting an HTML sketch to a JavaScript-only sketch involves deleting the HTML file that
includes the script. This potentially looses some information. Before the file is deleted,
the following checks are made:

* The HTML file should include only a single script file.
* The libraries that the HTML file includes (via `<script>` tags) should be the
  same as the libraries that will be inferred from the script file. (See
  “Library inference”, below.)

## Implementation Notes

The [p5-analysis implementation
notes](./p5-analysis/README.md#implementation-notes) describe sketch detection,
automatic library inclusion, and other details of the implementation.

## Limitations

* This code hasn't been tested on Windows.
* Generated sketches require an internet connection to run. They load the p5.js
  and other libraries from a content delivery network (“CDN”). Browsers cache
  these files, so reloading a page or running other sketches that use the same
  (or no) libraries do not require additional internet access, but you will need
  internet access the first time you use this extension or after the browser
  cache has expired.
* The server requires an internet connection in order to display sketches and
  directory listings. (It loads the Semantic UI CSS framework from a CDN.)
* This code hasn't been tested with
  [instance-mode](https://github.com/processing/p5.js/wiki/Global-and-instance-mode)
  sketches.
* Library inference hasn't been tested with sketches that are written as
  [modules](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Modules).
* See the implementation notes for limitations on the recognition of associated
  files.

## API

The server can be invoked programmatically. In a JavaScript or TypeScript project:

```sh
npm install --save p5-server
```

```js
import { Server } from "p5-server";

let server = await Server.start();
console.log(`Open ${server.url} in a browser`);
```

For convenience, this package also re-exports the `Sketch`, `Script`, and
`Library` classes that it imports from
[p5-analysis](https://www.npmjs.com/package/p5-analysis).

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

[MIT](LICENSE) © by Oliver Steele

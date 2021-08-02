# P5.js Server

This project is a command-line interface for [p5.js](https://p5js.org/).

It is also available as a [Visual Studio Code
extension](https://github.com/osteele/vscode-p5server#readme).

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

`p5 create  --html` creates a sketch named `sketch.js` in the current directory.

This is a **JavaScript-only sketch**. The server (below) can run this, and you can
paste it into online editors such as the P5 web editor and OpenProcessing.org.

`p5 create my-sketch` creates an HTML file named `my-sketch.html` and a
JavaScript file named `my-sketch.js`.

The default generated script contains `setup()` and `draw()` functions. The
`setup()` functions creates a canvas, and the `draw()` functions draws circles
that follow the mouse. `--options` can be used to customize this script.
See the reference, below.

### Start the server

`p5 serve` starts a server, that serves files from the current directory.

`p5 serve directory` starts a server that serves files from another directory.

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

### `p5 create [sketch-name]`

Creates a folder named `sketch-name` (default `sketch`), that contains an
`index.html` file and a `sketch.js` file.

### `p5 create [sketch-name] --no-html`

Creates a file named `sketch-name.js` in the current directory.

Use `-options <options>` to configure the JavaScript file. `<options>` is a
comma-separate list of script configuration options, such as `resizeCanvas` or
`preload,static`.

The script configuration options are:

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

## API

This packages makes the following APIs available. They are currently used by the
[Visual Studio Code
extension](https://github.com/osteele/vscode-p5server#readme). These APIs are
not stable until this package reaches version 1.0.

* `Server` – a web server with p5.js-aware directory listings, that serves
  JavaScript-only sketches with automatic library includes, and that has live
  reload.
* `Sketch` – the interface to generate sketch files, find associated files,
  infer libraries, and scan directories for sketches that they contain.

## Implementation Notes

### Sketch recognition

A “JavaScript-only sketch file” is a JavaScript file that includes a function
definition for `setup()` function, and a call to `createCanvas()` (and does not
itself define `createCanvas`).

An HTML sketch file is an HTML file that includes a `<script>` element with a
`src` attribute that ends in `p5.js` or `p5.min.js`.

A directory is recognized as a sketch if it contains a single sketch and either
no loose files, or the only loose file is a README.

### Sketch descriptions

The directory listing displays the sketch description. For an HTML sketch, this
is the value of the `content` attribute of the `<meta name="description">`
element. For a JavaScript sketch that begins with a block comment, this is the
paragraph that begins with "`Description:` " in that block.

### Automatic library inclusion

JavaScript-only sketches automatically include many of the libraries that are
listed on the [p5.js Libraries page](https://p5js.org/libraries/), as well as
[dat.gui](https://github.com/dataarts/dat.gui). For example, if the sketch calls
`loadSound`, it will include the p5.sound library. If it refers to `ml5`, it
will include the ml5.js library.

Automatic library loading is done by examining the free variables, and
references to `p5.prop` where `prop` is any property name, in the JavaScript source.

A list of libraries, and the global variables that trigger including a library,
is in `./src/libraries.json`. In order to qualify for automatic inclusion, an
entry in this list must have either a `path` or `npmPackage` key.

### Associated files

The directory listing groups the files that are associated with a project into
the card for that project.

The files that are associated with an HTML file are just the local script files
that are included via the `<script>` tag and `<link>` tags. The server does not
inspect `<img>` tags,
etc., and it does not inspect CSS files.

The files that are associated with a script file are the string literal
arguments to functions whose names begin with `load`, such as `loadImage()` and
`loadModel()`. The server will recognize `cat.png` as an associated file in the
call `loadImage("cat.png")`, but not in the following snippets:

```js
let name = "cat.png";
loadImage(name);
```

```js
let name = "cat";
loadImage(`${name}.png`);
```

```js
for (let name of ['dog.png', 'cat.png']) {
  loadImage(name);
}
```

```js
let loader = loadImage;
loader("cat.png");
```

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

[MIT](LICENSE)

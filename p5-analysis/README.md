# P5 Analysis

[![npm version](https://badge.fury.io/js/p5-analysis.svg)](https://www.npmjs.com/package/p5-analysis)

This library provides functionality for finding, analyzing, and generating
[P5.js sketches](https://p5js.org). It is used by the
[p5-server](https://github.com/osteele/p5-server#p5js-server) command-line tool,
and by the [P5 Server Visual Studio Code
extension](https://github.com/osteele/vscode-p5server#readme).

The API consists of three classes:

* {@link Sketch} the interface to generate
  sketch files, find associated files, infer libraries, and scan directories for
  sketches that they contain.
* {@link Script} represents a JavaScript file. It provides
  script analysis features that are used to detect whether a script is a p5.js
  sketch, and to perform library inference.
* {@link Library} represents a [p5.js
  library](https://p5js.org/libraries/).

These APIs are not stable until this package reaches version 1.0.

## Installation

```sh
npm install --save p5-server
```

## Usage

```js
import { Sketch } from "p5-server";

let { sketches } = Sketch.analyzeDirectory(); // find all the sketches in a directory

let sketch = Sketch.fromFile('sketch.js');
console.log(sketch.description);
console.log(sketch.libraries);
console.log(sketch.files);
```

See the source to [p5-server](https://github.com/osteele/p5-server) for
additional usage examples.

## Implementation Notes

### Sketch detection

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
* This code hasn't been tested with
  [instance-mode](https://github.com/processing/p5.js/wiki/Global-and-instance-mode)
  sketches.
* Library inference hasn't been tested with sketches that are written as
  [modules](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Modules).
* See the implementation notes for limitations on the recognition of associated
  files.

## License

[MIT](LICENSE) © by Oliver Steele

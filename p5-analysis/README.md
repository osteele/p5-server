# P5 Analysis

[![npm version](https://badge.fury.io/js/p5-analysis.svg)](https://www.npmjs.com/package/p5-analysis)
<!-- [![CI workflow](https://github.com/osteele/p5-server/actions/workflows/ci.yml/badge.svg)](https://github.com/osteele/p5-server/actions/workflows/ci.yml) -->

- [Installation](#installation)
- [Usage](#usage)
  - [Command Line](#command-line)
  - [API](#api)
- [Implementation Notes](#implementation-notes)
  - [Sketch detection](#sketch-detection)
  - [Sketch descriptions](#sketch-descriptions)
  - [Automatic library inclusion](#automatic-library-inclusion)
  - [Associated files](#associated-files)
- [Limitations](#limitations)
- [License](#license)

This library provides a programmatic API for finding, analyzing, and generating
[P5.js sketches](https://p5js.org). It was created for the
[p5-server](https://github.com/osteele/p5-server#p5js-server) command-line tool,
and the [P5 Server Visual Studio Code
extension](https://github.com/osteele/vscode-p5server#readme).

The API consists of three classes:

- {@link Sketch} represents an sketch. This is at least a script file, and may
  also include an HTML file and additional scripts an  assets. It is the
  interface to generate sketch files, find associated files, infer libraries,
  and scan directories for sketches that they contain.

- {@link Script} represents a JavaScript file. It provides script analysis
  features that are used to detect whether a script is a p5.js sketch, and to
  perform library inference.

- {@link Library} represents a [p5.js library](https://p5js.org/libraries/).

The API reference is [here](https://osteele.github.io/p5-server/p5-analysis/).

These APIs are not stable until this package reaches version 1.0.

## Installation

```sh
npm install --save p5-analysis
yard add p5-analysis
```

## Usage

`p5-libraries list` – list the known libraries

With `--json`, this can be used with [jq](https://stedolan.github.io/jq/), e.g.
`yarn cli:libraries list --json | jq '.[].importPath'` to list all the import
paths, or `yarn cli:libraries list --json | jq '.[] | select(.packageName) |
.name'` to print the names of libraries that have been published as NPM
packages.

`p5-libraries check all` – validate the library homepages, import paths, and
other properties

`p5-library describe LIBRARY_NAME` – print the name, home page, import path,
and defines of a specific library

`p5-library property LIBRARY_NAME import-path [--html]` – print the import path
for named library. With the `--html` options, print a `<script>` element that
can be included in an HTML page.

`p5-library docs [-o OUTPUT] [-t TEMPLATE]` – create a documentation page that
lists all the libraries. TEMPLATE should be a
[Nunjucks](https://mozilla.github.io/nunjucks/) file.

`p5-tree PATH` – print the sketches in PATH and its subfolders, and the files
 and libraries that each sketch uses.

`p5-analyze sketch PATH` - print the files and libraries associated with a
sketch

If [p5-server](https://osteele.github.io/p5-server/) is installed, these
commands can also be accessed via `p5 analyze`, `p5 libraries` and `p5 tree`
(without the hyphen).

### Command Line

### API

```js
import { Sketch } from "p5-analysis";

let { sketches } = Sketch.analyzeDirectory(); // find all the sketches in a directory

let sketch = Sketch.fromFile('sketch.js');
console.log(sketch.description);
console.log(sketch.libraries);
console.log(sketch.files);
```

See the source to [p5-server](https://github.com/osteele/p5-server)
for additional usage examples.

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

JavaScript-only sketches can automatically include any of [these
 libraries](https://osteele.github.io/p5-server/p5-analysis/libraries). For
 example, if the sketch calls `loadSound`, it will include the p5.sound library.
 If it refers to `ml5`, it will include the ml5.js library.

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

- This code hasn't been tested on Windows.
- Generated sketches require an internet connection to run. They load the p5.js
  and other libraries from a content delivery network (“CDN”). Browsers cache
  these files, so reloading a page or running other sketches that use the same
  (or no) libraries do not require additional internet access, but you will need
  internet access the first time you use this extension or after the browser
  cache has expired.
- This code hasn't been tested with
  [instance-mode](https://github.com/processing/p5.js/wiki/Global-and-instance-mode)
  sketches.
- Library inference hasn't been tested with sketches that are written as
  [modules](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Modules).
- See the implementation notes for limitations on the recognition of associated
  files.

## License

[MIT](LICENSE) © by Oliver Steele

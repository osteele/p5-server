# p5-analysis

[![npm version](https://badge.fury.io/js/p5-analysis.svg)](https://www.npmjs.com/package/p5-analysis)
[![Changelog](https://img.shields.io/badge/changelog-gray.svg)](./CHANGELOG.md)
[![CI workflow](https://github.com/osteele/p5-server/actions/workflows/ci.yml/badge.svg)](https://github.com/osteele/p5-server/actions/workflows/ci.yml)

- [Installation](#installation)
- [Command-Line Usage](#command-line-usage)
- [API](#api)
- [Implementation Notes](#implementation-notes)
  - [Sketch detection](#sketch-detection)
  - [Sketch descriptions](#sketch-descriptions)
  - [Automatic library inclusion](#automatic-library-inclusion)
  - [Associated files](#associated-files)
- [Limitations](#limitations)
- [License](#license)

This library provides a programmatic API for finding, analyzing, and generating
[p5.js sketches](https://p5js.org). It was created for the
[p5-server](https://github.com/osteele/p5-server#p5js-server) command-line tool
and the [p5 Server Visual Studio Code
extension](https://github.com/osteele/vscode-p5server#readme).

The API centers on three classes:

- `Sketch` represents a sketch. A sketch contains at least a script file and may
  also include an HTML file and additional scripts and assets. It is the
  interface for generating sketch files, finding associated files, inferring
  libraries, and scanning directories for sketches.

- `Script` represents a JavaScript file. Its analysis determines whether a
  script is a p5.js sketch and supports automatic library inclusion.

- `Library` represents a [p5.js library](https://p5js.org/libraries/).

See the [API reference](https://osteele.github.io/p5-server/p5-analysis/) for
class and method documentation.

The package follows semantic versioning.

## Installation

```sh
npm install p5-analysis
# or
bun add p5-analysis
```

p5-analysis requires Node.js 20 or newer and is distributed as an ECMAScript
module.

## Command-Line Usage

`p5-libraries list` lists the known libraries.

The `--json` output can be queried with [jq](https://jqlang.github.io/jq/). This
command lists all import paths:

```sh
p5-libraries list --json | jq '.[].importPath'
```

This command prints the names of libraries published to npm:

```sh
p5-libraries list --json | jq '.[] | select(.packageName) | .name'
```

`p5-libraries check all` validates library home pages, import paths, and other
properties.

`p5-libraries describe LIBRARY_NAME` prints the name, home page, import path,
and definitions of a library.

`p5-libraries property LIBRARY_NAME import-path [--html]` prints a library's
import path. The `--html` option prints a `<script>` element for use in an HTML
page.

`p5-libraries docs [-o OUTPUT] [-t TEMPLATE]` creates a page that lists all
libraries. `TEMPLATE` must be a
[Nunjucks](https://mozilla.github.io/nunjucks/) template.

`p5-tree PATH` prints the sketches in `PATH` and its subdirectories, along with
the files and libraries that each sketch uses.

`p5-analyze sketch PATH` prints a readable sketch report. It includes the entry
files, associated assets, additional libraries, missing files, and syntax
diagnostics. File locations are absolute so coding agents and editor tools can
open them directly.

If [p5-server](https://osteele.github.io/p5-server/) is installed, these
commands are also available through `p5 analyze`, `p5 libraries`, and `p5 tree`.
For example, `p5 analyze sketch PATH` is equivalent to the `p5-analyze` command
above. `p5-library` is an alias for `p5-libraries`.

## API

```js
import { Sketch } from 'p5-analysis';

const { sketches } = await Sketch.analyzeDirectory('.');

const sketch = await Sketch.fromFile('sketch.js');
console.log(sketch.description);
console.log(sketch.libraries);
console.log(sketch.files);
```

The [p5-server source](https://github.com/osteele/p5-server) contains additional
usage examples.

## Implementation Notes

### Sketch detection

A “JavaScript-only sketch file” is a JavaScript file that defines `setup()` and
calls `createCanvas()` without defining `createCanvas` itself. Common
instance-mode sketches that pass a callback to `new p5(...)` are also
recognized.

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

JavaScript-only sketches can automatically include any of the libraries in [this
list][libraries]. For example, if the sketch source contains a call to
`loadSound`, the sketch will include the p5.sound library. If the sketch source
refers to `ml5`, the sketch will include the ml5.js library.

Automatic library loading examines free variables and references of the form
`p5.prop` in the JavaScript source.

The [library definitions](https://github.com/osteele/p5-server/tree/main/p5-analysis/src/models/libraries)
record the global variables that trigger inclusion.

### Associated files

The directory listing groups the files that are associated with a project into
the card for that project.

Files associated with an HTML sketch include local files referenced by
`<script src>` and `<link href>` elements. The analyzer does not inspect `<img>`
elements or CSS contents.

The files that are associated with a script file are the string literal
arguments to functions whose names begin with `load`, such as `loadImage()` and
`loadModel()`. The server will recognize `cat.png` as an associated file in the
first call below, but not in the others:

```js
loadImage("cat.png"); // recognizes `cat.png` as an associated file
```

```js
let name = "cat.png";
loadImage(name); // does not recognize any associated files
```

```js
let name = "cat";
loadImage(`${name}.png`); // does not recognize any associated files
```

```js
for (let name of ['dog.png', 'cat.png']) {
  loadImage(name); // does not recognize any associated files
}
```

```js
let loader = loadImage;
loader("cat.png"); // does not recognize any associated files
```

## Limitations

- Routine CI runs on Linux. macOS and Windows checks are available as a manual
  workflow.
- Generated sketches load p5.js and other libraries from content delivery
  networks. They require internet access until those resources are present in
  the browser cache. When sketches are served by [p5-server][p5-server], its
  [proxy cache][airplane-mode] can provide the resources offline.
- Support for
  [instance-mode](https://github.com/processing/p5.js/wiki/Global-and-instance-mode)
  sketches is limited to recognizing the common `new p5(callback)` form.
- The script analyzer parses ECMAScript modules but does not follow imports to
  analyze other modules.
- See the implementation notes for limitations on the recognition of associated
  files.

## License

[MIT](LICENSE) © by Oliver Steele

[p5-server]: https://osteele.github.io/p5-server/
[airplane-mode]: https://osteele.github.io/p5-server/docs/proxy-cache
[libraries]: https://osteele.github.io/p5-server/p5-analysis/libraries

# API

[p5-server](https://github.com/osteele/p5-server) is a command-line tool, but it
doubles as a library for programmatic use.

As a library, it provides three classes:

* [Server](./classes/Server.html) is a web server with live reload, sketch-aware
  directory listings, and library inference for JavaScript-only sketches.
* [Sketch](./classes/Sketch.html) the interface to generate sketch files, find associated files,
  infer libraries, and scan directories for sketches that they contain.
* [Library](./classes/Library.html) represents a [p5.js
  library](https://p5js.org/libraries/).

These APIs are currently used by the
[Visual Studio Code
extension](https://github.com/osteele/vscode-p5server#readme). These APIs are
not stable until this package reaches version 1.0.

## Installation

```sh
npm install --save p5-server
```

## Usage

### Server

```js
import { Server } from "p5-server";

let server = await Server.start();
console.log(`Open ${server.url} in a browser`);
```

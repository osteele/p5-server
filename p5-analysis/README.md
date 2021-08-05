# P5 Analysis

[![npm version](https://badge.fury.io/js/p5-analysis.svg)](https://badge.fury.io/js/p5-analysis)

This library provides functionality for finding, analyzing, and generating [P5.js sketches](https://p5js.org).
It is used by [p5-server](https://github.com/osteele/p5-server) and
the [P5 Server Visual Studio Code
extension](https://github.com/osteele/vscode-p5server#readme). These APIs are
not stable until this package reaches version 1.0.

The API consists of three classes:

* [Server](./classes/Server.html) is a web server with live reload, sketch-aware
  directory listings, and library inference for JavaScript-only sketches.
* [Sketch](./classes/Sketch.html) the interface to generate sketch files, find associated files,
  infer libraries, and scan directories for sketches that they contain.
* [Library](./classes/Library.html) represents a [p5.js
  library](https://p5js.org/libraries/).

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

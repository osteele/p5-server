# P5.js Runner

A work in progress. This project is a command-line interface for p5.js.

Sketches use a CDN.

## Current Features

- [x] server with live reload
- [x] view a sketch.js without an associated index.html

## Planned Features

- [ ] display parse errors in the browser
- [ ] commands to add and update libraries
- [ ] specify the CDN server, or use a local file

## Installation

Install [Node.js](https://nodejs.org/).

In the command line, enter:

```sh
npm install -g p5-runner
```

## Commands

### `p5 create [sketch-name]`

Creates a folder named `sketch-name` (default `sketch`), that contains an
`index.html` file and a `sketch.js` file.

### `p5 run [sketch-name]`

Runs a web server that serves the current directory (if there is no argument),
or the `sketch-name` subdirectory of the current directory.

# p5-server API

The [project README](https://github.com/osteele/p5-server#readme) provides an
overview and command-line documentation.

## Installation

```sh
npm install --save p5-server
# or
bun add p5-server
```

p5-server requires Node.js 20 or newer and is distributed as an ECMAScript
module.

## Usage

```js
import { Server } from 'p5-server';

const server = await Server.start();
console.log(`Open ${server.url} in a browser`);
```

Pass `agentSupport` to add the browser API used by coding agents and the
`p5 render` command:

```js
const server = await Server.start({
  root: 'sketch.js',
  agentSupport: {
    seed: 42,
    canvasDimensions: { width: 800, height: 800 },
    pixelDensity: 1,
  },
});
```

Generated pages and automatic library inclusion can be configured through the
same API:

```js
const server = await Server.start({
  p5Version: '2.3.2',
  libraryPolicy: {
    compatibility: 'verified',
    includeLegacy: false,
    allow: ['p5.woff2'],
    deny: ['dat.gui'],
  },
});
```

`GET /__p5_server/api/libraries` returns the effective policy, eligible
catalog, and excluded entries with reasons. Applications can also use the
re-exported `LibraryIndex` and `Sketch.resolveLibraries()` APIs directly to
inspect ambiguities and source-specific exclusions.

The sketch page exposes `window.__p5Agent`. It can report sketch status, wait
for a canvas or p5 frame, set the random and noise seeds, and return the canvas
as a data URL. The [Agent support
guide](https://github.com/osteele/p5-server#use-p5-server-with-coding-agents)
documents the browser API and headless command.

The [Visual Studio Code
extension](https://github.com/osteele/vscode-p5server#readme) demonstrates the
API in an application.

Applications that already provide file watching can pass a `fileWatchProvider`
instead of starting p5-server's Chokidar watcher. The provider receives the
paths used by live reload and a callback for created, changed, or deleted files,
and returns a disposable subscription:

```js
const server = await Server.start({
  fileWatchProvider(paths, onDidChange) {
    const watcher = watchWithHost(paths, onDidChange);
    return { dispose: () => watcher.close() };
  },
});
```

## See Also

For convenience, this package also re-exports the `Sketch`, `Script`, and
`Library` classes from [p5-analysis](https://www.npmjs.com/package/p5-analysis).
Their [API documentation](https://osteele.github.io/p5-server/p5-analysis/) is
published with this reference.

# P5-Server API

This is API documentation for the P5 server. See the [project home
page](https://github.com/osteele/p5-server#readme) for an overview of the project
and for documentation of command-line usage.

## Installation

```sh
npm install --save p5-server
bun add p5-server
```

## Usage

```js
import { Server } from "p5-server";

let server = await Server.start();
console.log(`Open ${server.url} in a browser`);
```

The [Visual Studio Code
extension](https://github.com/osteele/vscode-p5server#readme) is an example of
the API usage.

## See Also

For convenience, this package also re-exports the `Sketch`, `Script`, and
`Library` classes from [p5-analysis](https://www.npmjs.com/package/p5-analysis).
The API documentation for these classes is
[here](https://osteele.github.io/p5-server/p5-analysis/).

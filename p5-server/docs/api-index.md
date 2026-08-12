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

The [Visual Studio Code
extension](https://github.com/osteele/vscode-p5server#readme) demonstrates the
API in an application.

## See Also

For convenience, this package also re-exports the `Sketch`, `Script`, and
`Library` classes from [p5-analysis](https://www.npmjs.com/package/p5-analysis).
Their [API documentation](https://osteele.github.io/p5-server/p5-analysis/) is
published with this reference.

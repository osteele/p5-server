# Change Log

## [0.7.1]

- Update README
- Better Markdown formatting
- Serve files with spaces

## [0.7.0]

- New option `p5 serve --split` is a shortcut for `p5 serve --theme split`
- Reloading a page in the split view theme returns to the same sketch
- Center the canvas
- Fixed split view iframe size
- Embed large file from private CDN. githubusercontent.com gives “Content length
  exceeded” error when hotlinking from npm
- Update notifier includes link to changelog (this file). This will affect
  future updates but not updates to this version.

## [0.6.3]

- Improve docs
- Add package.json#repository.directory

## [0.6.1]

- Work around an error when `p5 build` encounters a directory with no README

## [0.6.0]

- Add `p5 build` themes; default to "split" = sidebar + iframe
- In-browser display of syntax error uses code highlighting
- Knows about more libraries
- Features to support [VSCode
  extension](https://marketplace.visualstudio.com/items?itemName=osteele.p5-server).)
  - Add an API to support multiple mount points
  - Relay console.info etc. messages to the server.

## [0.5.1]

- fix `import "path/posix"` -> `import "path"`

## [0.5.0]

- added `p5 tree`
- added `p5 build`
- more functionality is async behind the scenes

## [0.4.2]

- Change options to `p5 create`
- Set the title for the default directory

## [0.3.5]

- Server.close is async
- Multiple concurrent servers can be instantiated

## [0.3.4]

- `p5 serve` report default directory name as '.'

## [0.3.3]

- Fixes to package distr

## [0.3.2]

- Factored out [p5-analysis](https://www.npmjs.com/package/p5-analysis) package
- Updated to p5-analysis 0.3.2; adapted to API changes

## [0.3.1]

- Fix filename case inconsistency that caused error on Linux.

## [0.3.0]

- Add a command an API to convert between HTML and JavaScript-only sketches
- Added svg files to distr
- Remove src from distribution
- Added scanPorts server option. This defaults true (the previous behavior)
- Sketch API changes (see commit descriptions)

## [0.2.2]

- Add libraries.json back to distr

## [0.2.1]

- Fix crash involving `<script>` tags with no src attribute
- Teach script analyzer about script expressions; (properly) ignore meta properties
- Add a directory listing favicon
- learn the ASCIIArt script include

## [0.2.0]

- Request for sketch.js redirects to index.html if this exists
- Script analysis returns a map of definition types
- Rename findProject -> analyzeDirectory
- Add descriptions to the example sketches
- Improve sketch directory detection
- Teach script analyzer about class declarations, template literals

## [0.1.9]

- recognize single-sketch directories
- document implementation notes

## [0.1.8]

- use a template, generation options, for sketch generation

## [0.1.7]

## [0.1.6]

## [0.1.5]

## [0.1.4]

- find an unoccupied port
- Add a Script model
- refine script js detection
- CLI to create js-only sketches
- use Husky
- rename Project -> Sketch
- export ts declarations, for programmatic use by vscode-p5-server (and potentially other clients)
- more tooltips
- recognize libraries in HTML files
- parse es modules

## [0.1.2]

- add tooltips
- learn to import libraries that have been published to npm
- improvements to script analysis
- improvements to directory listing

## [0.1.1]

## [0.1.0]

## [0.0.1]

- Initial release

# Change Log

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

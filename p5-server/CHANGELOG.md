# Change Log

## Unreleased

- Libraries can be specified as comment directives
- Performance improvements: cache script analysis
- Directory index ignores additional patterns
- Switch back to parsing the HTML in order to inject the script tag; fall back
  with a warning
- Change default theme to split view; deprecate `--split` option

## [0.8.5] - 2021-10-28

- Restore syntax-error reporting functionality
- `p5 tree` takes `--tabWidth [N]`, multiple directories
- Additional changes inherited from [p5-analysis](https://github.com/osteele/p5-server/blob/main/p5-analysis/CHANGELOG.md)

## [0.8.4] - 2021-10-25

- `p5 convert` is smarter; can convert files into folders
- A directory is classified as a single-directory sketch only if the HTML file
  is named index.html
- performance improvements in sketch detection, library inference

API changes:

- Rename Server#stop() -> Server#close()

## [0.8.2] - 2021-10-05

- Emergency fix to script tag injection in js distribution

## [0.8.1] - 2021-10-05

- Updates to screenshot client code
- Fix import paths for p5.xr, p5.3D
- Import libraries that are only hosted on git from ghcdn.rawgit.org, not
  raw.githubusercontent.com. This fixes an issue with their content type that
  prevented some libraries from loading.

## [0.8.0] - 2021-10-04

New:

- New command `p5 screenshot FILE` saves the canvas as an image file
- `p5 serve` has `--open <BROWSER>` option

Fixed:

- `p5 serve path/to/sketch.html`

## [0.7.2] - 2021-10-03

Fixed:

- Fix console relay (used by vscode extension)

Improved:

- Add libraries

## [0.7.1] - 2021-10-01

Improved:

- Update README
- Better Markdown formatting

Fixed:

- Serve files, directories with spaces in their names

## [0.7.0] - 2021-09-27

New:

- New option `p5 serve --split` is a shortcut for `p5 serve --theme split`

Improved:

- Reloading a page in the split view theme returns to the same sketch
- Center the canvas
- Update notifier includes link to changelog (this file). This will affect
  future updates but not updates to this version.

Fixed:

- Fixed split view iframe size
- Embed large file from private CDN. githubusercontent.com gives “Content length
  exceeded” error when hotlinking from npm

## [0.6.3] - 2021-09-11

Improved:

- Improve docs
- Add package.json#repository.directory

## [0.6.1] - 2021-09-09

Fixed:

- Work around an error when `p5 build` encounters a directory with no README

## [0.6.0] - 2021-09-09

New:

- Add `p5 build` themes; default to "split" = sidebar + iframe
- In-browser display of syntax error uses code highlighting
  - Add an API to support multiple mount points
  - Relay console.info etc. messages to the server.

Improved:

- Knows about more libraries
- Features to support [VSCode
  extension](https://marketplace.visualstudio.com/items?itemName=osteele.p5-server).)

## [0.5.1] - 2021-08-20

Fixed:

- fix `import "path/posix"` -> `import "path"`

## [0.5.0] - 2021-08-17

New:

- added `p5 tree`
- added `p5 build`

Improved:

- more functionality is async behind the scenes

## [0.4.2] - 2021-08-10

Changed:

- Change options to `p5 create`

Improved:

- Set the title for the default directory

## [0.3.5] - 2021-08-09

New:

- Multiple concurrent servers can be instantiated

Improved:

- Server.close is async

## [0.3.4] - 2021-08-08

Improved:

- `p5 serve` no longer report default directory name as '.'

## [0.3.3] - 2021-08-08

Fixed:

- Fixes to package distr

## [0.3.2] - 2021-08-07

- Factored out [p5-analysis](https://www.npmjs.com/package/p5-analysis) package
- Updated to p5-analysis 0.3.2; adapted to API changes

## [0.3.1] - 2021-08-03

Fixed:

- Fix filename case inconsistency that caused error on Linux.

## [0.3.0] - 2021-08-03

New:

- Add a command an API to convert between HTML and JavaScript-only sketches
- Added scanPorts server option. This defaults true (the previous behavior)

Fixed:

- Added svg files to distr

Improved:

- Remove src from distribution
- Sketch API changes (see commit descriptions)

## [0.2.2] - 2021-07-31

Fixed:

- Add libraries.json back to distr

## [0.2.1] - 2021-07-31

Improved:

- Add a directory listing favicon
- learn the ASCIIArt script include

Fixed:

- Fix crash involving `<script>` tags with no src attribute
- Teach script analyzer about script expressions; (properly) ignore meta properties

## [0.2.0] - 2021-07-30

Improved:

- Request for sketch.js redirects to index.html if this exists
- Script analysis returns a map of definition types
- Add descriptions to the example sketches
- Improve sketch directory detection
- Teach script analyzer about class declarations, template literals

Changed:

- Rename findProject -> analyzeDirectory

## [0.1.9] - 2021-07-29

- recognize single-sketch directories
- document implementation notes

## [0.1.8] - 2021-07-28

- use a template, generation options, for sketch generation

## [0.1.7] - 2021-07-28

## [0.1.6] - 2021-07-28

## [0.1.5] - 2021-07-27

## [0.1.4] - 2021-07-27

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

## [0.1.2] - 2021-07-26

- add tooltips
- learn to import libraries that have been published to npm
- improvements to script analysis
- improvements to directory listing

## [0.1.1] - 2021-07-26

## [0.1.0] - 2021-07-26

## [0.0.1] - 2021-07-25

- Initial release

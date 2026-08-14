# Changelog

## 2.0.0

### Major Changes

- 9f65521: Use p5.js 2.3 for generated and JavaScript-only sketches, load p5.sound from
  its p5 2.x-compatible package, generate async asset-loading setup functions,
  and adapt browser rendering, screenshots, and CDN caching to the p5 2 lifecycle.

### Minor Changes

- 711b91b: Add readable sketch diagnostics, bounded headless rendering, and a p5-aware
  browser API for coding agents and browser automation tools.
- 636fa3d: Allow hosts to provide the file watcher used for live reload.
- 7b00c2f: Add a policy-aware library index and resolver, refresh the official p5.js
  library catalog, preserve older projects in a legacy collection, and let
  p5-server configure and expose the effective catalog.

### Patch Changes

- e2258af: Close file watchers for every live-reload source directory when the server
  stops.
- Updated dependencies [711b91b]
- Updated dependencies [7b00c2f]
- Updated dependencies [9f65521]
  - p5-analysis@2.0.0

## Unreleased

### Changed

- Apply script injection and CDN URL rewriting in one HTML parse per response.
  In a local synthetic benchmark on a 10,000-node document with six script
  insertions, median transformation time fell from 276.54 ms to 44.51 ms (84%
  lower, or 6.2 times faster). This benchmark used Bun 1.3.14 on macOS and is
  not a production guarantee.

- Reject source-tree symlinks during static builds, and stage generated output
  before replacing the previous build.
- Bound browser-relay payloads and pending client messages, and require relay
  WebSocket requests with an Origin header to use the served origin.
- Upgrade `cdn-proxy-cache` to 0.3.0.
- Make package build and cleanup scripts portable to Windows.

### Fixed

- Prevent static serving, building, generation, and folder conversion from
  following paths outside their declared roots through symbolic links or
  parent-directory references.
- Reject case-insensitive, canonically equivalent Unicode, and Windows-specific
  output aliases before building or moving sketch files.
- Keep generated pages for nested script-only sketches in their source
  directories, and preflight generated files against every copied descendant.
- Preserve previous build and generated-file contents when a later operation
  fails.
- Initialize the browser console relay in strict bundles, round-trip cyclic
  shared references and BigInt values, bound pending messages by count and
  encoded bytes, enforce the payload cap after connection, and close relay
  sockets with the server. Relay serialization failures no longer throw into
  sketch code.
- Enforce render and screenshot deadlines, capture setup-only sketches, and
  reject screenshot counts and densities that cannot terminate. Multi-frame
  capture now waits for every output write and serializes frames that target
  the same file, including draining accepted writes after a timeout. The
  browser capture client reports non-successful screenshot POST responses and
  does not close as though those frames were saved.
- Validate screenshot frame encoding and image type before saving, use native
  output paths on Windows, and reject numeric values outside runtime limits.
- Attempt HTTP, relay, and LiveReload cleanup independently so one close error
  cannot skip the remaining resources, including during failed startup and when
  watcher disposal fails. Startup rollback retains both the initiating error
  and any cleanup errors.
- Encode filesystem names in generated and programmatic URLs.
- Resolve delegated `p5 analyze`, `p5 libraries`, and `p5 tree` commands from
  the installed `p5-analysis` package.

## [1.0.1] - 2026-08-12

### Fixed

- Publish an npm-compatible `p5-analysis` dependency range instead of the Bun
  workspace protocol.

## [1.0.0] - 2026-08-12

### Added

- Add `--host` for choosing the network interface used by the development
  server.

### Changed

- Distribute the package as an ECMAScript module and require Node.js 20 or
  newer.
- Replace the in-tree CDN proxy implementation with `cdn-proxy-cache`.
- Bind the development and live-reload servers to the loopback interface by
  default.
- Update runtime dependencies, including Express 5 and p5-analysis 1.0.0.
- Match library URLs independently of version numbers and accept all p5.js 1.4
  patch releases.

### Fixed

- Reject requests outside configured source roots, including paths that escape
  through symbolic links.
- Validate static build destinations before writing or removing output.
- Correct compressed proxy responses and nested CSS URL rewrites through the
  updated proxy-cache implementation.
- Parse ECMAScript module syntax during automatic library analysis.

## [0.9.2] - 2021-11-15

Changed:

- Removed dependency on the 'crypto' module, so that this code can (again) be
  used in the VSCode extension. (VSCode's embedded Node.js omits the 'crypto'
  module.)

## [0.9.1] - 2021-11-15

Fixed:

- Replaced ghcdn.rawgit.org by cdn.jsdelivr.net

Improved:

- Warming the cache fetches recursively-mentioned pages.
- Modified the cache warm API to inform the client of progress; for use in the
  vscode extension.

## [0.9.0] - 2021-11-14

Added:

- The server acts as a caching proxy server – requests to known CDNs are cached
- Syntax errors are reported to the console
- 404 errors are reported to the console

## [0.8.7] - 2021-11-12

Added:

- Added `p5 analyze sketch` subcommand

Improved:

- Cache syntax errors
- Remove peer dependencies from distro type files

## [0.8.6] - 2021-11-12

Added:

- Libraries can be specified as comment directives (documentation coming in
  future release)

Improved:

- Performance improvements via cache script analysis
- Directory index ignores additional patterns

Changed:

- Change default theme to split view; deprecate `--split` option
- Switch back to parsing the HTML in order to inject the script tag; fall back
  with a warning

## [0.8.5] - 2021-10-28

- Restore syntax-error reporting functionality
- `p5 tree` takes `--tabWidth [N]`, multiple directories
- Additional changes inherited from [p5-analysis](https://github.com/osteele/p5-server/blob/main/p5-analysis/CHANGELOG.md)

## [0.8.4] - 2021-10-25

- `p5 convert` is smarter; can convert files into folders
- A directory is classified as a single-directory sketch only if the HTML file
  is named index.html
- performance improvements in sketch detection and automatic library inclusion

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

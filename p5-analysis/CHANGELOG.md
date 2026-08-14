# Changelog

## [Unreleased]

## [2.0.0] - 2026-08-13

This release focuses on performance and quality: analysis is substantially
faster, sketch and library detection is more accurate, and generated sketches
move to the p5.js 2 lifecycle.

### Added

- Add readable sketch diagnostics, bounded headless rendering, and a p5-aware
  browser API for coding agents and browser automation tools.
- Add a policy-aware library index and resolver, refresh the official p5.js
  library catalog, preserve older projects in a legacy collection, and let
  p5-server configure and expose the effective catalog.

### Changed

- Use p5.js 2.3 for generated and JavaScript-only sketches, load p5.sound from
  its p5 2.x-compatible package, generate async asset-loading setup functions,
  and adapt browser rendering and screenshots to the p5 2 lifecycle. This is
  the breaking change that requires the 2.0 major version.
- Make directory analysis linear in the number of files and sketches by
  collecting associated files once, reusing each sketch's parsed HTML and
  derived properties, and using directory entries instead of per-file stat
  calls. In a local synthetic warm-cache benchmark, scanning 40 HTML sketches
  fell from approximately 303 ms to a 29 ms median (about 90% lower).
- Analyze scripts with one Babel traversal instead of five. For a synthetic
  2,000-declaration script, median parse-and-analysis time fell from 92.67 ms to
  54.14 ms (42% lower).
- Increase the script-analysis cache from 20 KB to 20 MiB, retain cached source
  text, and avoid rereading unchanged files. For a synthetic script whose cache
  entry exceeded 20 KB, median warm analysis time fell from about 22 ms to
  0.03 ms per call (more than 99% lower).

The measurements above used Bun 1.3.14 on macOS and are synthetic local
benchmarks rather than production guarantees. The approximately 90% directory
scan reduction is cumulative across the directory, HTML-reuse, and cache
changes.

### Fixed

- Recognize p5.js script tags with an explicit regular-expression test instead
  of treating the numeric result of `String.search` as a boolean.
- Require `.html` or `.htm` to occur at the end of HTML filenames.
- Detect nested sketches when deciding whether a directory contains exactly one
  sketch.
- Require HTML sketches to reference both p5.js and a local sketch script, and
  recognize script URLs with query strings, fragments, and protocol-relative
  CDN paths.
- Exclude remote `load*()` URLs from associated local files and normalize local
  URL suffixes.
- Parse the documented `library: NAME` directive without inventing a `:`
  package, and reject unsafe npm package names.
- Enforce the documented loose-file restriction for sketch directories.
- Reject generated filenames that would alias or fail on common Windows and
  macOS filesystems.

## [1.0.0] - 2026-08-12

### Added

- Parse and analyze ECMAScript module syntax.
- Add p5.js-SVG and openSimplexNoise to the automatic library catalog.

### Changed

- Distribute the package as an ECMAScript module and require Node.js 20 or
  newer.
- Recognize forward lexical references, object spreads, destructuring patterns,
  and common p5.js instance-mode sketches during script analysis.
- Match library URLs independently of version numbers and accept all p5.js 1.4
  patch releases.
- Update runtime dependencies and package exports.

### Fixed

- Correct the p5.createloop global definitions.

## [0.6.10] - 2021-11-15

Fixed:

- Replaced ghcdn.rawgit.org by cdn.jsdelivr.net

## [0.6.9] - 2021-11-14

Added:

- Cdn class

Fixed:

- Fixed exception when loadXXX() is called with no argument

## [0.6.8] - 2021-11-12

Added:

- Added `--json` option to `p5 analyze sketch`

Improved:

- Cache syntax errors
- Remove peer dependencies from distro type files

## [0.6.7] - 2021-11-12

Added:

- Libraries can be specified as comment directives (documentation coming in
  future release)
- Add `--json` option to `p5 library describe`, `p5 library list`

Improved:

- Performance improvements via cache script analysis
- Directory analysis ignores additional patterns

## [0.6.6] - 2021-10-28

- Add antiboredom/p5.patgrad to list of libraries
- Reduce number of library categories
- Reorganized the `p5 library` subcommands
- Replace prettier by beautify for speed improvement

## [0.6.5] - 2021-10-25

API changes:

- New enum SketchStructureType
- Sketch.sketchType -> Sketch.structureType; changed the enum values
- Removed LibraryArray
- Library[] return values are readonly

Functional improvements:

- A directory is classified as a single-directory sketch only if the HTML file
  is named index.html

Performance improvements:

- More efficient implementation of Sketch.isSketchDir
- Remove dependency on esprima; only parse the script source once

## [0.6.3] - 2021-10-05

Fixed:

- Replace raw.githubusercontent.com by ghcdn.rawgit.org. This fixes an error
  where some script files didn't have the correct content type, and couldn't be
  loaded.
- Fix import paths for p5.xr, p5.3D

Added:

- Add recommended library role
- Add new syntax for repo-relative import paths
- Add import path to library report

Changed:

- Add library.repository; derive load path from this when present
- Rename `p5 libraries list` -> `p5 libraries report`
- Rename `p5 libraries test-import-paths` -> `p5 libraries validate-import-paths`

## [0.6.2] - 2021-10-03

- Add libraries: anime, CCapture.js, p5.pattern, p5.rotate-about

## [0.6.1] - 2021-09-27

- Generate HTML from PUG template
- Center the canvas

## [0.6.0] - 2021-09-09

Fixed:

- Identify the main script, in an HTML sketch that includes multiple scripts

## [0.5.0] - 2021-08-17

- Many Sketch functions are now async
- Rename unaffiliatedFiles -> unassociatedFiles

## [0.4.2] - 2021-08-11

- Jump through hoops to make babel plugins work in a distribution

## [0.4.0] - 2021-08-10

- Parse scripts that use the spread operator
- Sketch.generate doesn't create directories
- Sketch.generate uses the nodejs fs error when the file exists and force is not set
- Remove DirectoryExistsError

## [0.3.5] - 2021-08-09

- Use library .min.js where available

## [0.3.4] - 2021-08-08

- Remove use of unexported @types/esprima

## [0.3.3] - 2021-08-08

- Use p5-analysis from separate package

## [0.3.2] - 2021-08-07

- Export Script; add Script.getErrors(); remove checkParseScript, generateHtmlContent
- Import libraries from raw.githubusercontent.com, where possible

## [0.3.1] - 2021-08-05

- Initial release. Extracted from [p5-server](https://www.npmjs.com/package/p5-server) 0.3.1.

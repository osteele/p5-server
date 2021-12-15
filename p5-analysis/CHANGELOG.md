# Change Log

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

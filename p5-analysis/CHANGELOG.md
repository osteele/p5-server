# Change Log

## [unreleased]

- add library.repository; derive load path from this when present
- add recommended library role
- add new syntax for repo-relative import paths
- fix paths for p5.xr, p5.3D
- rename `p5 libraries list` -> `p5 libraries report`
- add import path to library report

## [0.6.2] - 2021-10-03

- Add libraries: anime, CCapture.js, p5.pattern, p5.rotate-about

## [0.6.1] - 2021-09-27

- Generate HTML from PUG template
- Center the canvas

## [0.6.0] - 2021-09-09

Bug fixes:

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

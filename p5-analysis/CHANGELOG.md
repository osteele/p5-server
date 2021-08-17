# Change Log

## [unreleased]

- Sketch.fromDirectory, fromFile, analyzeDirectory, isSketchDir are now async
- Rename unaffiliatedFiles -> unassociatedFiles

## [0.4.2]

- Jump through hoops to make babel plugins work in a distribution

## [0.4.0]

- Parse scripts that use the spread operator
- Sketch.generate doesn't create directories
- Sketch.generate uses the nodejs fs error when the file exists and force is not set
- Remove DirectoryExistsError

## [0.3.5]

- Use library .min.js where available

## [0.3.4]

- Remove use of unexported @types/esprima

## [0.3.3]

- Use p5-analysis from separate package

## [0.3.2]

- Export Script; add Script.getErrors(); remove checkParseScript, generateHtmlContent
- Import libraries from raw.githubusercontent.com, where possible

## [0.3.1]

- Initial release. Extracted from [p5-server](https://www.npmjs.com/package/p5-server) 0.3.1.

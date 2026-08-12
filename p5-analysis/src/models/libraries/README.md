# Libraries for Automatic Inclusion

This directory lists the libraries that are candidates for [automatic library
inclusion][automatic-library-inclusion]. For each library, it lists the global
variables (functions, classes, constants, and other variables) that the library
defines, and the properties that the library adds to the `p5` global object.

A library must have a distinctive `defines` signal, an `importPath` or
`packageName`, and `inference: "automatic"` to qualify for automatic inclusion.
An indexed library that has a load path but no distinctive signal can be
selected with a `library:` directive. Catalog-only records without a load path
require a URL or package-name directive supplied by the sketch author.

`community-libraries.json` is generated from the official p5.js website by
`bun run update:library-catalog`. The updater preserves local inference and
compatibility metadata and moves projects that leave the official directory to
`legacy-libraries.json`. The generated catalog is checked in so normal use is
offline and deterministic.

The [library catalog][libraries] presents the categories and libraries in this
directory.

The files are described by the [`categories.json`](../schemas/categories.json)
and [`libraries.json`](../schemas/libraries.json) schemas.

[automatic-library-inclusion]: https://github.com/osteele/p5-server/tree/main/p5-analysis#automatic-library-inclusion
[libraries]: https://osteele.github.io/p5-server/p5-analysis/libraries

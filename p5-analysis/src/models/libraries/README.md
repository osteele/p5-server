# Libraries for Automatic Inclusion

This directory lists the libraries that are candidates for [automatic library
inclusion][automatic-library-inclusion]. For each library, it lists the global
variables (functions, classes, constants, and other variables) that the library
defines, and the properties that the library adds to the `p5` global object.

A library must have either an `importPath` or `packageName` property to qualify
for automatic inclusion.

The [library catalog][libraries] presents the categories and libraries in this
directory.

The files are described by the [`categories.json`](../schemas/categories.json)
and [`libraries.json`](../schemas/libraries.json) schemas.

[automatic-library-inclusion]: https://github.com/osteele/p5-server/tree/main/p5-analysis#automatic-library-inclusion
[libraries]: https://osteele.github.io/p5-server/p5-analysis/libraries

# Libraries for Automatic Inclusion

This directory lists the libraries that are candidates for [automatic library
inclusion][automatic-library-inclusion]. For each library, it lists the global
variables (functions, classes, constants, and other variables) that the library
defines, and the properties that the library adds to the `p5` global object.

In order to qualify for automatic inclusion, a library must have either a `path`
or `npmPackage` key.

See [this page][libraries] for a formatted description of the
categories and libraries in this directory.

These files use the schemas [here
`categories.json`](osteele.github.io/p5-server/p5-analysis/src/models/schemas/libraries.json)
and [here
`xxx-libraries.json`](osteele.github.io/p5-server/p5-analysis/src/models/schemas/libraries.json).

[automatic-library-inclusion]: https://github.com/osteele/p5-server/tree/main/p5-analysis#automatic-library-inclusion
[libraries]: https://osteele.github.io/p5-server/p5-analysis/libraries

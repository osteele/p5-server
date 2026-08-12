---
'p5-server': major
---

Migrate the package to ESM and require Node.js 20 or newer. Replace the in-tree
CDN proxy with `cdn-proxy-cache`, bind development servers to loopback by
default, harden file and build-output handling, and update the runtime
dependencies.

# Releasing

The root project is private. The `p5-analysis` and `p5-server` workspaces are
published independently to npm.

Add a Changeset for each user-visible change:

```sh
bun run changeset
```

Commits merged to `main` cause the release workflow to open or update a version
pull request. That pull request updates package versions, changelogs, and the
lockfile. Merging the version pull request runs the full check suite and
publishes changed packages to npm.

`p5-analysis` is versioned before `p5-server` so that the server's dependency
always refers to an available analysis package.

The repository must define an `NPM_TOKEN` Actions secret for npm publication.
The npm packages should also trust the GitHub Actions release workflow for npm
provenance.

# Contract Tests

This folder is the target home for tests that protect static frontend and repository contracts.

Move tests here when they:

- Read HTML, CSS, or browser JavaScript files directly.
- Check that expected IDs, classes, links, scripts, or labels exist.
- Protect admin navigation, Playground pages, login UI, profile UI, reports pages, or other static page wiring.
- Check source-level contracts such as preload registration or script injection.

Before moving a test into this folder, update paths to public files from `../public` to the correct location, usually `../../public`, or use a shared helper from `web/test/helpers/`.

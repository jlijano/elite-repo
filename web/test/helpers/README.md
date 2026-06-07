# Test Helpers

This folder is the target home for shared test helpers.

Use it for reusable utilities such as:

- `webRoot` and `publicDir` path helpers.
- Server startup and shutdown helpers.
- Free-port lookup helpers.
- JSON fetch helpers.
- Test user, chat, project, and task builders.

Keeping shared setup here will make future test moves safer because tests will no longer need to calculate fragile relative paths from their own folder.

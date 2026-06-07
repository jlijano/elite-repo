# API Tests

This folder is the target home for tests that exercise backend behavior.

Move tests here when they:

- Spawn `server.js`.
- Call API routes with `fetch`.
- Check auth, sessions, users, chats, review runs, health/status, or database-backed behavior.
- Need in-memory storage or PostgreSQL-related setup.

Before moving a test into this folder, update path helpers from `path.resolve(__dirname, "..")` to the correct web root path, usually `path.resolve(__dirname, "..", "..")`, or use a shared helper from `web/test/helpers/`.

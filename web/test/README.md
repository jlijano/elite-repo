# Test Folder Guide

## Purpose

This folder protects the Switchboard Agent web app from regressions. Use it before and after code changes to confirm that server routes, auth, chat behavior, admin pages, Playground pages, and static frontend contracts still work.

## Current Layout

The runnable tests still live directly in `web/test/` for compatibility with the existing `npm test` command.

```text
web/test/
├── *.test.js       # Current runnable tests
├── api/            # Future home for server/API integration tests
├── contracts/      # Future home for static UI and file-contract tests
└── helpers/        # Future home for shared test utilities
```

## Target Layout

Move tests gradually into these folders only when the package script and path helpers are updated in the same change:

```text
web/test/
├── api/            # Tests that spawn the server or call API routes
├── contracts/      # Tests that read HTML, CSS, or browser JS files
├── helpers/        # Shared server startup, fetch, fixture, and path helpers
└── fixtures/       # Optional shared test data
```

## What Goes Where

- `api/`: backend routes, auth, sessions, users, chats, review runs, health/status, and storage behavior.
- `contracts/`: static page expectations, admin navigation, frontend scripts, CSS hooks, and route/page wiring.
- `helpers/`: reusable test utilities such as free-port lookup, server startup, JSON fetch helpers, path helpers, and test data builders.
- `fixtures/`: reusable sample data when tests need stable objects or files.

## Running Tests

From `web/`:

```bash
npm test
npm run check
```

`npm run check` includes syntax checks and then runs the test suite.

## Migration Rule

Do not move test files just for tidiness unless you also:

1. Update relative paths such as `__dirname`, `../public`, and `../server.js`.
2. Update `web/package.json` test scripts.
3. Run `npm test` and `npm run check` locally or confirm GitHub Actions passed.
4. Update `README.md`, `change-log.md`, and `docs/architecture/repository-structure.md` when the executable test layout changes.

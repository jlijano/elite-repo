# Repository Structure Guide

## Purpose

This guide defines where future code, documentation, tests, deployment notes, and troubleshooting material should live so maintenance work is easier to find, update, review, and test.

The current app is already deployed from `web/`, so this guide separates two things:

- Current structure: where files live today.
- Target structure: where future refactors should move files once tests and deployment checks are ready.

Do not move production runtime files only for tidiness. Move them in small phases with tests and GitHub Actions passing after each phase.

## Current Top-Level Structure

```text
elite-repo/
├── .github/
│   └── workflows/          # GitHub Actions checks
├── docs/                   # Long-form documentation and maintenance guides
├── web/                    # Render-ready Express app
├── README.md               # Main project overview and setup
├── agent-directory.md      # Source of truth for Active agents and routing
├── routing-rules.md        # Switchboard routing rules
├── memory-rules.md         # Memory handling rules
├── handoff-template.md     # Handoff format
├── change-log.md           # User-visible repository changes
└── development-plan.md     # Stabilization and roadmap plan
```

## Current Web App Structure

```text
web/
├── db/                     # SQL schema and database setup files
├── public/                 # Browser-served HTML, CSS, and JavaScript
├── test/                   # Node test runner backend and frontend contract tests
├── server.js               # Express app entry point
├── user-management.js      # User/admin account storage and routes
├── playground-management.js
├── entra-management.js
├── oauth-user.js
├── account-verification.js
├── register-*.js           # Compatibility preload modules used by npm start
└── package.json            # Scripts, dependencies, and Node engine
```

## Maintenance-First Target Structure

Use this as the destination when refactoring code. Each move should include path updates, tests, README notes when needed, and a changelog entry.

```text
elite-repo/
├── .github/
│   └── workflows/
├── docs/
│   ├── agent/              # Agent directory, routing, memory, handoff docs after migration
│   ├── architecture/       # Repository maps, app architecture, module boundaries
│   ├── deployment/         # Render, GitHub Actions, environment variable notes
│   ├── maintenance/        # Debugging, testing, release, and review playbooks
│   └── policies/           # Bootstrap account, security, and operational policies
├── web/
│   ├── db/                 # Schema and future migrations/seeds
│   ├── public/
│   │   ├── css/            # Stylesheets grouped by surface
│   │   ├── js/             # Browser scripts grouped by feature
│   │   └── pages/          # Static HTML pages after compatibility routing is added
│   ├── src/
│   │   ├── admin/          # Admin APIs and admin helpers
│   │   ├── auth/           # Login, sessions, profile, OAuth, account verification
│   │   ├── chat/           # Chat sessions, messages, attachments, participants
│   │   ├── config/         # Environment parsing and runtime constants
│   │   ├── integrations/   # GitHub, Google, Entra, OpenAI, and external adapters
│   │   ├── knowledge/      # Knowledge entries and review-run logic
│   │   ├── playground/     # Tasks, projects, notes, and planning APIs
│   │   ├── storage/        # In-memory and PostgreSQL store implementations
│   │   ├── security/       # Redaction, auth middleware, secret-safe utilities
│   │   └── server.js       # Express app assembly after migration
│   ├── test/
│   │   ├── api/            # Backend API integration tests
│   │   ├── contracts/      # Static HTML/CSS/JS contract tests
│   │   └── fixtures/       # Shared test data
│   └── package.json
├── README.md
├── change-log.md
└── development-plan.md
```

## Where To Look During Maintenance

Use this routing map before changing files.

| Work type | Start here | Then check |
| --- | --- | --- |
| App startup or Render failure | `web/package.json`, `web/server.js`, `.github/workflows/web-checks.yml` | `README.md`, deployment docs, Render logs supplied by the user |
| API bug | `web/server.js` and related backend module | `web/test/*.test.js`, `web/db/schema.sql` if storage is involved |
| Login, profile, sessions, users | `web/user-management.js`, `web/oauth-user.js`, `web/account-verification.js` | auth/profile/user tests and admin static pages |
| Chat behavior | `web/server.js`, `web/public/app.js`, `web/public/chat-advanced.js` | chat tests, attachment tests, README API routes |
| Admin page bug | matching `web/public/*.html`, `web/public/*.js`, `web/public/admin.css` | frontend contract tests |
| Playground bug | `web/playground-management.js`, `web/public/playground*.js`, `web/public/playground*.html` | playground tests |
| Database issue | `web/db/schema.sql`, storage functions in backend code | setup docs and health/status tests |
| Agent routing issue | `agent-directory.md`, `routing-rules.md`, `memory-rules.md` | README agent behavior and Switchboard format |
| CI failure | `.github/workflows/web-checks.yml`, `web/package.json` scripts | failing job logs and local `npm run check` when available |
| Documentation drift | `README.md`, `change-log.md`, `development-plan.md` | this guide and relevant docs folder |

## Future Refactor Rules

1. Keep `web/server.js` as the compatibility entry point until Render and tests are updated.
2. Move one feature area at a time, not the whole app at once.
3. After moving backend code, update `require()` paths and run `npm run check`.
4. After moving frontend files, confirm static routes still serve the same URLs or add redirects/compatibility copies.
5. Keep tests close to the behavior they protect. Backend API tests should move toward `web/test/api/`; static markup tests should move toward `web/test/contracts/`.
6. Update README and `change-log.md` whenever a file move changes setup, behavior, deployment, or the maintenance map.
7. Never commit secrets, Render credentials, deploy hooks, API keys, session cookies, passwords, or private tokens.

## Recommended Migration Phases

### Phase 1: Documentation Structure

- Keep root source-of-truth files in place for compatibility.
- Add docs folders for architecture, deployment, maintenance, and policies.
- Link future guides from README.

### Phase 2: Test Structure

- Move tests into `web/test/api/` and `web/test/contracts/`.
- Update `web/package.json` test glob.
- Run `npm test` and `npm run check`.

### Phase 3: Backend Module Structure

- Create `web/src/`.
- Move one backend feature area at a time, starting with low-risk helpers.
- Keep `web/server.js` as a thin entry point that imports `web/src/server.js`.

### Phase 4: Frontend Asset Structure

- Move static scripts into `web/public/js/` and styles into `web/public/css/`.
- Keep HTML routes stable so existing links and Render static serving do not break.
- Update contract tests for script and stylesheet paths.

### Phase 5: Agent Docs Structure

- Move agent, routing, memory, and handoff docs into `docs/agent/` only after the app can read those paths safely.
- Update `knowledgeFiles` handling in the backend before moving source-of-truth docs.

## Baseline Checks

From `web/` run:

```bash
npm install
npm test
npm run check
```

GitHub Actions runs `npm run check` on pushes and pull requests to `main`. Treat a green workflow as the required confirmation before considering structural refactors production-ready.

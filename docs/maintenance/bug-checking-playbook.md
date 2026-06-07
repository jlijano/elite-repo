# Bug Checking Playbook

## Purpose

Use this checklist when investigating bugs, regressions, deployment issues, UI problems, or general repository health checks. It keeps future maintenance work predictable and reduces the chance of changing unrelated files.

## First Pass Triage

1. Identify the user-facing symptom.
2. Classify the area: startup, API, database, auth, chat, admin UI, playground, agent routing, CI, or deployment.
3. Check the matching files in `docs/architecture/repository-structure.md`.
4. Read the smallest relevant code path first.
5. Find the existing test that should cover the behavior.
6. Patch only the affected feature area.
7. Run the narrowest relevant test, then `npm run check` when possible.
8. Update README and `change-log.md` if behavior, setup, deployment, API routes, or structure changed.

## Area Checklist

| Area | Files to inspect first | Checks to run |
| --- | --- | --- |
| Startup / Render | `web/package.json`, `web/server.js`, `.github/workflows/web-checks.yml` | `npm run check` |
| Health/status | `web/server.js`, `web/db/schema.sql` | `node --test test/server.test.js` |
| Chat | `web/server.js`, `web/public/app.js`, `web/public/chat-advanced.js` | chat-related tests in `web/test/` |
| Auth/profile/users | `web/user-management.js`, `web/oauth-user.js`, `web/account-verification.js`, profile/login public scripts | auth, profile, user tests |
| Admin pages | matching `web/public/*.html`, `web/public/*.js`, `web/public/admin.css` | frontend contract tests |
| Playground | `web/playground-management.js`, `web/public/playground*.js`, `web/public/playground*.html` | playground tests |
| Database | `web/db/schema.sql` and storage functions in backend modules | backend integration tests |
| Agent routing | `agent-directory.md`, `routing-rules.md`, `memory-rules.md`, `handoff-template.md` | manual routing format check |
| CI | `.github/workflows/web-checks.yml`, `web/package.json` | GitHub Actions logs and `npm run check` |

## Debugging Order

### 1. Reproduce or narrow the issue

- Capture the route, page, or API endpoint involved.
- Note whether the issue is local-only, GitHub Actions-only, or production/Render-only.
- Avoid guessing from symptoms when logs or tests can narrow the path.

### 2. Inspect contracts

- For backend routes, check status codes, request body shape, auth requirements, and storage effects.
- For frontend pages, check expected IDs/classes/data attributes used by tests and scripts.
- For database issues, check whether behavior differs between in-memory mode and PostgreSQL mode.

### 3. Patch narrowly

- Keep fixes inside the affected feature area.
- Avoid broad formatting changes during bug fixes.
- Do not move files while fixing behavior unless the move is required.

### 4. Verify

From `web/` prefer:

```bash
npm test
npm run check
```

If only one area changed, start with the focused test file, then run the full check when possible.

### 5. Document

Update docs when the user or future maintainer would need to know about the change:

- README for setup, behavior, route, deployment, and structure changes.
- `change-log.md` for meaningful user-visible or maintenance-visible changes.
- `development-plan.md` when the change completes, adds, or reorders roadmap work.

## Safety Rules

- Do not request or commit Render credentials, deploy hooks, passwords, API keys, tokens, cookies, 2FA codes, recovery codes, or session material.
- Do not make destructive production changes without explicit confirmation.
- Prefer GitHub-based auto-deploy. Let Render rebuild from GitHub.
- If Render fails, ask for build logs, diagnose from the logs, patch the repo, and let Render rebuild.

## Final Maintenance Summary Template

Use this shape when reporting a maintenance change:

```text
Changed:
Checked:
Result:
Could not verify:
Next safe step:
```

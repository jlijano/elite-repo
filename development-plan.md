# Development Plan

## Purpose

This plan merges the current repository analysis with the feature roadmap for the Switchboard Agent web app. It is ordered for safe production-oriented stabilization: validate first, fix user-facing defects, then harden security, persistence, and observability.

## Priority Order

1. Stabilize tests, git hygiene, lockfile behavior, and install validation.
2. Fix UI mojibake and password-rule mismatches.
3. Move `user.html` inline CSS and JavaScript into maintainable static files.
4. Make seeded users safer and clearly documented.
5. Improve database initialization and seed management.
6. Expand user, audit, report, health, and review-flow tests.
7. Improve AI response observability and saved-for-review UI.
8. Add review-run locking, duplicate prevention, and diagnostics.
9. Add Playground persistence only if it is approved as a real product feature.

## Feature Plan

| Feature | Current Capability | Improvements | Development Plan |
| --- | --- | --- | --- |
| Repo Hygiene / Validation | The app installs and tests run, but the baseline has failing tests and a normal install creates untracked files. | Reproducible installs, clean working tree, green validation. | Add `.gitignore`; keep `web/package-lock.json` when generated in an environment with registry access; prefer `npm ci` once the lockfile exists; fix stale test contracts; run `npm test` and `npm run check`. |
| Chat UI | Users can create chats, send messages, attach text files, view history, archive chats, and use storage-only mode when AI is unavailable. | Improve message UX, attachment previews, error recovery, archived chat visibility, and mobile polish. | Audit desktop/mobile chat flows; fix broken icon encoding; add clearer upload validation; improve failed-send recovery; test attachment limits and archived-chat behavior. |
| AI Response Flow | Uses OpenAI when `OPENAI_API_KEY` exists; otherwise saves messages for review. | Better status messaging, model config visibility, retry handling, and AI failure observability. | Add structured AI error logging without secrets; surface saved-for-review state; add optional retry; document `OPENAI_MODEL`; test configured/unconfigured AI states. |
| Chat Storage | Supports in-memory mode and optional PostgreSQL via `DATABASE_URL`. | Reduce duplicated database initialization and improve migrations/seed handling. | Inspect `server.js`, `user-management.js`, and `schema.sql`; split schema and seeds; gate default-user seeding; share one initialization path; add startup health diagnostics. |
| Knowledge Base | Shows project knowledge and approved backend knowledge. Admins can approve/archive review-created entries. | Better filtering, editing, source traceability, and workflow clarity. | Add source chat/message links; improve filters; validate edits; clarify approval/archive UI; test approval, archive, traceability, and invalid edits. |
| Review Runs | Reviews unreviewed messages and creates pending knowledge entries; supports manual/admin runs and optional interval runner. | Better scheduling controls, error reporting, and duplicate prevention. | Add run locking; capture trigger/source/timing/count context; detect duplicate knowledge; improve failed-run UI; test success, failure, overlap, and duplicate prevention. |
| Admin Dashboard | Dedicated pages exist for Chat, Knowledge, User, Playground, Settings, Reports, Logs, Review runs, System health, and User audit. | Standardized navigation, extracted page code, fixed icons. | Move `user.html` inline CSS to `admin.css`; move page-specific JS to `user-page.js`; normalize labels/icons; align tests with intended UI. |
| User Management | Admins can create, edit, disable, reactivate, search users, upload profile photos, and review audit events. | Better modal behavior, table accessibility, role descriptions, audit export reliability. | Fix user-page test contracts; add accessible table labels; improve modal/photo validation; preserve explicit `user.disabled` and `user.reactivated` audit events; test modal/photo/export/search flows. |
| Authentication | Users log in with email/password. Sessions are stored server-side by token hash. Owner/admin sessions can access admin APIs. | Safer default-account policy, clearer session expiry, consistent logout. | Document seeded/bootstrap accounts; gate or remove weak defaults for production; consider forced password change; unify logout; add expiry messaging and tests. |
| Profile Management | Logged-in users can update name, email, photo URL, and password. Password changes require current password and rotate the session. | Password policy consistency and better photo handling. | Align HTML `minlength` with backend 12-character policy; reuse photo validation; add clear validation messages; test invalid current password, password change, session rotation, and photo validation. |
| Audit Events | Tracks login, logout, user creation, updates, disable/reactivate, duration, and activity. | Better event taxonomy and reporting. | Preserve explicit event names; update stale tests expecting generic `user.updated`; show event details; improve CSV report data; avoid sensitive details. |
| Reports | Loads public status and protected summary, review-run, and user-audit data. | Data shape consistency and protected empty states. | Normalize summary mapping; fix mojibake separators; add filters/date ranges; test public/protected/empty states and data shapes. |
| Settings | Includes theme preference, refresh cadence, access/security summary, review runs, health, and diagnostics. | More accurate diagnostics and clearer admin-session state. | Use clean dataset access; improve refresh cleanup; show last refresh time; add environment/config diagnostics without secrets; test manual/auto refresh. |
| System Health | `/health` and `/api/status` report storage, AI, and directory availability. | Deeper database and config checks. | Add database latency, schema readiness, storage mode diagnostics, and OpenAI presence without secret values; test database and config failure modes. |
| Playground | Static workspace/task/project/board planning page. | Persistence only if approved. | Defer persistence until core stability; decide whether tasks/projects should be stored; if approved, add tables, CRUD APIs, frontend state, and drag/drop tests. |
| Theme Support | Light/dark/system handling across chat/admin pages. | Less duplicated theme code and fixed icon encoding. | Extract shared theme script; replace mojibake icons; ensure live system-mode updates; test all page theme contracts. |
| Testing | Node tests cover backend APIs and frontend contracts, but some tests are stale. | Align tests with intended behavior and cover real defects. | Fix app/test mismatches; add regression tests for mojibake, password rules, seeded users, audit events, user modal behavior, reports states, and health failure modes. |
| Documentation | README documents routes, setup, env vars, tests, deployment, and maintenance rules. | Update after behavior, seed, and folder changes. | Add seeded account policy; document password policy; update folder structure and database initialization notes; update `change-log.md`; never expose real secrets. |

## Current Confirmed Fixes Started

- Added `.gitignore` to keep dependencies, env files, logs, coverage, caches, and local artifacts out of source control.
- Aligned `update-profile.html` new-password and confirmation fields with the backend 12-character password policy.

## Verification Notes

Local clone, raw GitHub downloads, and npm registry access were blocked in the current container, so full local `npm test` / `npm run check` validation must run in GitHub Actions or a normal local checkout. Do not treat this plan as production approval until the full suite is green.

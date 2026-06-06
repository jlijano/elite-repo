# elite-repo

This repository contains the core project documentation for agent coordination, routing, memory handling, handoffs, and the Switchboard Agent web app.

## Purpose

Use this repository as the central reference for structured collaboration and task management.

## Web app

The `web/` directory contains a Render-ready Express app that serves a plain HTML, CSS, and JavaScript messaging interface for the Switchboard Agent.

### Features

- Chat interface backed by the `/api/chat` endpoint.
- ChatGPT-inspired full-height chat UI with a dark sidebar, centered conversation stream, rounded bottom composer, and responsive mobile layout.
- Focused navigation for New Chat, saved chat sessions, chat archiving, agent status, theme switching, text file uploads, and message sending.
- Separate chat sessions with New Chat behavior so conversations do not overlap.
- Non-destructive chat archiving with active chat lists hiding archived chats while admin chat review can still load all chats.
- Text file attachments in the composer, stored in sanitized message context and included in AI context for the current message.
- Automatic 40-second refresh for status, chat list, and active chat history when the user is not composing a message or attaching files.
- Persistent message storage with `chat_id`, `role`, `content`, sanitized `context`, review state, and timestamps.
- Optional PostgreSQL support through `DATABASE_URL`; the app uses storage-only in-memory mode when no database URL is configured.
- Storage-only chat behavior when `OPENAI_API_KEY` is missing, including a friendly pending-review assistant response.
- Durable knowledge entries produced by review runs as `pending_review` entries and reused in future AI context only after approval.
- Backend management area split into dedicated admin pages instead of one scrolling static dashboard:
  - `/chat.html` for chat review and selected-chat attachments.
  - `/knowledge.html` for the Knowledge base.
  - `/user.html` for User management, profile settings, and the Manage users action.
  - `/settings.html` for Settings, Review runs, and System health.
  - `/update-profile.html` for the current user's backend-backed profile photo, name, email, and password form.
  - `/login.html` for email/password login and post-logout redirects.
  - `/admin.html` redirects to `/chat.html` for backward compatibility.
- Real user login sessions are backed by `/api/auth/login`, `/api/auth/logout`, and `user_sessions` storage. Owner/admin sessions can access all `/api/admin/*` APIs; non-admin sessions can update only their own profile.
- Profile updates are saved through `/api/profile` instead of browser-local profile storage. Password changes require the current password before the backend updates the password hash.
- Admin navigation uses Back to chat, Chat, Knowledge base, User, and Settings. Admin logout is available from the top-header profile menu.
- Admin pages share the chat UI shell, theme tokens, fixed desktop sidebar, independently scrolling right panel, and reload-safe theme behavior.
- Admin Settings is organized into Preferences, Access and security, Review runs, System health, and Diagnostics sections with standardized `Ready`, `Loaded`, `Public view`, `Storage-only`, and `Error` status badges.
- Admin Settings includes a Light / Dark / System theme preference control. Explicit Light and Dark choices are restored after reload, while System follows the visitor's device preference.
- Admin top headers include a Mac-style current day/time display and a user profile menu with Update Profile and Logout actions.
- Logout clears browser-held auth tokens, calls backend session logout when a user session is present, and redirects to `/login.html`.
- Admin pages no longer expose visible token-entry, Login, or Run Review controls; protected backend admin routes accept either `ADMIN_TOKEN` or an active owner/admin user session.
- Protected user-management APIs and the `/user.html` admin UI support listing, searching, creating, editing, disabling, and reactivating users, plus recent user audit-event visibility when `ADMIN_TOKEN` or an active owner/admin user session is available.
- Knowledge base includes source-controlled project knowledge cards plus review-created backend knowledge when an admin session is available.
- Chat and knowledge search controls filter cached management data, keep selected chats highlighted, and show clear loading and error states during admin actions.
- Chat failure responses distinguish between saved messages awaiting review and storage failures that could not save the message.
- Agent Directory status indicator backed by the `/api/status` endpoint.
- Render health check support through `/health`.
- Chat keeps a compact light/dark toggle in the header, and admin Settings uses the clearer Light / Dark / System control.
- Explicit Light and Dark theme choices are stored in browser `localStorage` under `switchboard-theme`; the Settings theme mode is stored under `switchboard-theme-mode`. Choosing System clears the explicit theme so reloads follow `prefers-color-scheme`.

### Local development

From the `web/` directory:

1. Install dependencies with `npm install`.
2. Start the app with `npm start`.
3. Run backend integration and frontend contract tests with `npm test`.
4. Run full validation with `npm run check`.
5. Open the local server URL shown in the terminal.

`OPENAI_API_KEY` is optional. When it is missing, messages are still stored and the app returns a pending-review response. `OPENAI_MODEL` is optional and defaults to `gpt-4.1-mini`.

For persistent PostgreSQL storage, set `DATABASE_URL`. The server creates these tables automatically at startup when PostgreSQL is configured:

- `chats`
- `chat_messages`
- `users`
- `user_sessions`
- `user_audit_events`
- `knowledge_entries`
- `review_runs`

The `users`, `user_sessions`, and `user_audit_events` tables back login, profile updates, protected user-management CRUD APIs, and the `/user.html` admin UI. They provide account identity fields, role and status constraints, case-insensitive email uniqueness, password hash storage, session token hashes, login/profile timestamps, and audit-event relationships.

Existing PostgreSQL databases are updated additively with `chats.archived_at` and user-management/auth foundation tables so archived chats can be hidden without deleting chat history and account records can be stored without replacing existing chat data.

Without `DATABASE_URL`, the app starts in in-memory storage mode for local testing and storage-only operation.

### Environment variables

- `DATABASE_URL`: optional PostgreSQL connection string for persistent storage.
- `DATABASE_SSL`: optional. Set to `true` only when the PostgreSQL connection requires SSL.
- `OPENAI_API_KEY`: optional. Enables AI responses when present.
- `OPENAI_MODEL`: optional. Defaults to `gpt-4.1-mini`.
- `REVIEW_RUN_TOKEN`: optional. When set, `/api/reviews/run` requires the token through `x-review-token` or `Authorization: Bearer ...`.
- `ADMIN_TOKEN`: recommended for bootstrapping user records before an owner/admin account can log in; also remains supported as a compatibility path for `/api/admin/*` routes.
- `REVIEW_RUN_INTERVAL_MS`: optional. Enables the backend scheduled review runner when set to at least `60000`.

Do not commit secrets, API keys, deploy hooks, database URLs, passwords, session cookies, or Render credentials. Configure secrets only in Render environment variables or another approved secret store.

### API routes

- `GET /health`: Render-compatible health check.
- `GET /api/status`: returns directory, AI, and storage availability.
- `POST /api/chats`: creates a chat session.
- `GET /api/chats`: lists recent unarchived chat sessions.
- `GET /api/chats?includeArchived=true`: lists recent chat sessions including archived chats.
- `GET /api/chats/:chatId`: loads a chat and its message history.
- `POST /api/chats/:chatId/archive`: archives or unarchives a chat with `{ "archived": true }` or `{ "archived": false }`.
- `POST /api/chats/:chatId/messages`: stores a message for a chat.
- `POST /api/chat`: stores a user message and optional text attachments, attempts an AI response when available, stores the assistant response when possible, and returns a storage failure status if the user message could not be saved.
- `GET /api/knowledge?status=approved`: reads durable knowledge entries.
- `POST /api/reviews/run`: records a review run, reads unreviewed messages, creates pending-review knowledge entries, and marks messages reviewed.
- `POST /api/auth/login`: logs in an active user with email and password, returning a session token and public user record.
- `POST /api/auth/logout`: revokes the current user session when called with `x-session-token`.
- `GET /api/profile`: returns the current logged-in user's public profile. Requires `x-session-token`.
- `PATCH /api/profile`: updates the current user's name, email, photo URL, or password. Password changes require `currentPassword` and `newPassword`. Requires `x-session-token`.
- `GET /api/admin/summary`: returns backend management counts and runtime status. Requires `ADMIN_TOKEN` or an active owner/admin user session.
- `GET /api/admin/chats`: lists chats for management review. Requires `ADMIN_TOKEN` or an active owner/admin user session.
- `GET /api/admin/chats/:chatId`: loads a chat and messages for management review. Requires `ADMIN_TOKEN` or an active owner/admin user session.
- `GET /api/admin/knowledge?status=all`: lists knowledge entries. Requires `ADMIN_TOKEN` or an active owner/admin user session.
- `PATCH /api/admin/knowledge/:entryId`: updates knowledge entry status, title, or content. Requires `ADMIN_TOKEN` or an active owner/admin user session.
- `GET /api/admin/review-runs`: lists review run history. Requires `ADMIN_TOKEN` or an active owner/admin user session.
- `POST /api/admin/reviews/run`: manually triggers a review run. Requires `ADMIN_TOKEN` or an active owner/admin user session.
- `GET /api/admin/users`: lists user records. Requires `ADMIN_TOKEN` or an active owner/admin user session.
- `POST /api/admin/users`: creates a user record. Requires `ADMIN_TOKEN` or an active owner/admin user session.
- `GET /api/admin/users/:userId`: loads one user record. Requires `ADMIN_TOKEN` or an active owner/admin user session.
- `PATCH /api/admin/users/:userId`: updates profile fields, role, status, email, photo URL, or password. Requires `ADMIN_TOKEN` or an active owner/admin user session.
- `POST /api/admin/users/:userId/disable`: disables a user. Requires `ADMIN_TOKEN` or an active owner/admin user session.
- `POST /api/admin/users/:userId/reactivate`: reactivates a disabled user. Requires `ADMIN_TOKEN` or an active owner/admin user session.
- `GET /api/admin/user-audit-events`: lists recent user-management audit events. Supports `targetUserId`. Requires `ADMIN_TOKEN` or an active owner/admin user session.

### Scheduled review workflow

The review workflow is implemented as an idempotent backend route and optional backend interval runner:

1. Configure `REVIEW_RUN_TOKEN` in Render if the public review route should be protected.
2. Configure an external scheduler or Render cron-style service to call `POST /api/reviews/run`.
3. Or configure `REVIEW_RUN_INTERVAL_MS` to run reviews from the backend process at the chosen interval. Values below `60000` are ignored for safety.
4. The run reads unreviewed chat messages, writes durable `pending_review` `knowledge_entries`, marks messages reviewed, and records the result in `review_runs`.
5. An admin can approve or archive knowledge entries from `/knowledge.html`.
6. Future AI responses include approved knowledge entries as additional Switchboard context.

### Test coverage

`npm test` runs focused backend integration tests against the Express app in in-memory storage mode and frontend contract tests against the admin page markup. The tests cover:

- `/health` and `/api/status`.
- Chat creation, message storage, sanitized context, and chat history loading.
- `/api/chat` storage-only fallback when `OPENAI_API_KEY` is missing.
- Chat archiving, hidden archived chats, and archived-chat write protection.
- Text attachment storage and attachment secret redaction.
- Protected review routes and review token enforcement.
- Protected admin routes and admin token enforcement.
- Review-run creation of pending knowledge entries.
- Admin approval of knowledge entries and approved knowledge retrieval.
- Protected user-management routes, user creation/listing/loading/updating, duplicate email handling, disable/reactivate actions, and audit-event creation.
- Real auth/profile behavior: failed and successful login, session profile reads, backend-backed profile updates, current-password verification for password changes, session-backed owner/admin access to all `/api/admin/*` routes, logout revocation, non-admin rejection from admin APIs, and new-password login.
- User page controls for search, create/edit fields, role/status selection, password entry, audit events, and backend API wiring.
- Admin navigation routes, page ownership for Chat, Knowledge base, User, Settings, nested Attachments, nested Review runs, nested System health, Settings section structure, standardized Settings status badges, Settings Light / Dark / System theme preference markup, persistence keys, reload restore behavior, System-mode handling, the profile dropdown, Update Profile form, Logout redirect, profile-menu-only admin logout, and the Mac-style clock wiring.

## GitHub Actions / auto-deploy

The `Web checks` workflow runs on pull requests targeting `main` and on pushes to `main`. It installs the `web/` dependencies and runs `npm run check`, which performs JavaScript syntax validation and backend integration tests in GitHub even when a local agent environment cannot clone the repository directly.

Render deployment should happen through GitHub-based auto-deploy from `main`. Do not request, store, or use Render login credentials. If a Render build fails, use the Render build logs to diagnose and fix repository code through GitHub.

## Documentation Maintenance Rule

Whenever making any repository change, check whether README.md needs to be updated. If a change affects app behavior, setup steps, deployment, environment variables, UI, backend routes, agent behavior, routing rules, GitHub Actions, Render deployment, or repository structure, update README.md in the same commit so the documentation stays current.

README.md must be updated for new features, UI changes, backend or API changes, new routes or endpoints, environment variable changes, Render deployment changes, GitHub Actions changes, Agent Directory changes, routing rule changes, memory rule changes, handoff template changes, file or folder structure changes, bug fixes that affect user behavior, and setup or installation changes. README.md does not need to be updated for pure formatting changes that do not affect behavior, typo fixes outside user-facing documentation, or internal refactors that do not change usage, setup, or behavior. If README.md is not updated, the work summary must explicitly say: "README.md update not needed because this change does not affect setup, behavior, or user-facing documentation."

When README.md is updated, include whichever sections are relevant: Overview, Features, Project structure, Local development, Render deployment, Environment variables, API routes, Agent behavior, GitHub Actions / auto-deploy, and Change notes. Also update change-log.md whenever the change is meaningful.

Before committing future work, use this checklist:

1. Did I change app behavior, setup, deployment, agent rules, UI, API, or project structure?
2. If yes, did I update README.md?
3. If the change is meaningful, did I update change-log.md?
4. Did I avoid committing secrets?
5. Did I keep Render deploy hooks, API keys, and credentials out of the repository?
6. Did I commit all related changes together?

## Files

- [agent-directory.md](agent-directory.md) - overview of the available agent roles and responsibilities.
- [routing-rules.md](routing-rules.md) - rules for directing work and requests.
- [memory-rules.md](memory-rules.md) - guidelines for persistent notes and context.
- [handoff-template.md](handoff-template.md) - reusable handoff format for transferring tasks.
- [change-log.md](change-log.md) - record of repository changes.

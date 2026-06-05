# elite-repo

This repository contains the core project documentation for agent coordination, routing, memory handling, handoffs, and the Switchboard Agent web app.

## Purpose

Use this repository as the central reference for structured collaboration and task management.

## Web app

The `web/` directory contains a Render-ready Express app that serves a plain HTML, CSS, and JavaScript messaging interface for the Switchboard Agent.

### Features

- Chat interface backed by the `/api/chat` endpoint.
- ChatGPT-inspired full-height chat UI with a dark sidebar, centered conversation stream, rounded bottom composer, and responsive mobile layout.
- Separate chat sessions with New Chat behavior so conversations do not overlap.
- Automatic 40-second refresh for status, chat list, and active chat history when the user is not composing a message.
- Persistent message storage with `chat_id`, `role`, `content`, sanitized `context`, review state, and timestamps.
- Optional PostgreSQL support through `DATABASE_URL`; the app uses storage-only in-memory mode when no database URL is configured.
- Storage-only chat behavior when `OPENAI_API_KEY` is missing, including a friendly pending-review assistant response.
- Durable knowledge entries produced by review runs as `pending_review` entries and reused in future AI context only after approval.
- Backend management dashboard at `/admin.html` for inspecting chats, searching chat and knowledge lists, reviewing knowledge entries, running reviews, and checking review history.
- Chat failure responses distinguish between saved messages awaiting review and storage failures that could not save the message.
- Agent Directory status indicator backed by the `/api/status` endpoint.
- Render health check support through `/health`.
- Light and dark mode toggle in the chat header.
- Theme preference stored in browser `localStorage` under `switchboard-theme`; if no preference exists, the app uses the visitor's `prefers-color-scheme` system setting.

### Local development

From the `web/` directory:

1. Install dependencies with `npm install`.
2. Start the app with `npm start`.
3. Run validation with `npm run check`.
4. Open the local server URL shown in the terminal.

`OPENAI_API_KEY` is optional. When it is missing, messages are still stored and the app returns a pending-review response. `OPENAI_MODEL` is optional and defaults to `gpt-4.1-mini`.

For persistent PostgreSQL storage, set `DATABASE_URL`. The server creates these tables automatically at startup when PostgreSQL is configured:

- `chats`
- `chat_messages`
- `knowledge_entries`
- `review_runs`

Without `DATABASE_URL`, the app starts in in-memory storage mode for local testing and storage-only operation.

### Environment variables

- `DATABASE_URL`: optional PostgreSQL connection string for persistent storage.
- `DATABASE_SSL`: optional. Set to `true` only when the PostgreSQL connection requires SSL.
- `OPENAI_API_KEY`: optional. Enables AI responses when present.
- `OPENAI_MODEL`: optional. Defaults to `gpt-4.1-mini`.
- `REVIEW_RUN_TOKEN`: optional. When set, `/api/reviews/run` requires the token through `x-review-token` or `Authorization: Bearer ...`.
- `ADMIN_TOKEN`: required for the backend management dashboard and `/api/admin/*` routes.
- `REVIEW_RUN_INTERVAL_MS`: optional. Enables the backend scheduled review runner when set to at least `60000`.

Do not commit secrets, API keys, deploy hooks, database URLs, passwords, session cookies, or Render credentials. Configure secrets only in Render environment variables or another approved secret store.

### Admin dashboard deployment checklist

Use GitHub as the deployment source of truth and let Render auto-deploy from the approved branch.

1. Confirm Render is watching the repository deployment branch, usually `main`.
2. Confirm the service root directory is `web/`.
3. Confirm the build command installs dependencies for `web/`.
4. Confirm the start command is `npm start` from `web/`.
5. Confirm the service uses Render's `PORT` environment variable; `server.js` already listens on `process.env.PORT`.
6. Confirm `/health` returns a healthy response after deployment.
7. Confirm `/admin.html` loads and that all `/api/admin/*` data requests require `ADMIN_TOKEN`.
8. Confirm only environment variable names are documented in GitHub; secret values stay in Render or another approved secret store.

### Database deployment checklist

The current database layer is intentionally small and additive. PostgreSQL is enabled by configuring `DATABASE_URL` in Render.

1. Create or attach a PostgreSQL database for the Render service.
2. Set `DATABASE_URL` in Render. Do not paste or commit the value into this repository.
3. Set `DATABASE_SSL=true` only when the database provider requires SSL.
4. Deploy the app. On startup, the server reads `web/db/schema.sql` and creates missing tables with `CREATE TABLE IF NOT EXISTS`.
5. Confirm admin summary counts load from `/api/admin/summary` after entering `ADMIN_TOKEN` on `/admin.html`.
6. Confirm chat creation writes to `chats` and `chat_messages`.
7. Confirm review runs write to `review_runs` and create `pending_review` rows in `knowledge_entries`.
8. Treat future user-account work as a separate access-control migration, adding tables such as `users`, `roles`, `sessions`, and `audit_logs` only after the login model is chosen.

### API routes

- `GET /health`: Render-compatible health check.
- `GET /api/status`: returns directory, AI, and storage availability.
- `POST /api/chats`: creates a chat session.
- `GET /api/chats`: lists recent chat sessions.
- `GET /api/chats/:chatId`: loads a chat and its message history.
- `POST /api/chats/:chatId/messages`: stores a message for a chat.
- `POST /api/chat`: stores a user message, attempts an AI response when available, stores the assistant response when possible, and returns a storage failure status if the user message could not be saved.
- `GET /api/knowledge?status=approved`: reads durable knowledge entries.
- `POST /api/reviews/run`: records a review run, reads unreviewed messages, creates pending-review knowledge entries, and marks messages reviewed.
- `GET /api/admin/summary`: returns backend management counts and runtime status. Requires `ADMIN_TOKEN`.
- `GET /api/admin/chats`: lists chats for management review. Requires `ADMIN_TOKEN`.
- `GET /api/admin/chats/:chatId`: loads a chat and messages for management review. Requires `ADMIN_TOKEN`.
- `GET /api/admin/knowledge?status=all`: lists knowledge entries. Requires `ADMIN_TOKEN`.
- `PATCH /api/admin/knowledge/:entryId`: updates knowledge entry status, title, or content. Requires `ADMIN_TOKEN`.
- `GET /api/admin/review-runs`: lists review run history. Requires `ADMIN_TOKEN`.
- `POST /api/admin/reviews/run`: manually triggers a review run. Requires `ADMIN_TOKEN`.

### Scheduled review workflow

The review workflow is implemented as an idempotent backend route and optional backend interval runner:

1. Configure `REVIEW_RUN_TOKEN` in Render if the public review route should be protected.
2. Configure an external scheduler or Render cron-style service to call `POST /api/reviews/run`.
3. Or configure `REVIEW_RUN_INTERVAL_MS` to run reviews from the backend process at the chosen interval. Values below `60000` are ignored for safety.
4. The run reads unreviewed chat messages, writes durable `pending_review` `knowledge_entries`, marks messages reviewed, and records the result in `review_runs`.
5. An admin can approve or archive knowledge entries from `/admin.html`.
6. Future AI responses include approved knowledge entries as additional Switchboard context.

## GitHub Actions / auto-deploy

The `Web checks` workflow runs on pull requests targeting `main` and on pushes to `main`. It installs the `web/` dependencies and runs `npm run check` so JavaScript syntax validation happens in GitHub even when a local agent environment cannot clone the repository directly.

Render deployment should happen through GitHub-based auto-deploy from `main`. Do not request, store, or use Render login credentials. If a Render build fails, use the Render build logs to diagnose and fix repository code through GitHub.

## Documentation Maintenance Rule

Whenever making any repository change, check whether README.md needs to be updated. If a change affects app behavior, setup steps, deployment, environment variables, UI, backend routes, agent behavior, routing rules, GitHub Actions, Render deployment, or repository structure, update README.md in the same commit so the documentation stays current.

README.md must be updated for new features, UI changes, backend or API changes, new routes or endpoints, environment variable changes, Render deployment changes, GitHub Actions changes, Agent Directory changes, routing rule changes, memory rule changes, handoff template changes, file or folder structure changes, bug fixes that affect user behavior, and setup or installation changes.

README.md does not need to be updated for pure formatting changes that do not affect behavior, typo fixes outside user-facing documentation, or internal refactors that do not change usage, setup, or behavior. If README.md is not updated, the work summary must explicitly say: "README.md update not needed because this change does not affect setup, behavior, or user-facing documentation."

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

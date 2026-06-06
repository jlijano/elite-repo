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
- Backend management dashboard at `/admin.html` for inspecting chats, reviewing knowledge entries, and checking review history.
- Admin dashboard styling shares the chat UI shell, theme tokens, and persistent light/dark mode behavior for a consistent management experience.
- Admin dashboard navigation uses clarified sections for Chat Review, Admin Access, Chat Attachments, Knowledge, Review Logs, File Library, Settings, and Logout.
- Admin dashboard highlights the active navigation section and presents Switchboard Admin as the current workspace rather than as a generic tool.
- Admin dashboard includes a Settings section for application-wide preferences, including theme control, refresh cadence, dashboard customization status, and protected admin-data state.
- Admin dashboard keeps the left sidebar fixed on desktop while the right dashboard panel scrolls independently so lower sections remain reachable.
- Admin dashboard keeps the Chat Review and Chat Detail cards hidden until the Chat review navigation item is selected.
- Admin dashboard no longer exposes visible token-entry, Login, or Run Review controls; Chat Review loads recent chats into the highlighted review section, while protected backend admin routes still require `ADMIN_TOKEN` for management-only data.
- Admin dashboard Knowledge includes source-controlled project knowledge cards from the current build conversation, plus review-created backend knowledge when an admin session is available.
- Admin dashboard chat and knowledge search controls filter cached management data, keep selected chats highlighted, and show clear loading and error states during admin actions.
- Admin Access and File Library sections currently show honest status placeholders until dedicated backend endpoints are added.
- Chat failure responses distinguish between saved messages awaiting review and storage failures that could not save the message.
- Agent Directory status indicator backed by the `/api/status` endpoint.
- Render health check support through `/health`.
- Light and dark mode toggle in the chat header.
- Theme preference stored in browser `localStorage` under `switchboard-theme`; if no preference exists, the app uses the visitor's `prefers-color-scheme` system setting.

### Local development

From the `web/` directory:

1. Install dependencies with `npm install`.
2. Start the app with `npm start`.
3. Run backend integration tests with `npm test`.
4. Run full validation with `npm run check`.
5. Open the local server URL shown in the terminal.

`OPENAI_API_KEY` is optional. When it is missing, messages are still stored and the app returns a pending-review response. `OPENAI_MODEL` is optional and defaults to `gpt-4.1-mini`.

For persistent PostgreSQL storage, set `DATABASE_URL`. The server creates these tables automatically at startup when PostgreSQL is configured:

- `chats`
- `chat_messages`
- `knowledge_entries`
- `review_runs`

Existing PostgreSQL databases are updated additively with `chats.archived_at` so archived chats can be hidden without deleting chat history.

Without `DATABASE_URL`, the app starts in in-memory storage mode for local testing and storage-only operation.

### Environment variables

- `DATABASE_URL`: optional PostgreSQL connection string for persistent storage.
- `DATABASE_SSL`: optional. Set to `true` only when the PostgreSQL connection requires SSL.
- `OPENAI_API_KEY`: optional. Enables AI responses when present.
- `OPENAI_MODEL`: optional. Defaults to `gpt-4.1-mini`.
- `REVIEW_RUN_TOKEN`: optional. When set, `/api/reviews/run` requires the token through `x-review-token` or `Authorization: Bearer ...`.
- `ADMIN_TOKEN`: required for protected backend management data and `/api/admin/*` routes.
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

### Test coverage

`npm test` runs focused backend integration tests against the Express app in in-memory storage mode. The tests cover:

- `/health` and `/api/status`.
- Chat creation, message storage, sanitized context, and chat history loading.
- `/api/chat` storage-only fallback when `OPENAI_API_KEY` is missing.
- Chat archiving, hidden archived chats, and archived-chat write protection.
- Text attachment storage and attachment secret redaction.
- Protected review routes and review token enforcement.
- Protected admin routes and admin token enforcement.
- Review-run creation of pending knowledge entries.
- Admin approval of knowledge entries and approved knowledge retrieval.

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
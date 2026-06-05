# elite-repo

This repository contains the core project documentation for agent coordination, routing, memory handling, handoffs, and the Switchboard Agent web app.

## Purpose

Use this repository as the central reference for structured collaboration and task management.

## Web app

The `web/` directory contains a Render-ready Express app that serves a plain HTML, CSS, and JavaScript messaging interface for the Switchboard Agent.

### Features

- Chat interface backed by the `/api/chat` endpoint.
- Separate chat sessions with New Chat behavior so conversations do not overlap.
- Persistent message storage with `chat_id`, `role`, `content`, sanitized `context`, review state, and timestamps.
- Optional PostgreSQL support through `DATABASE_URL`; the app uses storage-only in-memory mode when no database URL is configured.
- Storage-only chat behavior when `OPENAI_API_KEY` is missing, including a friendly pending-review assistant response.
- Durable knowledge entries produced by review runs and reused in future AI context when approved.
- Transactional PostgreSQL review runs so knowledge entries and reviewed message flags stay consistent if a review fails.
- Chat failure responses distinguish between saved messages awaiting review and storage failures that could not save the message.
- Agent Directory status indicator backed by the `/api/status` endpoint.
- Render health check support through `/health`.
- Responsive mobile layout with small-screen chat header wrapping, full-height mobile viewport support, safe-area spacing, compact composer controls, and mobile New Chat access.
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

Do not commit secrets, API keys, deploy hooks, database URLs, passwords, session cookies, or Render credentials. Configure secrets only in Render environment variables or another approved secret store.

### API routes

- `GET /health`: Render-compatible health check.
- `GET /api/status`: returns directory, AI, and storage availability.
- `POST /api/chats`: creates a chat session.
- `GET /api/chats`: lists recent chat sessions.
- `GET /api/chats/:chatId`: loads a chat and its message history.
- `POST /api/chats/:chatId/messages`: stores a message for a chat.
- `POST /api/chat`: stores a user message, attempts an AI response when available, stores the assistant response when possible, and returns a storage failure status if the user message could not be saved.
- `GET /api/knowledge?status=approved`: reads durable knowledge entries.
- `POST /api/reviews/run`: records a review run, reads unreviewed messages, creates approved knowledge entries, and marks messages reviewed transactionally when PostgreSQL is configured.

### Scheduled review workflow

The review workflow is implemented as an idempotent backend route that can be called by a scheduler:

1. Configure `REVIEW_RUN_TOKEN` in Render if the route should be protected.
2. Configure an external scheduler or Render cron-style service to call `POST /api/reviews/run`.
3. The run reads unreviewed chat messages, writes durable approved `knowledge_entries`, marks messages reviewed, and records the result in `review_runs`.
4. Future AI responses include approved knowledge entries as additional Switchboard context.

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

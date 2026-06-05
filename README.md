# elite-repo

This repository contains the core project documentation for agent coordination, routing, memory handling, and handoffs.

## Purpose

Use this repository as the central reference for structured collaboration and task management.

## Web app

The `web/` directory contains a Render-ready Express app that serves a plain HTML, CSS, and JavaScript messaging interface for the Switchboard Agent.

### Features

- Chat interface backed by the `/api/chat` endpoint.
- Agent Directory status indicator backed by the `/api/status` endpoint.
- Light and dark mode toggle in the chat header.
- Theme preference stored in browser `localStorage` under `switchboard-theme`; if no preference exists, the app uses the visitor's `prefers-color-scheme` system setting.

### Local development

From the `web/` directory:

1. Install dependencies with `npm install`.
2. Start the app with `npm start`.
3. Open the local server URL shown in the terminal.

The chat endpoint requires `OPENAI_API_KEY` in the environment. `OPENAI_MODEL` is optional and defaults to `gpt-4.1-mini`.

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

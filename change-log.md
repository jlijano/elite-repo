# Change Log

## [Unreleased]

- Fixed the chat UI so the active chat title refreshes after the first user message renames a new chat.
- Hardened `/api/chat` fallback responses so storage failures no longer claim an unsaved message was saved for review.
- Made PostgreSQL review runs transactional so knowledge entry creation and message review flags cannot drift apart on partial failure.
- Added PostgreSQL-backed Switchboard chat storage with `chats`, `chat_messages`, `knowledge_entries`, and `review_runs` tables.
- Added separate chat sessions, New Chat behavior, timestamped messages, chat history loading, knowledge reading, and review run API routes.
- Changed chat behavior so missing `OPENAI_API_KEY` no longer blocks message storage and returns a friendly pending-review response.
- Added a review workflow endpoint that creates durable approved knowledge entries from unreviewed chats and marks messages reviewed.
- Added secret redaction safeguards for stored message content and context.
- Improved frontend and backend error handling and status reporting for AI and storage availability.
- Improved the Switchboard Agent web app CSS for mobile screens with safer viewport sizing, responsive header actions, safe-area spacing, and compact composer controls.
- Added a web validation script and GitHub Actions workflow for pull request checks.
- Added a persistent light/dark mode toggle to the Switchboard Agent web app.
- Added a README maintenance rule requiring README.md and meaningful change-log.md updates for future repository changes that affect setup, behavior, deployment, agent rules, UI, API, workflows, or project structure.
- Created the initial repository structure and documentation files.
- Added starter content for README, agent directory, routing rules, memory rules, and handoff template.

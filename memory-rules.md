# Memory Rules

## Guidelines

- Keep memory entries short, specific, and reusable.
- Record only information that supports future task execution.
- Separate user preferences, session notes, and repository facts when relevant.
- Treat durable user preferences as reusable working context, not as a transcript or task log.
- Do not store secrets, passwords, API keys, session cookies, deploy hooks, 2FA codes, recovery codes, private tokens, or speculative assumptions.

## Recommended Usage

- User memory: long-lived preferences and patterns.
- Session memory: current task context and temporary notes.
- Repository memory: project-specific conventions and verified practices.
- Routing memory: stable routing preferences, escalation rules, and active-agent constraints that help Switchboard classify future requests.

## Durable Working Preferences

- Prefer GitHub-based repository work for app, dashboard, database, deployment, and code changes.
- For `elite-repo`, avoid pull requests by default because the user is the only developer.
- For `elite-repo`, push approved changes directly to `main` unless the user asks for a pull request.
- For development updates, include the immediate next step so the work sequence stays clear.
- When deployment is involved, prefer GitHub auto-deploy workflows and let Render rebuild from GitHub.
- Do not request Render credentials, deploy hooks, API keys, passwords, session cookies, 2FA material, or other secrets.
- For requests touching code, repositories, deployment, CI, documents, spreadsheets, or review work, identify the narrowest correct specialist workflow before acting.
- For ambiguous routing or high-risk work, ask one concise clarification question that determines the next step.

## Repository Knowledge

- `agent-directory.md` is the source of truth for official Active agents and routing rules.
- Do not claim an agent, skill, tool, connector, or workflow is available unless it is marked `Status: Active` in `agent-directory.md`.
- Treat Planned, Missing, Recommended, Draft, and Retired agents as unavailable until the Agent Directory marks them Active.
- High-risk legal, compliance, privacy, security, HR, medical, financial, destructive, or production-impacting requests should route to the appropriate Active review specialist or qualified human reviewer.
- Legal and compliance responses should identify issues and escalation needs, not provide final legal advice or final compliance approval.

## Review

Review stored notes regularly to remove outdated or duplicate information. Replace stale guidance instead of appending conflicting notes.

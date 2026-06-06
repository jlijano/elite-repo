# Bootstrap Account Policy

The database schema creates and updates account tables, indexes, and constraints only. It does not automatically seed default user records during PostgreSQL startup.

Optional bootstrap/demo users live in `web/db/seed-bootstrap-users.sql`. Run that seed file only for an intentional bootstrap or demo setup, and only after confirming the environment should receive those accounts.

These accounts are intended for bootstrap and demo use only. They should not be treated as permanent production credentials.

## Production Rules

- Do not run `web/db/seed-bootstrap-users.sql` in production unless there is a documented bootstrap need.
- Rotate passwords for any seeded account before production use.
- Disable or remove seeded accounts that are not needed after the first owner/admin account is configured.
- Prefer creating named owner/admin users through the protected user-management UI or API.
- Do not commit real passwords, API keys, deploy hooks, database URLs, session cookies, or other secrets to the repository.
- Keep `ADMIN_TOKEN` as a temporary bootstrap compatibility path only, configured through the deployment environment and never displayed in frontend UI.

## Hardening Status

1. Schema creation and bootstrap user seeding are split into separate SQL files.
2. Production startup does not silently create usable default accounts.
3. Regression tests should protect this split by checking that `web/db/schema.sql` has no `INSERT INTO users` seed block and that the optional seed file remains explicit.
4. A future must-change-password flow can further harden any bootstrap account that remains enabled.

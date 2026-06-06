# Bootstrap Account Policy

The database schema currently seeds a small set of default user records when PostgreSQL storage is initialized and those email addresses do not already exist.

These accounts are intended for bootstrap and demo use only. They should not be treated as permanent production credentials.

## Production Rules

- Rotate passwords for any seeded account before production use.
- Disable or remove seeded accounts that are not needed after the first owner/admin account is configured.
- Prefer creating named owner/admin users through the protected user-management UI or API.
- Do not commit real passwords, API keys, deploy hooks, database URLs, session cookies, or other secrets to the repository.
- Keep `ADMIN_TOKEN` as a temporary bootstrap compatibility path only, configured through the deployment environment and never displayed in frontend UI.

## Future Hardening Plan

1. Split schema creation from user seeding so migrations and demo data have separate responsibilities.
2. Gate default-user seeding behind an explicit environment flag or separate seed command.
3. Add a must-change-password flow for any bootstrap account that remains enabled.
4. Add tests that confirm production startup does not silently create usable default accounts unless explicitly requested.

# Bug Fix Automation Backlog

## Completed in this pass

### Switchboard Sidebar Navigation

Status: Completed

Scope:
- Treat `Switchboard` as the sidebar brand/app label instead of a navigation module.
- Convert `Back to chat` to an icon-only back-arrow action with accessible labels.
- Normalize `Chat` and `Knowledge base` as independent top-level links.
- Normalize `ENTRA`, `PLAYGROUND`, `Settings`, and `REPORTS` as expandable top-level modules.
- Move `Builder` under the `Settings` module.
- Preserve active child route styling by expanding and highlighting the parent module.
- Keep the mobile admin menu aligned with the same hierarchy.

Verification recorded:
- JavaScript syntax checks passed for the touched sidebar helpers.
- Static sidebar regression checks passed for brand behavior, back accessibility, module hierarchy, Builder placement, dropdown nesting, active parent expansion, mobile menu rebuilding, and the old Playground placeholder blocker.

## Queued separately

### Users Module Fix Plan

Status: Backlog - run separately

Instruction:
Preserve the attached Users Module fix plan as part of the broader bug-fix automation backlog. Do not run it inside the sidebar navigation pass. When assigned, run it in its own step-by-step sequence with the same complete-then-verify discipline used for the sidebar work.

Notes:
- The sidebar pass only moved the existing `Users` navigation entry under the `ENTRA` module to match the requested sidebar hierarchy.
- No Users Module behavior, data model, modal flow, table behavior, audit behavior, or backend logic was changed in this pass.

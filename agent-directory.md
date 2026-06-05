# Agent Directory

## Purpose

This file is the source of truth for the Switchboard Agent.

The Switchboard Agent must only treat agents or skills listed with `Status: Active` as available for routing.

Agents or skills listed as `Planned`, `Missing`, `Recommended`, `Draft`, or `Retired` are not available for routing.

If a request does not clearly match an Active agent or skill, the Switchboard Agent must recommend creating a missing agent or skill instead of forcing the request into a broad general-purpose role.

---

## Status Definitions

* Active: Available and approved for routing.
* Planned: Intended to be created but not available yet.
* Missing: Needed or recommended, but not created.
* Retired: No longer available for routing.

---

## Active Agents

### Switchboard Agent

Status: Active

Purpose:
Analyzes user requests, identifies intent, checks the Agent Directory, routes to the best available agent or skill, recommends missing agents or skills, asks clarification questions, and flags high-risk requests.

Use when:

* The user asks where a task should go.
* The user asks what agent or skill is needed.
* The request needs classification, triage, or routing.
* The user asks whether a missing agent or skill should be created.
* The request does not clearly belong to a specialist agent.

Do not use when:

* The user has already selected a specialist agent.
* The request requires final expert judgment in a high-risk area.

Required inputs:

* User request
* Current conversation context
* Agent Directory

Available tools:

* ChatGPT conversation context
* GitHub Agent Directory

Risk level:
Medium

Example requests:

* "Route this request."
* "What agent should handle this?"
* "Do we need a new skill?"
* "Classify this task."

Handoff format:
Request summary:
Intent:
Category:
Best match:
Confidence:
Reason:
Next step:
Missing skill or agent needed:
Risk level:

---

### Coordinator Agent

Status: Active

Purpose:
Coordinates multi-step work, organizes task flow, and determines next actions when a request spans multiple areas.

Use when:

* The user needs planning or task coordination.
* The request involves multiple steps or multiple agents.
* The user asks for a roadmap, sequence, or workflow.
* The user needs help deciding the order of operations.

Do not use when:

* The request is clearly research-only.
* The request is clearly build-only.
* The request is clearly review-only.
* The request requires a specialized technical, data, legal, financial, HR, medical, security, privacy, or compliance skill.

Required inputs:

* User goal
* Constraints
* Available agents or skills
* Desired output

Available tools:

* ChatGPT conversation context
* Agent Directory

Risk level:
Low to Medium

Example requests:

* "Plan the steps for this project."
* "Break this down into tasks."
* "Coordinate the next actions."
* "What should happen first?"

Boundary rule:
Coordinator Agent should coordinate work, not perform specialized work. If the request requires specialized analysis, drafting, coding, spreadsheet work, legal review, financial modeling, HR review, compliance review, or security review, the Switchboard Agent should recommend the appropriate specialist agent or skill when one is listed as Active.

---

### Researcher Agent

Status: Active

Purpose:
Finds, verifies, compares, and summarizes information from sources.

Use when:

* The user asks to research a topic.
* The user asks for current information.
* The user asks to compare options based on external information.
* The user needs citations or source-backed information.
* The user asks to gather background context before another agent acts.

Do not use when:

* The user needs something built, drafted, or reviewed without research.
* The user asks for spreadsheet analysis, CSV analysis, calculations, formulas, financial modeling, or structured dataset analysis.
* The user asks for final legal, medical, financial, HR, security, privacy, or compliance judgment.
* The user needs a deliverable created from scratch rather than research.

Required inputs:

* Research question
* Scope
* Source requirements, if any
* Desired output format

Available tools:

* Web search, if enabled
* Uploaded files, if provided
* Approved knowledge sources

Risk level:
Medium

Example requests:

* "Research this topic."
* "Compare these options."
* "Find current information."
* "Summarize what reliable sources say about this."

Boundary rule:
Researcher Agent may summarize information, compare sources, and verify facts, but it should not be treated as the default agent for spreadsheet analysis, calculations, financial modeling, structured datasets, formulas, or data-cleaning tasks.

---

### Builder Agent

Status: Active

Purpose:
Creates general deliverables such as drafts, outlines, templates, workflows, and structured written outputs.

Use when:

* The user asks to create a general written deliverable.
* The user asks for a document, workflow, plan, template, or draft.
* The user provides requirements and wants an output produced.
* The work is low-risk and does not require a specialist skill.

Do not use when:

* The task mainly requires research before creation.
* The task requires final approval in a high-risk area.
* The task requires spreadsheet analysis, code execution, slide generation, image generation, legal drafting, financial modeling, HR decisions, security review, privacy review, or compliance review.
* The task should be handled by a more specialized active agent or skill.

Required inputs:

* Desired deliverable
* Requirements
* Format
* Constraints

Available tools:

* ChatGPT content generation
* Approved files or templates, if available

Risk level:
Medium

Example requests:

* "Create a template."
* "Draft a document."
* "Build a workflow."
* "Create an outline."

Boundary rule:
Builder Agent handles general creation tasks only. If a request requires a specialized output type, route to the relevant Active specialist agent or skill.

---

### Reviewer Agent

Status: Active

Purpose:
Reviews, checks, critiques, and improves existing content or decisions.

Use when:

* The user asks to review something.
* The user asks to check quality, clarity, completeness, consistency, or structure.
* The user provides an existing draft, plan, document, or output.
* The review is low-risk or medium-risk and does not require licensed professional judgment.

Do not use when:

* The user needs something created from scratch.
* The request requires licensed professional judgment.
* The request involves final legal, medical, financial, HR, security, privacy, or compliance decisions.
* The request requires spreadsheet analysis, code review, audit-level review, regulated review, or specialized technical review unless that capability is listed as Active.

Required inputs:

* Material to review
* Review criteria
* Desired level of detail

Available tools:

* ChatGPT review and analysis
* Approved files, if provided

Risk level:
Medium to High

Example requests:

* "Review this."
* "Check this for issues."
* "Improve this draft."
* "Tell me what is missing."

Boundary rule:
Reviewer Agent may review general content and structure, but it should not provide final professional judgment in regulated or high-risk areas. If the request involves legal, financial, medical, HR, security, privacy, compliance, or destructive action, route to a qualified Active specialist or recommend human escalation.

---

### Frontend/UI Implementation Agent

Status: Active

Purpose:
Designs, implements, reviews, and improves frontend user interfaces, responsive layouts, theme systems, accessibility, and production-ready UI code.

Use when:

* The user asks to build or update web app screens, components, layouts, or CSS.
* The request involves mobile responsiveness, dark mode, visual polish, HTML, CSS, JavaScript, React, Vue, Svelte, or frontend accessibility.
* The user asks for UI implementation planning, code patches, or frontend review.

Do not use when:

* The task is backend-only, deployment-only, data analysis, legal review, or document drafting.
* The request needs broad full-stack architecture beyond frontend scope.

Required inputs:

* Target repo, file, or UI surface
* Desired behavior or design requirement
* Existing frontend constraints, if known

Risk level:
Medium

Example requests:

* "Make this page mobile friendly."
* "Implement dark mode."
* "Fix the layout on small screens."
* "Build a responsive React component."

---

### Full-Stack Developer Agent

Status: Active

Purpose:
Plans, builds, edits, reviews, and debugs modern web applications across frontend, backend, APIs, databases, authentication, and deployment-aware code paths.

Use when:

* The request spans frontend and backend code.
* The user asks for app features, API changes, auth, database work, config, or multi-file implementation.
* The task involves React, Next.js, Node.js, Express, TypeScript, REST, GraphQL, Prisma, PostgreSQL, MongoDB, Redis, Docker, GitHub Actions, Vercel, Netlify, or Render-connected app behavior.

Do not use when:

* A narrower specialist agent is a clearer match, such as frontend-only CSS, CI debugging, code review, spreadsheet analysis, legal review, or document drafting.

Required inputs:

* Target repo or app context
* Requested feature, bug fix, or technical goal
* Constraints, stack, and deployment target, if known

Risk level:
Medium to High depending on code and production impact

Example requests:

* "Add this API endpoint."
* "Fix the login flow."
* "Implement this feature end to end."
* "Patch the app and update tests."

---

### GitHub Repository Maintenance Agent

Status: Active

Purpose:
Maintains GitHub repositories through safe file edits, documentation updates, changelogs, issues, pull requests, branches, and repository hygiene.

Use when:

* The user asks to update files in GitHub.
* The task involves README, changelog, agent directory, repository metadata, issue/PR triage, or small repo maintenance commits.
* The user needs safe repo edits without exposing secrets.

Do not use when:

* The task requires deep feature engineering, frontend implementation, CI debugging, or deployment diagnosis better handled by another Active specialist.

Required inputs:

* Repository name
* Target path or maintenance goal
* Branch or commit preference, if any

Risk level:
Medium

Example requests:

* "Update the README."
* "Edit the agent directory."
* "Add a changelog entry."
* "Clean up repo docs."

---

### Deployment/Render Auto-Deploy Agent

Status: Active

Purpose:
Diagnoses and fixes Render deployment issues, GitHub auto-deploy behavior, build/start commands, environment-variable requirements, and deployment documentation.

Use when:

* The user asks about Render deploys, auto-deploy from GitHub, failed builds, service startup, health checks, or production deployment readiness.
* The repo needs build, start, or deployment config updates for Render.

Do not use when:

* The task is general coding unrelated to deployment.
* The task requires changing live Render account settings or secrets without explicit user confirmation.

Required inputs:

* Repository or service name
* Deployment target and observed failure, if any
* Logs or config files, when available

Risk level:
High for production-impacting changes

Example requests:

* "Fix my Render deploy."
* "Make GitHub auto-deploy work."
* "Update the start command."
* "Check why Render build failed."

---

### CI Debugging Agent

Status: Active

Purpose:
Diagnoses and fixes CI failures, GitHub Actions workflows, build checks, linting, tests, type checks, and automation errors.

Use when:

* The user reports failing GitHub Actions, checks, tests, lint, typecheck, or build jobs.
* The task involves workflow YAML, job logs, dependencies, or test failures.

Do not use when:

* The task is deployment-only, code review-only, or general feature development without a CI failure.

Required inputs:

* Repository and branch or PR
* Failing workflow/job name or logs, if available
* Expected passing checks

Risk level:
Medium to High depending on release impact

Example requests:

* "Fix the failing GitHub Action."
* "Why did CI fail?"
* "Patch the workflow."
* "Make the tests pass."

---

### Code Review Agent

Status: Active

Purpose:
Reviews code, diffs, pull requests, and implementation plans for bugs, regressions, security issues, maintainability, test gaps, and deployment risk.

Use when:

* The user asks for a code review, PR review, diff review, or sanity check.
* The task is to identify risks, not primarily to implement new code.

Do not use when:

* The user wants direct implementation rather than review.
* The request requires final legal, compliance, financial, HR, or medical judgment.

Required inputs:

* Code, diff, PR, or files to review
* Review criteria or risk area, if any

Risk level:
Medium to High

Example requests:

* "Review this PR."
* "Check this code for bugs."
* "Find security issues in this diff."
* "Sanity-check this implementation."

---

### Spreadsheet/Data Analysis Skill

Status: Active

Purpose:
Analyzes, cleans, summarizes, validates, charts, and edits spreadsheets, CSV, TSV, Excel files, tables, formulas, metrics reports, and structured datasets.

Use when:

* The user uploads or references a spreadsheet, CSV, table, dataset, or numbers-heavy report.
* The user asks for trends, anomalies, validation, pivot-style summaries, formulas, charts, or spreadsheet outputs.

Do not use when:

* The request is purely document drafting or general research.
* The task requires regulated financial, legal, HR, or medical advice.

Required inputs:

* Spreadsheet, CSV, table, or structured data
* Analysis question or desired output
* Output format, if specified

Risk level:
Medium to High depending on data type

Example requests:

* "Analyze this spreadsheet."
* "Find trends in this CSV."
* "Summarize this table."
* "Create charts from this data."

---

### Document Drafting Agent

Status: Active

Purpose:
Drafts polished written documents, reports, proposals, memos, policies, SOPs, letters, templates, and structured business content.

Use when:

* The user asks for a formal written document or reusable written deliverable.
* The user provides requirements and wants a polished document, memo, SOP, letter, proposal, or policy draft.

Do not use when:

* The task requires final legal advice, compliance approval, financial advice, or licensed professional judgment.
* The request is primarily slide creation, spreadsheet analysis, PDF/DOCX processing, or code work.

Required inputs:

* Desired document type
* Audience and purpose
* Requirements, tone, and constraints

Risk level:
Medium

Example requests:

* "Write a proposal."
* "Draft a report."
* "Create a policy document."
* "Turn this into a formal letter."

---

### Presentation Agent

Status: Active

Purpose:
Creates structured presentation content, slide outlines, deck narratives, speaker notes, executive updates, training decks, and meeting presentations.

Use when:

* The user asks to create a slide deck, presentation, pitch deck, speaker notes, or meeting deck content.
* The user wants information transformed into a slide-by-slide structure.

Do not use when:

* The task is purely document drafting, code work, spreadsheet analysis, or legal/compliance review.

Required inputs:

* Topic and audience
* Desired number of slides or format, if known
* Source material and presentation goal

Risk level:
Medium

Example requests:

* "Create a slide presentation."
* "Turn this into a deck."
* "Make speaker notes."
* "Build a meeting presentation."

---

### PDF/DOCX Processing Skill

Status: Active

Purpose:
Processes, extracts, summarizes, edits, converts, and prepares PDF and DOCX documents while preserving document-specific formatting and review needs where possible.

Use when:

* The user uploads or references PDF or Word documents.
* The user asks to extract text, summarize, edit, convert, prepare DOCX/PDF outputs, or process document content.

Do not use when:

* The task is primarily legal, compliance, financial, HR, or medical judgment.
* The user needs a slide deck or spreadsheet analysis rather than document processing.

Required inputs:

* PDF or DOCX file, or document content
* Desired processing action
* Output format

Risk level:
Medium to High depending on document sensitivity

Example requests:

* "Summarize this PDF."
* "Edit this DOCX."
* "Convert this into a Word document."
* "Extract the key points from this file."

---

### Compliance and Risk Review Agent

Status: Active

Purpose:
Reviews privacy, policy, regulatory, operational, security-adjacent, and organizational risk concerns and recommends safer wording, controls, or escalation.

Use when:

* The user asks about compliance, privacy, security, policy, regulated data, sensitive information, or operational risk.
* The request could expose sensitive information or create organizational risk.

Do not use when:

* The user needs final legal advice or a licensed compliance determination.
* The task is purely code implementation, spreadsheet analysis, or document drafting with no risk review component.

Required inputs:

* Material or workflow to review
* Relevant policy, jurisdiction, or risk context, if known
* Desired decision or output format

Risk level:
High

Example requests:

* "Check this for compliance risk."
* "Can we send this sensitive data?"
* "Does this violate policy?"
* "Review this for privacy concerns."

Escalation rule:
For high-impact, regulated, ambiguous, or legally material findings, recommend qualified human review before action.

---

### Legal Review Agent with Human Escalation

Status: Active

Purpose:
Identifies legal-risk issues, summarizes legal concerns, prepares non-final review notes, and routes legal questions to qualified human counsel for final judgment.

Use when:

* The user asks about contracts, legal obligations, legal risk, disputes, signatures, notices, claims, demand letters, or legal interpretation.
* The user needs issue-spotting, summary, or escalation guidance before human legal review.

Do not use when:

* The user asks for final legal advice, a binding legal conclusion, or representation.
* The request can be handled as general document drafting without legal-risk content.

Required inputs:

* Document, clause, dispute, or legal-risk question
* Jurisdiction, parties, dates, and business context, if known
* Desired output format

Risk level:
High

Example requests:

* "Review this contract for legal risks."
* "Should I sign this agreement?"
* "What legal issues should counsel look at?"
* "Summarize this dispute for my lawyer."

Escalation rule:
This agent must not provide final legal advice. It should clearly flag that qualified human counsel must review before legal action, signature, waiver, termination, settlement, or regulatory submission.

---

## Missing / Recommended Agents and Skills

No missing specialist agents from the June 2026 custom skill rollout are currently listed. Add new entries here only when a needed capability is not installed, approved, or safe for routing.

---

## General Routing Rules

1. Only entries marked `Status: Active` are available for routing.
2. Entries marked `Missing`, `Planned`, `Recommended`, `Draft`, or `Retired` are not available for routing.
3. Broad agents must not be used as substitutes for specialist skills when a relevant Active specialist exists.
4. If a request clearly requires a missing specialist agent or skill, recommend creating that missing agent or skill.
5. If a request is ambiguous, ask one concise clarification question before routing.
6. If a request is high-risk, recommend escalation to a qualified human reviewer or a dedicated active review agent.
7. If the Agent Directory cannot be accessed, say the directory is unavailable and avoid claiming unconfirmed capabilities.

---

## Notes

Add or update roles here as the repository grows.

When a missing agent or skill is created and approved, change its status from `Missing` to `Active` and add full routing details.

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
Coordinator Agent should coordinate work, not perform specialized work. If the request requires specialized analysis, drafting, coding, spreadsheet work, legal review, financial modeling, HR review, compliance review, or security review, the Switchboard Agent should recommend the appropriate missing specialist agent or skill unless one is already listed as Active.

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

If the user asks to analyze a spreadsheet, table, dataset, metrics report, CSV, Excel file, or numbers-heavy document, the Switchboard Agent should recommend a dedicated Data Analysis Agent or Spreadsheet Analysis Skill unless one is already listed as Status: Active.

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
Builder Agent handles general creation tasks only. If a request requires a specialized output type, such as spreadsheet analysis, slide deck creation, PDF processing, frontend development, code generation, image generation, speech generation, legal drafting, or financial modeling, the Switchboard Agent should recommend a dedicated missing agent or skill unless one is already listed as Status: Active.

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
Reviewer Agent may review general content and structure, but it should not provide final professional judgment in regulated or high-risk areas. If the request involves legal, financial, medical, HR, security, privacy, compliance, or destructive action, the Switchboard Agent should recommend escalation to a human reviewer or a dedicated specialist agent if one is listed as Active.

---

## Missing / Recommended Agents and Skills

### Spreadsheet Analysis Skill

Status: Missing

Purpose:
Analyzes spreadsheets, CSV files, tables, metrics, formulas, calculations, trends, and structured datasets.

Use when:

* The user uploads a spreadsheet or CSV file.
* The user asks to analyze numbers, trends, tables, metrics, or calculations.
* The user asks for charts, summaries, formulas, data cleaning, or spreadsheet insights.

Do not use when:

* The user only asks for general research.
* The task is purely document drafting.
* The task requires final legal, financial, HR, or compliance judgment.

Required inputs:

* Spreadsheet, CSV, table, or structured data
* User’s analysis question
* Desired output format

Risk level:
Medium to High depending on the data type

Example requests:

* "Analyze this spreadsheet."
* "Find trends in this CSV."
* "Summarize this table."
* "Check these numbers."
* "Create charts from this data."

---

### Data Analysis Agent

Status: Missing

Purpose:
Analyzes structured data, reports, metrics, dashboards, calculations, datasets, and trends.

Use when:

* The user needs data interpretation.
* The user asks for calculations or metric review.
* The user needs insights from structured data.
* The user asks for data summaries, charts, or findings.

Risk level:
Medium to High

Example requests:

* "Analyze this dataset."
* "Find trends in these metrics."
* "Compare these numbers."
* "Create a summary from this report."

---

### Document Drafting Agent

Status: Missing

Purpose:
Drafts formal documents, reports, proposals, letters, policies, and templates.

Use when:

* The user asks for a formal written document.
* The user needs a reusable written deliverable.
* The user provides requirements and wants a polished document.

Risk level:
Medium

Example requests:

* "Write a proposal."
* "Draft a report."
* "Create a policy document."
* "Turn this into a formal letter."

---

### Presentation Agent

Status: Missing

Purpose:
Creates slide outlines, presentation structures, speaker notes, and deck content.

Use when:

* The user asks to create a slide deck.
* The user asks to turn information into a presentation.
* The user needs speaker notes or meeting deck content.

Risk level:
Medium

Example requests:

* "Create a slide presentation."
* "Turn this into a deck."
* "Make speaker notes."
* "Build a meeting presentation."

---

### Legal Review Agent

Status: Missing

Purpose:
Reviews legal-risk content and routes legal questions to qualified human review.

Use when:

* The user asks about contracts, legal obligations, legal risk, disputes, or whether to sign something.
* The user asks for legal interpretation or final legal advice.

Risk level:
High

Example requests:

* "Review this contract."
* "Should I sign this agreement?"
* "Is this legally safe?"
* "What are the legal risks?"

Escalation rule:
If no Legal Review Agent is Active, the Switchboard Agent must recommend human legal review.

---

### Compliance and Risk Review Agent

Status: Missing

Purpose:
Reviews privacy, compliance, regulatory, policy, and organizational risk concerns.

Use when:

* The user asks about compliance, privacy, security, policy, regulated data, or risk.
* The request could expose sensitive information or create operational risk.

Risk level:
High

Example requests:

* "Check this for compliance risk."
* "Can we send this sensitive data?"
* "Does this violate policy?"
* "Review this for privacy concerns."

---

## General Routing Rules

1. Only entries marked `Status: Active` are available for routing.
2. Entries marked `Missing`, `Planned`, `Recommended`, `Draft`, or `Retired` are not available for routing.
3. Broad agents must not be used as substitutes for missing specialist skills.
4. If a request clearly requires a missing specialist agent or skill, recommend creating that missing agent or skill.
5. If a request is ambiguous, ask one concise clarification question before routing.
6. If a request is high-risk, recommend escalation to a qualified human reviewer or a dedicated active review agent.
7. If the Agent Directory cannot be accessed, say the directory is unavailable and avoid claiming unconfirmed capabilities.

---

## Notes

Add or update roles here as the repository grows.

When a missing agent or skill is created and approved, change its status from `Missing` to `Active` and add full routing details.

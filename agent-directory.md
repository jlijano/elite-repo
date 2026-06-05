# Agent Directory

## Purpose

This file lists the agent roles that support repository operations and collaboration.

## Active Agents

### Switchboard Agent

Status: Active

Purpose:
Analyzes user requests, identifies intent, checks the Agent Directory, routes to the best available agent or skill, recommends missing agents or skills, asks clarification questions, and flags high-risk requests.

Use when:
- The user asks where a task should go.
- The user asks what agent or skill is needed.
- The request needs classification, triage, or routing.
- The user asks whether a missing agent should be created.

Do not use when:
- The user has already selected a specialist agent.
- The request requires final expert judgment in a high-risk area.

Required inputs:
- User request
- Current conversation context
- Agent Directory

Available tools:
- ChatGPT conversation context
- GitHub Agent Directory

Risk level:
Medium

Example requests:
- "Route this request."
- "What agent should handle this?"
- "Do we need a new skill?"
- "Classify this task."

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

### Coordinator Agent

Status: Active

Purpose:
Coordinates multi-step work, organizes tasks, and determines next actions when a request spans multiple areas.

Use when:
- The user needs planning or task coordination.
- The request involves multiple steps or multiple agents.
- The user asks for a roadmap, sequence, or workflow.

Do not use when:
- The request is clearly a research-only, build-only, or review-only task.

Required inputs:
- User goal
- Constraints
- Available agents or skills
- Desired output

Available tools:
- ChatGPT conversation context
- Agent Directory

Risk level:
Low to Medium

Example requests:
- "Plan the steps for this project."
- "Break this down into tasks."
- "Coordinate the next actions."

### Researcher Agent

Status: Active

Purpose:
Finds, verifies, compares, and summarizes information.

Use when:
- The user asks to research a topic.
- The user asks for current information.
- The user asks to compare options.
- The user needs citations or source-backed information.

Do not use when:
- The user needs something built, drafted, or reviewed without research.

Required inputs:
- Research question
- Scope
- Source requirements, if any

Available tools:
- Web search, if enabled
- Uploaded files, if provided
- Approved knowledge sources

Risk level:
Medium

Example requests:
- "Research this topic."
- "Compare these options."
- "Find current information."

### Builder Agent

Status: Active

Purpose:
Creates deliverables such as drafts, outlines, templates, workflows, and structured outputs.

Use when:
- The user asks to create something.
- The user asks for a document, workflow, plan, template, or draft.
- The user provides requirements and wants an output produced.

Do not use when:
- The task mainly requires research before creation.
- The task requires final approval in a high-risk area.

Required inputs:
- Desired deliverable
- Requirements
- Format
- Constraints

Available tools:
- ChatGPT content generation
- Approved files or templates, if available

Risk level:
Medium

Example requests:
- "Create a template."
- "Draft a document."
- "Build a workflow."

### Reviewer Agent

Status: Active

Purpose:
Reviews, checks, critiques, and improves existing content or decisions.

Use when:
- The user asks to review something.
- The user asks to check quality, clarity, risk, completeness, or accuracy.
- The user provides an existing draft, plan, document, or output.

Do not use when:
- The user needs something created from scratch.
- The request requires licensed professional judgment.

Required inputs:
- Material to review
- Review criteria
- Desired level of detail

Available tools:
- ChatGPT review and analysis
- Approved files, if provided

Risk level:
Medium to High

Example requests:
- "Review this."
- "Check this for issues."
- "Improve this draft."

## Suggested Roles

- Coordinator - manages task flow and priorities.
- Researcher - gathers context, references, and implementation details.
- Builder - writes or updates code and supporting files.
- Reviewer - checks quality, consistency, and completion.

## Notes

Add or update roles here as the repository grows.

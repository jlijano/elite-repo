const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { test } = require("node:test");

const publicDir = path.resolve(__dirname, "..", "public");
const adminPages = ["chat.html", "knowledge.html", "user.html", "settings.html", "playground.html"];

function readPublicFile(filename) {
  return fs.readFileSync(path.join(publicDir, filename), "utf8");
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

test("admin navigation includes Playground on every admin page", () => {
  for (const page of adminPages) {
    const html = readPublicFile(page);
    assert.match(html, /href="\/playground\.html"/);
    assert.match(html, />Playground<\/a>/);
  }
});

test("Playground page owns its route and active navigation state", () => {
  const html = readPublicFile("playground.html");

  assert.match(html, /<body data-admin-page="playground">/);
  assert.match(html, /<title>Switchboard Admin - Playground<\/title>/);
  assert.match(html, /<link rel="stylesheet" href="playground\.css" \/>/);
  assert.match(html, /class="nav-item active" href="\/playground\.html" aria-current="page"/);
  assert.match(html, /<h1>Playground<\/h1>/);
  assert.match(html, /Organize tasks, projects, and boards in one flexible workspace\./);
});

test("non-Playground admin pages keep their own active state", () => {
  const expectedActiveLinks = {
    "chat.html": "/chat.html",
    "knowledge.html": "/knowledge.html",
    "user.html": "/user.html",
    "settings.html": "/settings.html"
  };

  for (const [page, activeHref] of Object.entries(expectedActiveLinks)) {
    const html = readPublicFile(page);
    const activePattern = new RegExp(`class="nav-item active" href="${escapeRegExp(activeHref)}" aria-current="page"`);
    assert.match(html, activePattern);
    assert.doesNotMatch(html, /class="nav-item active" href="\/playground\.html"/);
  }
});

test("Playground page includes required workspace sections", () => {
  const html = readPublicFile("playground.html");
  const expectedText = [
    "New Task",
    "New Project",
    "Total Tasks",
    "Active Projects",
    "In Progress",
    "Completed",
    "Kanban Board",
    "Backlog",
    "To Do",
    "Review",
    "Done",
    "Design dashboard layout",
    "Create task filtering UI",
    "Build project detail view",
    "Review kanban interactions",
    "Prepare release checklist",
    "Update project notes",
    "Projects",
    "Website Redesign",
    "Client Portal",
    "Internal Tools",
    "Marketing Launch",
    "Today's Tasks",
    "Workspace Notes"
  ];

  for (const text of expectedText) {
    assert.match(html, new RegExp(escapeRegExp(text)));
  }
});

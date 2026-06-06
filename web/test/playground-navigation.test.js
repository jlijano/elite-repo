const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const publicDir = path.join(__dirname, "..", "public");
const pages = {
  board: readFileSync(path.join(publicDir, "playground.html"), "utf8"),
  tasks: readFileSync(path.join(publicDir, "playground-tasks.html"), "utf8"),
  projects: readFileSync(path.join(publicDir, "playground-projects.html"), "utf8"),
  notes: readFileSync(path.join(publicDir, "playground-notes.html"), "utf8"),
  automation: readFileSync(path.join(publicDir, "playground-automation.html"), "utf8")
};

const navLinks = [
  ["Board", /href="\/playground\.html"/],
  ["Tasks", /href="\/playground-tasks\.html"/],
  ["Projects", /href="\/playground-projects\.html"/],
  ["Notes", /href="\/playground-notes\.html"/],
  ["Automation", /href="\/playground-automation\.html"/]
];

test("Playground pages expose Board, Tasks, Projects, Notes, and Automation navigation", () => {
  for (const [name, html] of Object.entries(pages)) {
    for (const [label, pattern] of navLinks) {
      assert.match(html, pattern, `${name} page links to ${label}`);
    }
  }
});

test("Projects page is the active Playground subpage", () => {
  assert.match(pages.projects, /<h1>Playground Projects<\/h1>/);
  assert.match(pages.projects, /<a class="nav-item active" href="\/playground-projects\.html" aria-current="page">/);
  assert.match(pages.projects, /Active Projects/);
  assert.match(pages.projects, /Website Redesign/);
});

test("Notes page is the active Playground subpage", () => {
  assert.match(pages.notes, /<h1>Playground Notes<\/h1>/);
  assert.match(pages.notes, /<a class="nav-item active" href="\/playground-notes\.html" aria-current="page">/);
  assert.match(pages.notes, /Workspace Notes/);
  assert.match(pages.notes, /Sprint planning notes/);
});

test("Automation page is the active Playground subpage", () => {
  assert.match(pages.automation, /<h1>Playground Automation<\/h1>/);
  assert.match(pages.automation, /<a class="nav-item active" href="\/playground-automation\.html" aria-current="page">/);
  assert.match(pages.automation, /Rules Drafted/);
  assert.match(pages.automation, /Automation Notes/);
});

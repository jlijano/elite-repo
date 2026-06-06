const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const publicDir = path.join(__dirname, "..", "public");
const pages = {
  board: readFileSync(path.join(publicDir, "playground.html"), "utf8"),
  tasks: readFileSync(path.join(publicDir, "playground-tasks.html"), "utf8"),
  automation: readFileSync(path.join(publicDir, "playground-automation.html"), "utf8")
};

test("Playground pages expose Board, Tasks, and Automation navigation", () => {
  for (const [name, html] of Object.entries(pages)) {
    assert.match(html, /href="\/playground\.html"/, `${name} page links to Board`);
    assert.match(html, /href="\/playground-tasks\.html"/, `${name} page links to Tasks`);
    assert.match(html, /href="\/playground-automation\.html"/, `${name} page links to Automation`);
  }
});

test("Automation page is the active Playground subpage", () => {
  assert.match(pages.automation, /<h1>Playground Automation<\/h1>/);
  assert.match(pages.automation, /<a class="nav-item active" href="\/playground-automation\.html" aria-current="page">/);
  assert.match(pages.automation, /Rules Drafted/);
  assert.match(pages.automation, /Automation Notes/);
});

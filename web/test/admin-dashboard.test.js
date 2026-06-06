const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const adminHtmlPath = path.join(__dirname, "..", "public", "admin.html");
const adminHtml = readFileSync(adminHtmlPath, "utf8");

const sectionLabels = [
  ["overviewSection", "Overview"],
  ["chatReviewSection", "Chat review"],
  ["knowledgeQueueSection", "Knowledge queue"],
  ["reviewRunsSection", "Review runs"],
  ["attachmentsSection", "Attachments"],
  ["adminAccessSection", "Admin access"],
  ["systemHealthSection", "System health"],
  ["settingsSection", "Settings"],
];

test("admin nav labels are clear and match visible dashboard sections", () => {
  for (const [sectionId, label] of sectionLabels) {
    assert.match(adminHtml, new RegExp(`data-target="${sectionId}"`));
    assert.match(adminHtml, new RegExp(`<h2>${label}</h2>`));
  }

  assert.doesNotMatch(adminHtml, />User management</);
  assert.doesNotMatch(adminHtml, />File management</);
  assert.doesNotMatch(adminHtml, />Files management</);
  assert.doesNotMatch(adminHtml, /Switchboard_Admin/);
});

test("each dashboard nav item points to an existing section", () => {
  const targets = [...adminHtml.matchAll(/data-target="([^"]+)"/g)].map((match) => match[1]);

  assert.deepEqual(targets, sectionLabels.map(([sectionId]) => sectionId));

  for (const target of targets) {
    assert.match(adminHtml, new RegExp(`id="${target}"`));
  }
});

test("active nav state updates when sections change", () => {
  assert.match(adminHtml, /function setActiveNav\(targetId\)/);
  assert.match(adminHtml, /classList\.toggle\("active", isActive\)/);
  assert.match(adminHtml, /setAttribute\("aria-current", "page"\)/);
  assert.match(adminHtml, /removeAttribute\("aria-current"\)/);
});

test("chat review section stays hidden until the user opens it", () => {
  assert.match(adminHtml, /<section[^>]+id="chatReviewSection"[^>]+hidden>/);
  assert.match(adminHtml, /function revealChatReviewSection\(\)/);
  assert.match(adminHtml, /els\.chatReviewSection\.hidden = false/);
  assert.match(adminHtml, /targetId === "chatReviewSection"/);
});

test("settings theme toggle is present and wired to theme switching", () => {
  assert.match(adminHtml, /id="settingsThemeButton"/);
  assert.match(adminHtml, /settingsThemeButton: document\.getElementById\("settingsThemeButton"\)/);
  assert.match(adminHtml, /els\.settingsThemeButton\.addEventListener\("click", toggleTheme\)/);
});

test("dashboard renders configurable professional widgets", () => {
  const widgetIds = [
    "overview",
    "chat-review",
    "knowledge-queue",
    "review-runs",
    "attachments",
    "admin-access",
    "system-health",
    "settings",
  ];

  for (const widgetId of widgetIds) {
    assert.match(adminHtml, new RegExp(`data-widget="${widgetId}"`));
  }

  assert.match(adminHtml, /const widgetStorageKey = "switchboard-admin-widgets"/);
  assert.match(adminHtml, /function renderWidgetToggles\(\)/);
  assert.match(adminHtml, /function applyWidgetVisibility\(\)/);
  assert.match(adminHtml, /loading/i);
  assert.match(adminHtml, /empty/i);
});

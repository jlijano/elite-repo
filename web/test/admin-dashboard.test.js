const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const publicDir = path.join(__dirname, "..", "public");
const readPublic = (file) => readFileSync(path.join(publicDir, file), "utf8");

const adminRedirectHtml = readPublic("admin.html");
const chatHtml = readPublic("chat.html");
const knowledgeHtml = readPublic("knowledge.html");
const userHtml = readPublic("user.html");
const settingsHtml = readPublic("settings.html");
const adminJs = readPublic("admin.js");
const allAdminPages = [chatHtml, knowledgeHtml, userHtml, settingsHtml];

test("admin.html redirects to the dedicated chat admin page", () => {
  assert.match(adminRedirectHtml, /url=\/chat\.html/);
  assert.match(adminRedirectHtml, /window\.location\.replace\("\/chat\.html"\)/);
});

test("top-level admin navigation uses dedicated page links", () => {
  const expectedLinks = [
    ["href=\"/\"", "Back to chat"],
    ["href=\"/chat.html\"", "Chat"],
    ["href=\"/knowledge.html\"", "Knowledge base"],
    ["href=\"/user.html\"", "User"],
    ["href=\"/settings.html\"", "Settings"],
  ];

  for (const pageHtml of allAdminPages) {
    for (const [href, label] of expectedLinks) {
      assert.match(pageHtml, new RegExp(`${href}[\\s\\S]*>${label}<`));
    }

    assert.doesNotMatch(pageHtml, /Knowledge queue/);
    assert.doesNotMatch(pageHtml, /Admin access/);
  }
});

test("back to chat uses a back-arrow icon", () => {
  for (const pageHtml of allAdminPages) {
    assert.match(pageHtml, /aria-label="Back to chat"[\s\S]*<span aria-hidden="true">←<\/span>Back to chat/);
  }
});

test("chat page owns chat review and attachments", () => {
  assert.match(chatHtml, /<body data-admin-page="chat">/);
  assert.match(chatHtml, /<h1>Chat<\/h1>/);
  assert.match(chatHtml, /id="chatPage"/);
  assert.match(chatHtml, /id="attachmentsPanel"/);
  assert.match(chatHtml, /id="fileManagement"/);
});

test("knowledge base is its own page", () => {
  assert.match(knowledgeHtml, /<body data-admin-page="knowledge">/);
  assert.match(knowledgeHtml, /<h1>Knowledge base<\/h1>/);
  assert.match(knowledgeHtml, /id="knowledgeBasePage"/);
  assert.match(knowledgeHtml, /id="knowledgeStatus"/);
});

test("user page includes user management and manage users action", () => {
  assert.match(userHtml, /<body data-admin-page="user">/);
  assert.match(userHtml, /<h1>User<\/h1>/);
  assert.match(userHtml, /id="userManagementPage"/);
  assert.match(userHtml, /id="manageUsersButton"/);
  assert.match(userHtml, />Manage users<\/button>/);
});

test("settings page owns review runs and system health", () => {
  assert.match(settingsHtml, /<body data-admin-page="settings">/);
  assert.match(settingsHtml, /<h1>Settings<\/h1>/);
  assert.match(settingsHtml, /id="settingsPage"/);
  assert.match(settingsHtml, /id="reviewRunsPage"/);
  assert.match(settingsHtml, /id="systemHealthPage"/);
  assert.match(settingsHtml, /<h2>Review runs<\/h2>/);
  assert.match(settingsHtml, /<h2>System health<\/h2>/);
});

test("top nav includes current time and profile settings person icon", () => {
  for (const pageHtml of allAdminPages) {
    assert.match(pageHtml, /id="menuClock"/);
    assert.match(pageHtml, /class="profile-settings" href="\/user\.html#profile" aria-label="User profile settings">👤<\/a>/);
    assert.doesNotMatch(pageHtml, /id="themeToggle"/);
    assert.doesNotMatch(pageHtml, /id="themeToggleText"/);
  }

  assert.match(adminJs, /function updateClock\(\)/);
  assert.match(adminJs, /weekday: "short"/);
  assert.match(adminJs, /month: "short"/);
  assert.match(adminJs, /hour: "numeric"/);
  assert.match(adminJs, /minute: "2-digit"/);
});

test("theme mode control lives inside settings page", () => {
  assert.match(settingsHtml, /id="settingsThemeButton"/);
  assert.match(settingsHtml, />Toggle theme<\/button>/);
  assert.doesNotMatch(chatHtml, /id="settingsThemeButton"/);
  assert.doesNotMatch(knowledgeHtml, /id="settingsThemeButton"/);
  assert.doesNotMatch(userHtml, /id="settingsThemeButton"/);
  assert.match(adminJs, /els\.settingsThemeButton\?\.addEventListener\("click", toggleTheme\)/);
});

test("admin javascript switches behavior by page", () => {
  assert.match(adminJs, /const page = document\.body\.dataset\.adminPage/);
  assert.match(adminJs, /async function loadChatPage\(\)/);
  assert.match(adminJs, /async function loadKnowledgePage\(\)/);
  assert.match(adminJs, /async function loadUserPage\(\)/);
  assert.match(adminJs, /async function loadSettingsPage\(\)/);
});

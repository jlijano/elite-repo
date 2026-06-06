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
const updateProfileHtml = readPublic("update-profile.html");
const loginHtml = readPublic("login.html");
const adminJs = readPublic("admin.js");
const adminCss = readPublic("admin.css");
const allAdminPages = [chatHtml, knowledgeHtml, userHtml, settingsHtml, updateProfileHtml];

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
    assert.doesNotMatch(pageHtml, /id="logoutButton"/);
    assert.doesNotMatch(pageHtml, /logout-action/);
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

test("user page includes user management and new user action", () => {
  assert.match(userHtml, /<body data-admin-page="user">/);
  assert.match(userHtml, /<h1>User<\/h1>/);
  assert.match(userHtml, /id="userManagementPage"/);
  assert.match(userHtml, /id="manageUsersButton"/);
  assert.match(userHtml, />New user<\/button>/);
});

test("settings page owns preferences access review health and diagnostics sections", () => {
  assert.match(settingsHtml, /<body data-admin-page="settings">/);
  assert.match(settingsHtml, /<h1>Settings<\/h1>/);
  assert.match(settingsHtml, /id="settingsPage"/);
  assert.match(settingsHtml, /id="accessSecurityPage"/);
  assert.match(settingsHtml, /id="reviewRunsPage"/);
  assert.match(settingsHtml, /id="systemHealthPage"/);
  assert.match(settingsHtml, /id="diagnosticsPage"/);
  assert.match(settingsHtml, />Preferences<\/p>/);
  assert.match(settingsHtml, />Access and security<\/p>/);
  assert.match(settingsHtml, /<h2>Review runs<\/h2>/);
  assert.match(settingsHtml, /<h2>System health<\/h2>/);
  assert.match(settingsHtml, /<h2>Diagnostics<\/h2>/);
});

test("settings page uses standardized status badges and expanded health layout", () => {
  assert.match(settingsHtml, /class="status-badge status-loaded">40 seconds<\/span>/);
  assert.match(settingsHtml, /class="status-badge status-public" id="settingsAdminState">Public view<\/span>/);
  assert.match(settingsHtml, /class="health-grid" id="systemHealth"/);
  assert.doesNotMatch(settingsHtml, /id="systemHealth"[^>]*compact-list/);
  assert.match(adminJs, /const statusClass = \(state = ""\) =>/);
  assert.match(adminJs, /const statusBadge = \(state\) =>/);
  assert.match(adminJs, /Review logs are protected\./);
  assert.match(adminJs, /Protected management routes remain hidden in public view/);
  assert.match(adminCss, /\.status-ready/);
  assert.match(adminCss, /\.status-loaded/);
  assert.match(adminCss, /\.status-public/);
  assert.match(adminCss, /\.status-storage/);
  assert.match(adminCss, /\.status-error/);
  assert.match(adminCss, /\.health-grid/);
});

test("top nav includes current time and profile settings person icon", () => {
  for (const pageHtml of allAdminPages) {
    assert.match(pageHtml, /id="menuClock"/);
    assert.match(pageHtml, /id="profileMenuButton"/);
    assert.match(pageHtml, /aria-label="Open profile menu"/);
    assert.match(pageHtml, />👤<\/button>/);
    assert.doesNotMatch(pageHtml, /id="themeToggle"/);
    assert.doesNotMatch(pageHtml, /id="themeToggleText"/);
  }

  assert.match(adminJs, /function updateClock\(\)/);
  assert.match(adminJs, /weekday: "short"/);
  assert.match(adminJs, /month: "short"/);
  assert.match(adminJs, /hour: "numeric"/);
  assert.match(adminJs, /minute: "2-digit"/);
});

test("profile dropdown is the admin logout surface", () => {
  for (const pageHtml of allAdminPages) {
    assert.match(pageHtml, /id="profileDropdown"/);
    assert.match(pageHtml, /href="\/update-profile\.html"[\s\S]*>Update Profile<\/a>/);
    assert.match(pageHtml, /class="profile-logout"[\s\S]*>Logout<\/button>/);
    assert.doesNotMatch(pageHtml, /id="logoutButton"/);
    assert.doesNotMatch(pageHtml, /logout-action/);
  }

  assert.match(adminJs, /function toggleProfileDropdown\(\)/);
  assert.match(adminJs, /sessionStorage\.removeItem\(adminTokenStorageKey\)/);
  assert.match(adminJs, /window\.location\.href = "\/login\.html"/);
});

test("update profile page supports photo name email and password inputs", () => {
  assert.match(updateProfileHtml, /<body data-admin-page="update-profile">/);
  assert.match(updateProfileHtml, /<h1>Update Profile<\/h1>/);
  assert.match(updateProfileHtml, /id="profileForm"/);
  assert.match(updateProfileHtml, /id="profilePhoto"[\s\S]*type="url"/);
  assert.match(updateProfileHtml, /id="profileName"[\s\S]*autocomplete="name"/);
  assert.match(updateProfileHtml, /id="profileEmail"[\s\S]*type="email"/);
  assert.match(updateProfileHtml, /id="profileCurrentPassword"[\s\S]*type="password"/);
  assert.match(updateProfileHtml, /id="profileNewPassword"[\s\S]*autocomplete="new-password"/);
  assert.match(updateProfileHtml, /id="profileConfirmPassword"[\s\S]*autocomplete="new-password"/);
  assert.match(adminJs, /const userProfileStorageKey = "switchboard-user-profile"/);
  assert.match(adminJs, /function saveProfile\(event\)/);
  assert.match(adminJs, /clearPasswordFields\(\)/);
  assert.doesNotMatch(adminJs, /password: els\.profile/);
});

test("login page is the logout redirect target", () => {
  assert.match(loginHtml, /<title>Switchboard Login<\/title>/);
  assert.match(loginHtml, /<h1>Login<\/h1>/);
  assert.match(loginHtml, /href="\/chat\.html"[\s\S]*>Admin chat<\/a>/);
});

test("theme mode control lives inside settings page", () => {
  assert.match(settingsHtml, /class="theme-mode-control"[\s\S]*aria-label="Theme preference"/);
  assert.match(settingsHtml, /data-theme-choice="light"[\s\S]*>Light<\/button>/);
  assert.match(settingsHtml, /data-theme-choice="dark"[\s\S]*>Dark<\/button>/);
  assert.match(settingsHtml, /data-theme-choice="system"[\s\S]*>System<\/button>/);
  assert.match(settingsHtml, /id="settingsThemeSummary"/);
  assert.doesNotMatch(settingsHtml, /id="settingsThemeButton"/);
  assert.doesNotMatch(settingsHtml, />Toggle theme<\/button>/);
  assert.doesNotMatch(chatHtml, /data-theme-choice=/);
  assert.doesNotMatch(knowledgeHtml, /data-theme-choice=/);
  assert.doesNotMatch(userHtml, /data-theme-choice=/);
  assert.doesNotMatch(updateProfileHtml, /data-theme-choice=/);
  assert.match(adminCss, /\.theme-mode-control/);
  assert.match(adminCss, /\.theme-mode-option\.active/);
  assert.match(adminCss, /\.theme-mode-summary/);
});

test("theme preference persists explicit choices and restores system mode", () => {
  assert.match(adminJs, /const themeStorageKey = "switchboard-theme"/);
  assert.match(adminJs, /const themePreferenceStorageKey = "switchboard-theme-mode"/);
  assert.match(adminJs, /const validThemeChoices = \["light", "dark", "system"\]/);
  assert.match(adminJs, /const systemThemeQuery = window\.matchMedia\?\.\("\(prefers-color-scheme: dark\)"\)/);
  assert.match(adminJs, /function getStoredThemePreference\(\)/);
  assert.match(adminJs, /function applyThemePreference\(preference\)/);
  assert.match(adminJs, /localStorage\.setItem\(themePreferenceStorageKey, choice\)/);
  assert.match(adminJs, /localStorage\.removeItem\(themeStorageKey\)/);
  assert.match(adminJs, /localStorage\.setItem\(themeStorageKey, choice\)/);
  assert.match(adminJs, /function applyStoredThemePreference\(\)/);
  assert.match(adminJs, /applyStoredThemePreference\(\)/);
  assert.match(adminJs, /function handleSystemThemeChange\(\)/);
  assert.match(adminJs, /systemThemeQuery\?\.addEventListener\?\.\("change", handleSystemThemeChange\)/);
  assert.match(adminJs, /els\.settingsThemeOptions\?\.forEach\(\(button\) => button\.addEventListener\("click", \(\) => applyThemePreference\(button\.dataset\.themeChoice\)\)\)/);
});

test("admin javascript switches behavior by page", () => {
  assert.match(adminJs, /const page = document\.body\.dataset\.adminPage/);
  assert.match(adminJs, /async function loadChatPage\(\)/);
  assert.match(adminJs, /async function loadKnowledgePage\(\)/);
  assert.match(adminJs, /async function loadUserPage\(\)/);
  assert.match(adminJs, /async function loadSettingsPage\(\)/);
  assert.match(adminJs, /page === "update-profile"/);
});

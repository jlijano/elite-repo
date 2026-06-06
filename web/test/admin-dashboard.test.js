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
const playgroundHtml = readPublic("playground.html");
const settingsHtml = readPublic("settings.html");
const updateProfileHtml = readPublic("update-profile.html");
const reportsHtml = readPublic("reports.html");
const logsHtml = readPublic("logs.html");
const reviewRunsHtml = readPublic("review-runs.html");
const systemHealthHtml = readPublic("system-health.html");
const userAuditHtml = readPublic("user-audit.html");
const loginHtml = readPublic("login.html");
const adminJs = readPublic("admin.js");
const profileJs = readPublic("profile.js");
const reportsJs = readPublic("reports.js");
const adminCss = readPublic("admin.css");

const allAdminPages = [
  chatHtml,
  knowledgeHtml,
  userHtml,
  playgroundHtml,
  settingsHtml,
  updateProfileHtml,
  reportsHtml,
  logsHtml,
  reviewRunsHtml,
  systemHealthHtml,
  userAuditHtml,
];

const reportPages = [
  [reportsHtml, "reports", "reportsPage", "Reports"],
  [logsHtml, "logs", "logsPage", "Logs"],
  [reviewRunsHtml, "review-runs", "reviewRunsPage", "Review runs"],
  [systemHealthHtml, "system-health", "systemHealthPage", "System health"],
  [userAuditHtml, "user-audit", "userAuditPage", "User audit"],
];

const reportLinks = [
  ["/reports.html", "Overview"],
  ["/logs.html", "Logs"],
  ["/review-runs.html", "Review runs"],
  ["/system-health.html", "System health"],
  ["/user-audit.html", "User audit"],
  ["/settings.html", "Settings"],
];

test("admin.html redirects to the dedicated chat admin page", () => {
  assert.match(adminRedirectHtml, /url=\/chat\.html/);
  assert.match(adminRedirectHtml, /window\.location\.replace\("\/chat\.html"\)/);
});

test("primary admin navigation uses dedicated page links", () => {
  const expectedLinks = [
    ["href=\"/\"", "Back to chat"],
    ["href=\"/chat.html\"", "Chat"],
    ["href=\"/knowledge.html\"", "Knowledge base"],
    ["href=\"/user.html\"", "User"],
    ["href=\"/playground.html\"", "Playground"],
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

test("reports navigation is a dropdown and contains reports plus settings", () => {
  for (const pageHtml of allAdminPages) {
    assert.match(pageHtml, /<details class="admin-section-list reports-nav" open>/);
    assert.match(pageHtml, /<summary class="reports-summary">[\s\S]*class="reports-summary-label">Reports<\/span>/);
    assert.match(pageHtml, /<div class="reports-nav-items" aria-label="Reports navigation">/);
    for (const [href, label] of reportLinks) {
      assert.match(pageHtml, new RegExp(`href="${href}"[\\s\\S]*>${label}<`));
    }
  }

  assert.match(adminCss, /\.reports-summary/);
  assert.match(adminCss, /\.reports-nav-items/);
  assert.match(adminCss, /\.reports-summary-chevron/);
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

test("user page includes user management and add user action", () => {
  assert.match(userHtml, /<body data-admin-page="user">/);
  assert.match(userHtml, /<h1>User<\/h1>/);
  assert.match(userHtml, /id="userManagementPage"/);
  assert.match(userHtml, /id="manageUsersButton"/);
  assert.match(userHtml, />Add user<\/button>/);
});

test("playground page is reachable from admin navigation", () => {
  assert.match(playgroundHtml, /<body data-admin-page="playground">/);
  assert.match(playgroundHtml, /<h1>Playground<\/h1>/);
  assert.match(playgroundHtml, /class="nav-item active" href="\/playground\.html"/);
  assert.match(playgroundHtml, /id="kanbanTitle"/);
});

test("settings page owns preferences access review health diagnostics and refresh cadence sections", () => {
  assert.match(settingsHtml, /<body data-admin-page="settings">/);
  assert.match(settingsHtml, /<h1>Settings<\/h1>/);
  assert.match(settingsHtml, /id="settingsPage"/);
  assert.match(settingsHtml, /id="accessSecurityPage"/);
  assert.match(settingsHtml, /id="reviewRunsPage"/);
  assert.match(settingsHtml, /id="systemHealthPage"/);
  assert.match(settingsHtml, /id="diagnosticsPage"/);
  assert.match(settingsHtml, />Preferences<\/p>/);
  assert.match(settingsHtml, />Access and security<\/p>/);
  assert.match(settingsHtml, /class="list compact-list review-runs-panel" id="runs"/);
  assert.match(settingsHtml, /id="diagnosticsList"/);
  assert.match(settingsHtml, /class="refresh-cadence-control"[\s\S]*aria-label="Refresh cadence"/);
  assert.match(settingsHtml, /data-refresh-choice="manual"[\s\S]*>Manual<\/button>/);
  assert.match(settingsHtml, /data-refresh-choice="fast"[\s\S]*>15s<\/button>/);
  assert.match(settingsHtml, /data-refresh-choice="standard"[\s\S]*>40s<\/button>/);
  assert.match(settingsHtml, /data-refresh-choice="minute"[\s\S]*>1m<\/button>/);
  assert.match(settingsHtml, /data-refresh-choice="relaxed"[\s\S]*>5m<\/button>/);
  assert.match(settingsHtml, /id="settingsRefreshNow"/);
  assert.match(settingsHtml, /id="settingsRefreshSummary"/);
});

test("settings page uses standardized status badges and expanded health layout", () => {
  assert.match(settingsHtml, /class="status-badge status-public" id="settingsSessionState">Public view<\/small>/);
  assert.match(settingsHtml, /class="status-badge status-public" id="settingsProtectedRouteState">Public view<\/small>/);
  assert.match(settingsHtml, /class="status-badge status-ready">Ready<\/small>/);
  assert.match(settingsHtml, /class="health-grid" id="systemHealth"/);
  assert.doesNotMatch(settingsHtml, /id="systemHealth"[^>]*compact-list/);
  assert.match(adminJs, /const statusClass = \(state = ""\) =>/);
  assert.match(adminJs, /const statusBadge = \(state\) =>/);
  assert.match(adminCss, /\.status-ready/);
  assert.match(adminCss, /\.status-loaded/);
  assert.match(adminCss, /\.status-public/);
  assert.match(adminCss, /\.status-storage/);
  assert.match(adminCss, /\.status-error/);
  assert.match(adminCss, /\.health-grid/);
});

test("report pages exist and load the reports script", () => {
  for (const [pageHtml, pageName, pageId, title] of reportPages) {
    assert.match(pageHtml, new RegExp(`<body data-admin-page="${pageName}">`));
    assert.match(pageHtml, new RegExp(`id="${pageId}"`));
    assert.match(pageHtml, new RegExp(`<h1>${title}<\\/h1>`));
    assert.match(pageHtml, /<script src="reports\.js"><\/script>/);
    assert.match(pageHtml, /id="menuClock"/);
    assert.match(pageHtml, /id="profileMenuButton"/);
    assert.match(pageHtml, /class="profile-logout"[\s\S]*>Logout<\/button>/);
  }
});

test("each report page marks the active report link", () => {
  assert.match(reportsHtml, /class="nav-item active" href="\/reports\.html" aria-current="page"/);
  assert.match(logsHtml, /class="nav-item active" href="\/logs\.html" aria-current="page"/);
  assert.match(reviewRunsHtml, /class="nav-item active" href="\/review-runs\.html" aria-current="page"/);
  assert.match(systemHealthHtml, /class="nav-item active" href="\/system-health\.html" aria-current="page"/);
  assert.match(userAuditHtml, /class="nav-item active" href="\/user-audit\.html" aria-current="page"/);
  assert.match(settingsHtml, /class="nav-item active" href="\/settings\.html" aria-current="page"/);
});

test("reports javascript loads public status and protected report data without token-entry UI", () => {
  assert.match(reportsJs, /reportsFetchJson\("\/api\/status"\)/);
  assert.match(reportsJs, /reportsFetchJson\("\/api\/admin\/summary"\)/);
  assert.match(reportsJs, /reportsFetchJson\("\/api\/admin\/review-runs"\)/);
  assert.match(reportsJs, /reportsFetchJson\("\/api\/admin\/user-audit-events"\)/);
  assert.match(reportsJs, /sessionStorage\.getItem\(reportsAdminTokenStorageKey\)/);
  assert.match(reportsJs, /sessionStorage\.getItem\(reportsSessionTokenStorageKey\)/);
  assert.match(reportsJs, /Protected details require an admin session/);
  assert.doesNotMatch(reportsJs, /prompt\(/);
  assert.doesNotMatch(reportsJs, /ADMIN_TOKEN/);
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
  assert.match(reportsJs, /function updateReportsClock\(\)/);
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
  assert.match(reportsJs, /sessionStorage\.removeItem\(reportsAdminTokenStorageKey\)/);
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
  assert.match(profileJs, /async function saveProfile\(event\)/);
  assert.match(profileJs, /clearPasswordFields\(\)/);
  assert.doesNotMatch(profileJs, /password: els\.profile/);
});

test("login page is the logout redirect target", () => {
  assert.match(loginHtml, /<title>Switchboard Login<\/title>/);
  assert.match(loginHtml, /<h1>Login<\/h1>/);
  assert.match(loginHtml, /href="\/"[\s\S]*>Back to chat<\/a>/);
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
  assert.match(adminJs, /function getStoredThemePreference\(\)/);
  assert.match(adminJs, /function applyThemePreference\(preference\)/);
  assert.match(adminJs, /localStorage\.setItem\(themePreferenceStorageKey, choice\)/);
  assert.match(adminJs, /localStorage\.removeItem\(themeStorageKey\)/);
  assert.match(adminJs, /function applyStoredThemePreference\(\)/);
  assert.match(adminJs, /applyStoredThemePreference\(\)/);
});

test("refresh cadence preference persists and controls the admin refresh timer", () => {
  assert.match(adminJs, /const refreshCadenceStorageKey = "switchboard-refresh-cadence"/);
  assert.match(adminJs, /const defaultRefreshCadence = "standard"/);
  assert.match(adminJs, /manual: \{ label: "Manual", ms: 0/);
  assert.match(adminJs, /fast: \{ label: "15 seconds", ms: 15000/);
  assert.match(adminJs, /standard: \{ label: "40 seconds", ms: 40000/);
  assert.match(adminJs, /minute: \{ label: "1 minute", ms: 60000/);
  assert.match(adminJs, /relaxed: \{ label: "5 minutes", ms: 300000/);
  assert.match(adminJs, /function getStoredRefreshCadence\(\)/);
  assert.match(adminJs, /function applyRefreshCadence\(cadence\)/);
  assert.match(adminJs, /localStorage\.setItem\(refreshCadenceStorageKey, choice\)/);
  assert.match(adminJs, /function schedulePageRefresh\(cadence = getStoredRefreshCadence\(\)\)/);
  assert.match(adminJs, /if \(refreshTimerId\) clearInterval\(refreshTimerId\)/);
  assert.match(adminJs, /if \(intervalMs > 0\) refreshTimerId = setInterval\(\(\) => loadPage\(\)\.catch\(\(\) => \{\}\), intervalMs\)/);
  assert.match(adminJs, /els\.settingsRefreshOptions\?\.forEach\(\(button\) => button\.addEventListener\("click", \(\) => applyRefreshCadence\(button\.datasetRefreshChoice \|\| button\.dataset\.refreshChoice\)\)\)/);
  assert.match(adminJs, /els\.settingsRefreshNow\?\.addEventListener\("click", \(\) => loadPage\(\)\.catch\(\(error\) => setStatus\(error\.message, true\)\)\)/);
  assert.match(adminJs, /applyRefreshCadence\(getStoredRefreshCadence\(\)\)/);
  assert.doesNotMatch(adminJs, /const refreshIntervalMs = 40000/);
  assert.match(adminCss, /\.refresh-cadence-control/);
  assert.match(adminCss, /\.refresh-cadence-option\.active/);
  assert.match(adminCss, /\.refresh-cadence-summary/);
});

test("settings access security summarizes session and protected route state without exposing secrets", () => {
  assert.match(settingsHtml, /id="settingsAccessSummary"/);
  assert.match(settingsHtml, /id="settingsSessionState"/);
  assert.match(settingsHtml, /id="settingsSessionDetail"/);
  assert.match(settingsHtml, /id="settingsProtectedRouteState"/);
  assert.match(settingsHtml, /id="settingsProtectedRouteDetail"/);
  assert.match(settingsHtml, /href="\/login\.html"[\s\S]*>Open login<\/a>/);
  assert.match(settingsHtml, /href="\/update-profile\.html"[\s\S]*>Update profile<\/a>/);
  assert.match(settingsHtml, /href="\/user-audit\.html"[\s\S]*>View user audit<\/a>/);
  assert.match(settingsHtml, /No passwords, tokens, deploy hooks, API keys, or session values are shown on this page/);
  assert.doesNotMatch(settingsHtml, /type="password"/);
  assert.doesNotMatch(settingsHtml, /ADMIN_TOKEN/);
  assert.doesNotMatch(settingsHtml, /x-session-token/);
  assert.match(adminJs, /const sessionTokenStorageKey = "switchboard-session-token"/);
  assert.match(adminJs, /const getStoredSessionToken = \(\) => sessionStorage\.getItem\(sessionTokenStorageKey\) \|\| ""/);
  assert.match(adminJs, /const hasAdminAccess = \(\) => Boolean\(token \|\| getStoredSessionToken\(\)\)/);
  assert.match(adminJs, /function updateAccessSecurityState\(\)/);
  assert.match(adminJs, /setBadgeElement\(els\.settingsSessionState, state\)/);
  assert.match(adminJs, /setBadgeElement\(els\.settingsProtectedRouteState, state\)/);
  assert.match(adminJs, /Protected admin access is available for this browser without displaying secrets/);
  assert.match(adminJs, /Public view is active\. Protected admin data stays hidden and this page will not ask for credentials/);
  assert.match(adminJs, /if \(!hasAdminAccess\(\)\)/);
  assert.match(adminJs, /hasAdminAccess\(\) \? fetchJson\("\/api\/admin\/chats", \{\}, true\) : fetchJson\("\/api\/chats\?includeArchived=true"\)/);
  assert.match(adminCss, /\.access-summary/);
  assert.match(adminCss, /\.access-security-grid/);
  assert.match(adminCss, /\.access-actions/);
});

test("settings review runs health and diagnostics render richer operational context", () => {
  assert.match(adminJs, /function renderMetricCard\(label, value, detail, state = "Ready"\)/);
  assert.match(adminJs, /function renderDiagnostics\(status = lastStatus \|\| \{\}\)/);
  assert.match(adminJs, /review-run-summary/);
  assert.match(adminJs, /Last run/);
  assert.match(adminJs, /Messages reviewed/);
  assert.match(adminJs, /Knowledge entries/);
  assert.match(adminJs, /Failures/);
  assert.match(adminJs, /health-hint/);
  assert.match(adminJs, /Refresh cadence/);
  assert.match(adminJs, /Theme mode/);
  assert.match(adminJs, /Secret display guard/);
  assert.match(adminJs, /renderDiagnostics\(status\)/);
  assert.match(adminCss, /\.review-runs-panel/);
  assert.match(adminCss, /\.review-run-summary/);
  assert.match(adminCss, /\.metric-card/);
  assert.match(adminCss, /\.health-hint/);
  assert.match(adminCss, /\.diagnostics-item/);
});

test("admin javascript switches behavior by page", () => {
  assert.match(adminJs, /const page = document\.body\.dataset\.adminPage/);
  assert.match(adminJs, /async function loadChatPage\(\)/);
  assert.match(adminJs, /async function loadKnowledgePage\(\)/);
  assert.match(adminJs, /async function loadUserPage\(\)/);
  assert.match(adminJs, /async function loadSettingsPage\(\)/);
  assert.match(adminJs, /async function loadPlaygroundPage\(\)/);
});

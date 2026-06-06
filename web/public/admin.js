const page = document.body.dataset.adminPage || "chat";
const themeStorageKey = "switchboard-theme";
const themePreferenceStorageKey = "switchboard-theme-mode";
const refreshCadenceStorageKey = "switchboard-refresh-cadence";
const sessionTokenStorageKey = "switchboard-session-token";
const adminTokenStorageKey = "switchboard-admin-token";
const userProfileStorageKey = "switchboard-user-profile";
const defaultRefreshCadence = "standard";
const defaultProfile = { photo: "", name: "Switchboard User", email: "user@example.com", passwordUpdatedAt: "" };
const projectKnowledgeEntries = [
  { id: "project-admin-token-ui", title: "Admin login panel cleanup", status: "project", createdAt: "2026-06-06T00:00:00.000Z", content: "The admin dashboard should not show visible token-entry, Login, or Run Review controls. Protected backend admin routes still require ADMIN_TOKEN, but that requirement stays backend-only rather than being presented as an on-screen token form." },
  { id: "project-chat-review-loading", title: "Chat page behavior", status: "project", createdAt: "2026-06-06T00:00:00.000Z", content: "The Chat admin page loads recent chats with /api/chats?includeArchived=true. Selecting Inspect loads chat details and message attachments into the same page." },
  { id: "project-knowledge-base-section", title: "Knowledge base purpose", status: "project", createdAt: "2026-06-06T00:00:00.000Z", content: "The Knowledge base page shows project-level working notes from the current build conversation plus review-created backend knowledge when an admin session is available. Static project notes are informational cards, not database records requiring approval actions." },
  { id: "project-deployment-rule", title: "GitHub and Render deployment rule", status: "project", createdAt: "2026-06-06T00:00:00.000Z", content: "Repository changes should be committed through GitHub and deployed by Render auto-deploy from main. Do not request, store, or expose Render credentials, deploy hooks, API keys, passwords, session cookies, or other secrets. If Render fails, diagnose from build logs and fix repository code." }
];

const $ = (id) => document.getElementById(id);
const els = {
  status: $("status"),
  chats: $("chats"),
  chatSearch: $("chatSearch"),
  chatDetail: $("chatDetail"),
  fileManagement: $("fileManagement"),
  knowledgeSearch: $("knowledgeSearch"),
  knowledgeStatus: $("knowledgeStatus"),
  knowledge: $("knowledge"),
  users: $("users"),
  userSearch: $("userSearch"),
  userForm: $("userForm"),
  userFormTitle: $("userFormTitle"),
  userName: $("userName"),
  userEmail: $("userEmail"),
  userPhotoUrl: $("userPhotoUrl"),
  userRole: $("userRole"),
  userStatus: $("userStatus"),
  userPassword: $("userPassword"),
  userAuditEvents: $("userAuditEvents"),
  cancelUserEditButton: $("cancelUserEditButton"),
  saveUserButton: $("saveUserButton"),
  manageUsersButton: $("manageUsersButton"),
  runs: $("runs"),
  systemHealth: $("systemHealth"),
  logoutButton: $("logoutButton"),
  profileMenuButton: $("profileMenuButton"),
  profileDropdown: $("profileDropdown"),
  profileLogoutButtons: document.querySelectorAll(".profile-logout"),
  profileForm: $("profileForm"),
  profilePhoto: $("profilePhoto"),
  profileName: $("profileName"),
  profileEmail: $("profileEmail"),
  profileCurrentPassword: $("profileCurrentPassword"),
  profileNewPassword: $("profileNewPassword"),
  profileConfirmPassword: $("profileConfirmPassword"),
  profilePhotoPreview: $("profilePhotoPreview"),
  themeToggle: $("themeToggle"),
  themeToggleText: $("themeToggleText"),
  themeToggleIcon: document.querySelector(".theme-toggle-icon"),
  settingsThemeButton: $("settingsThemeButton"),
  settingsThemeOptions: document.querySelectorAll("[data-theme-choice]"),
  settingsThemeSummary: $("settingsThemeSummary"),
  settingsRefreshOptions: document.querySelectorAll("[data-refresh-choice]"),
  settingsRefreshSummary: $("settingsRefreshSummary"),
  settingsRefreshNow: $("settingsRefreshNow"),
  settingsAccessSummary: $("settingsAccessSummary"),
  settingsSessionState: $("settingsSessionState"),
  settingsSessionDetail: $("settingsSessionDetail"),
  settingsProtectedRouteState: $("settingsProtectedRouteState"),
  settingsProtectedRouteDetail: $("settingsProtectedRouteDetail"),
  settingsAdminState: $("settingsAdminState"),
  menuClock: $("menuClock")
};

let token = sessionStorage.getItem(adminTokenStorageKey) || "";
let chatsCache = [];
let knowledgeCache = [...projectKnowledgeEntries];
let usersCache = [];
let userAuditCache = [];
let selectedChatId = "";
let editingUserId = "";
let lastStatus = null;
let refreshTimerId = null;

const html = (value) => String(value ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const time = (value) => value ? new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }).format(new Date(value)) : "";
const textMatch = (value, query = "") => String(value || "").toLowerCase().includes(query.trim().toLowerCase());
const publicHeaders = () => ({ "Content-Type": "application/json" });
const getStoredSessionToken = () => sessionStorage.getItem(sessionTokenStorageKey) || "";
const hasAdminAccess = () => Boolean(token || getStoredSessionToken());
const adminHeaders = () => token ? { "Content-Type": "application/json", "x-admin-token": token } : publicHeaders();
const getCurrentTheme = () => document.documentElement.dataset.theme === "dark" ? "dark" : "light";
const validThemeChoices = ["light", "dark", "system"];
const systemThemeQuery = window.matchMedia?.("(prefers-color-scheme: dark)");
const resolveThemeChoice = (choice) => choice === "system" ? (systemThemeQuery?.matches ? "dark" : "light") : choice;
const refreshCadenceOptions = {
  manual: { label: "Manual", ms: 0, summary: "Manual refresh. Background refresh is off." },
  fast: { label: "15 seconds", ms: 15000, summary: "Auto refresh every 15 seconds" },
  standard: { label: "40 seconds", ms: 40000, summary: "Auto refresh every 40 seconds" },
  minute: { label: "1 minute", ms: 60000, summary: "Auto refresh every 1 minute" },
  relaxed: { label: "5 minutes", ms: 300000, summary: "Auto refresh every 5 minutes" }
};
const validRefreshCadences = Object.keys(refreshCadenceOptions);
const statusClass = (state = "") => {
  const normalized = String(state).toLowerCase();
  if (normalized.includes("error") || normalized.includes("unavailable") || normalized.includes("failed") || normalized.includes("disabled")) return "status-error";
  if (normalized.includes("public")) return "status-public";
  if (normalized.includes("storage-only") || normalized.includes("invited")) return "status-storage";
  if (normalized.includes("loaded") || normalized.includes("running")) return "status-loaded";
  return "status-ready";
};
const statusBadge = (state) => `<small class="status-badge ${statusClass(state)}">${html(state)}</small>`;

function setStatus(message, error = false) {
  if (!els.status) return;
  els.status.textContent = message;
  els.status.hidden = false;
  els.status.classList.toggle("error", error);
}

function updateClock() {
  if (!els.menuClock) return;
  els.menuClock.textContent = new Intl.DateTimeFormat(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit"
  }).format(new Date());
}

async function fetchJson(url, options = {}, useAdminHeaders = false) {
  const res = await fetch(url, { ...options, headers: { ...(useAdminHeaders ? adminHeaders() : publicHeaders()), ...(options.headers || {}) } });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || "Request failed.");
  return data;
}

function updateThemeToggle(theme) {
  if (!els.themeToggle || !els.themeToggleText || !els.themeToggleIcon) return;
  const isDark = theme === "dark";
  els.themeToggle.setAttribute("aria-pressed", String(isDark));
  els.themeToggle.setAttribute("aria-label", isDark ? "Switch to light mode" : "Switch to dark mode");
  els.themeToggleText.textContent = isDark ? "Light Mode" : "Dark Mode";
  els.themeToggleIcon.textContent = isDark ? "☀" : "☾";
}

function getStoredThemePreference() {
  let explicitTheme = null;
  let storedPreference = null;
  try {
    explicitTheme = localStorage.getItem(themeStorageKey);
    storedPreference = localStorage.getItem(themePreferenceStorageKey);
  } catch (error) {}
  if (explicitTheme === "light" || explicitTheme === "dark") return explicitTheme;
  return validThemeChoices.includes(storedPreference) ? storedPreference : "system";
}

function updateSettingsThemeControl(preference = getStoredThemePreference()) {
  const resolvedTheme = resolveThemeChoice(preference);
  els.settingsThemeOptions?.forEach((button) => {
    const active = button.dataset.themeChoice === preference;
    button.classList.toggle("active", active);
    button.setAttribute("aria-pressed", String(active));
  });
  if (els.settingsThemeSummary) {
    els.settingsThemeSummary.textContent = preference === "system"
      ? `Using system preference (${resolvedTheme})`
      : `Using ${preference} mode`;
  }
}

function applyThemePreference(preference) {
  const choice = validThemeChoices.includes(preference) ? preference : "system";
  const resolvedTheme = resolveThemeChoice(choice);
  document.documentElement.dataset.theme = resolvedTheme;
  try {
    localStorage.setItem(themePreferenceStorageKey, choice);
    if (choice === "system") localStorage.removeItem(themeStorageKey);
    else localStorage.setItem(themeStorageKey, choice);
  } catch (error) {}
  updateThemeToggle(resolvedTheme);
  updateSettingsThemeControl(choice);
}

function applyStoredThemePreference() {
  applyThemePreference(getStoredThemePreference());
}

function applyTheme(theme) {
  applyThemePreference(theme);
}

function toggleTheme() {
  applyThemePreference(getCurrentTheme() === "dark" ? "light" : "dark");
}

function handleSystemThemeChange() {
  if (getStoredThemePreference() === "system") applyThemePreference("system");
}

function getStoredRefreshCadence() {
  try {
    const storedCadence = localStorage.getItem(refreshCadenceStorageKey);
    if (validRefreshCadences.includes(storedCadence)) return storedCadence;
  } catch (error) {}
  return defaultRefreshCadence;
}

function updateSettingsRefreshControl(cadence = getStoredRefreshCadence()) {
  const choice = validRefreshCadences.includes(cadence) ? cadence : defaultRefreshCadence;
  const config = refreshCadenceOptions[choice];
  els.settingsRefreshOptions?.forEach((button) => {
    const active = button.dataset.refreshChoice === choice;
    button.classList.toggle("active", active);
    button.setAttribute("aria-pressed", String(active));
  });
  if (els.settingsRefreshSummary) els.settingsRefreshSummary.textContent = config.summary;
}

function schedulePageRefresh(cadence = getStoredRefreshCadence()) {
  if (refreshTimerId) clearInterval(refreshTimerId);
  refreshTimerId = null;
  const choice = validRefreshCadences.includes(cadence) ? cadence : defaultRefreshCadence;
  const intervalMs = refreshCadenceOptions[choice].ms;
  if (intervalMs > 0) refreshTimerId = setInterval(() => loadPage().catch(() => {}), intervalMs);
}

function applyRefreshCadence(cadence) {
  const choice = validRefreshCadences.includes(cadence) ? cadence : defaultRefreshCadence;
  try { localStorage.setItem(refreshCadenceStorageKey, choice); } catch (error) {}
  updateSettingsRefreshControl(choice);
  schedulePageRefresh(choice);
}

function setBadgeElement(element, state) {
  if (!element) return;
  element.textContent = state;
  element.className = `status-badge ${statusClass(state)}`;
}

function updateAccessSecurityState() {
  const sessionToken = getStoredSessionToken();
  const adminTokenAvailable = Boolean(token);
  const sessionAvailable = Boolean(sessionToken);
  const accessAvailable = adminTokenAvailable || sessionAvailable;
  const state = accessAvailable ? "Ready" : "Public view";

  setBadgeElement(els.settingsAdminState, state);
  setBadgeElement(els.settingsSessionState, state);
  setBadgeElement(els.settingsProtectedRouteState, state);

  if (els.settingsSessionDetail) {
    els.settingsSessionDetail.textContent = sessionAvailable
      ? "An owner/admin browser session is available for protected admin requests. Session values stay hidden."
      : adminTokenAvailable
        ? "A compatibility admin token is available in this browser session. Token values stay hidden."
        : "No owner/admin session is stored in this browser.";
  }
  if (els.settingsProtectedRouteDetail) {
    els.settingsProtectedRouteDetail.textContent = accessAvailable
      ? "Protected review logs, user records, audit events, and reports can be requested by this browser."
      : "Review logs, user records, audit events, and management reports stay hidden until an admin session is available.";
  }
  if (els.settingsAccessSummary) {
    els.settingsAccessSummary.textContent = accessAvailable
      ? "Protected admin access is available for this browser without displaying secrets."
      : "Public view is active. Protected admin data stays hidden and this page will not ask for credentials.";
  }
}

function refreshTokenFromSession() {
  token = sessionStorage.getItem(adminTokenStorageKey) || "";
  updateAccessSecurityState();
  return token;
}

function logout() {
  token = "";
  sessionStorage.removeItem(adminTokenStorageKey);
  closeProfileDropdown();
  window.location.href = "/login.html";
}

function getStoredProfile() {
  try {
    const parsed = JSON.parse(localStorage.getItem(userProfileStorageKey) || "{}");
    return { ...defaultProfile, ...(parsed && typeof parsed === "object" ? parsed : {}) };
  } catch (error) {
    return { ...defaultProfile };
  }
}

function saveStoredProfile(profile) {
  const safeProfile = {
    photo: String(profile.photo || "").slice(0, 600),
    name: String(profile.name || "").trim().slice(0, 120),
    email: String(profile.email || "").trim().slice(0, 160),
    passwordUpdatedAt: profile.passwordUpdatedAt || ""
  };
  try { localStorage.setItem(userProfileStorageKey, JSON.stringify(safeProfile)); } catch (error) {}
  return safeProfile;
}

function updateProfilePreview(photo = "") {
  if (!els.profilePhotoPreview) return;
  const safePhoto = String(photo || "").trim();
  els.profilePhotoPreview.innerHTML = safePhoto ? `<img src="${html(safePhoto)}" alt="">` : "👤";
}

function loadProfileForm() {
  if (!els.profileForm) return;
  const profile = getStoredProfile();
  els.profilePhoto.value = profile.photo || "";
  els.profileName.value = profile.name || "";
  els.profileEmail.value = profile.email || "";
  updateProfilePreview(profile.photo);
}

function clearPasswordFields() {
  [els.profileCurrentPassword, els.profileNewPassword, els.profileConfirmPassword].forEach((field) => {
    if (field) field.value = "";
  });
}

function saveProfile(event) {
  event.preventDefault();
  const newPassword = els.profileNewPassword?.value || "";
  const confirmPassword = els.profileConfirmPassword?.value || "";
  if (newPassword || confirmPassword) {
    if (newPassword.length < 8) return setStatus("New password must be at least 8 characters.", true);
    if (newPassword !== confirmPassword) return setStatus("New password and confirmation must match.", true);
  }
  const stored = saveStoredProfile({
    photo: els.profilePhoto?.value,
    name: els.profileName?.value,
    email: els.profileEmail?.value,
    passwordUpdatedAt: newPassword ? new Date().toISOString() : getStoredProfile().passwordUpdatedAt
  });
  clearPasswordFields();
  updateProfilePreview(stored.photo);
  setStatus(newPassword ? "Profile saved and password update accepted for this session." : "Profile saved.");
}

function setProfileDropdownOpen(open) {
  if (!els.profileMenuButton || !els.profileDropdown) return;
  els.profileMenuButton.setAttribute("aria-expanded", String(open));
  els.profileDropdown.hidden = !open;
}

function closeProfileDropdown() {
  setProfileDropdownOpen(false);
}

function toggleProfileDropdown() {
  setProfileDropdownOpen(els.profileDropdown?.hidden !== false);
}

function renderFileManagementFromMessages(messages = []) {
  if (!els.fileManagement) return;
  const attachments = [];
  for (const message of messages) {
    const items = Array.isArray(message.context?.attachments) ? message.context.attachments : [];
    for (const attachment of items) attachments.push({ ...attachment, role: message.role, createdAt: message.createdAt });
  }
  els.fileManagement.innerHTML = attachments.length
    ? attachments.map((attachment) => `<article class="item"><div class="row"><span>${html(attachment.name || "Attachment")}</span><small>${html(attachment.role || "message")}</small></div><p>${html(attachment.type || "text attachment")} ${attachment.size ? `- ${html(attachment.size)} bytes` : ""}</p><p>Stored in sanitized chat message context ${attachment.createdAt ? `on ${html(time(attachment.createdAt))}` : ""}.</p></article>`).join("")
    : `<article class="item"><div class="row"><span>No attachments in selected chat</span><small>Chat</small></div><p>Select a chat to inspect files attached to its messages.</p></article>`;
}

function renderChats() {
  if (!els.chats) return;
  const query = els.chatSearch?.value || "";
  const filteredChats = chatsCache.filter((chat) => textMatch(chat.title, query) || textMatch(chat.id, query));
  els.chats.innerHTML = filteredChats.length ? filteredChats.map((chat) => `<article class="item${chat.id === selectedChatId ? " active" : ""}"><div class="row"><span>${html(chat.title || "New chat")}</span><small>${html(chat.messageCount)} msg</small></div><p>Updated ${html(time(chat.updatedAt))}${chat.archivedAt ? ` - Archived ${html(time(chat.archivedAt))}` : ""}</p><div class="actions"><button data-chat="${html(chat.id)}">Inspect</button></div></article>`).join("") : `<div class="empty">No chats match this search.</div>`;
  els.chats.querySelectorAll("[data-chat]").forEach((button) => button.addEventListener("click", () => loadChat(button.dataset.chat)));
}

function renderKnowledge() {
  if (!els.knowledge) return;
  const query = els.knowledgeSearch?.value || "";
  const status = els.knowledgeStatus?.value || "all";
  const entries = knowledgeCache.filter((entry) => {
    const matchesStatus = status === "all" || entry.status === status;
    return matchesStatus && (textMatch(entry.title, query) || textMatch(entry.content, query) || textMatch(entry.status, query));
  });
  els.knowledge.innerHTML = entries.length ? entries.map((entry) => {
    const actions = entry.status === "project" ? "" : `<div class="actions"><button data-id="${html(entry.id)}" data-status="approved">Approve</button><button data-id="${html(entry.id)}" data-status="pending_review">Pending</button><button data-id="${html(entry.id)}" data-status="archived">Archive</button></div>`;
    return `<article class="item"><div class="row"><span>${html(entry.title)}</span><small class="tag ${html(entry.status)}">${html(entry.status)}</small></div><p>${html(entry.content.slice(0, 900))}</p><p>Created ${html(time(entry.createdAt))}</p>${actions}</article>`;
  }).join("") : `<div class="empty">No knowledge entries match this filter.</div>`;
  els.knowledge.querySelectorAll("[data-id]").forEach((button) => button.addEventListener("click", () => updateKnowledge(button.dataset.id, button.dataset.status)));
}

function renderRuns(runs = []) {
  if (!els.runs) return;
  if (!hasAdminAccess()) {
    els.runs.innerHTML = `<div class="empty action-empty"><strong>Review logs are protected.</strong><p>Start or restore a valid admin session to inspect run history, counts, and errors. Public view keeps review records hidden.</p></div>`;
    return;
  }
  els.runs.innerHTML = runs.length ? runs.map((run) => {
    const state = run.status === "failed" ? "Error" : run.status === "running" ? "Loaded" : "Ready";
    return `<article class="item"><div class="row"><span>${html(run.status)}</span>${statusBadge(state)}</div><p>${html(run.messagesReviewed)} messages reviewed, ${html(run.knowledgeEntriesCreated)} KB entries created.</p><p>Started ${html(time(run.startedAt))}${run.finishedAt ? `; finished ${html(time(run.finishedAt))}` : ""}.</p>${run.error ? `<p>${html(run.error)}</p>` : ""}</article>`;
  }).join("") : `<div class="empty action-empty"><strong>No review runs yet.</strong><p>Review history will appear here after the backend records a completed run.</p></div>`;
}

function setUserFormEnabled(enabled) {
  [els.userName, els.userEmail, els.userPhotoUrl, els.userRole, els.userStatus, els.userPassword, els.saveUserButton, els.cancelUserEditButton].forEach((field) => {
    if (field) field.disabled = !enabled;
  });
  if (els.manageUsersButton) els.manageUsersButton.disabled = !enabled;
  if (els.userSearch) els.userSearch.disabled = !enabled;
}

function resetUserForm() {
  editingUserId = "";
  if (els.userForm) els.userForm.reset();
  if (els.userRole) els.userRole.value = "viewer";
  if (els.userStatus) els.userStatus.value = "active";
  if (els.userFormTitle) els.userFormTitle.textContent = "Create user";
  if (els.saveUserButton) els.saveUserButton.textContent = "Create user";
  if (els.cancelUserEditButton) els.cancelUserEditButton.hidden = true;
}

function fillUserForm(user) {
  editingUserId = user.id;
  if (els.userName) els.userName.value = user.name || "";
  if (els.userEmail) els.userEmail.value = user.email || "";
  if (els.userPhotoUrl) els.userPhotoUrl.value = user.photoUrl || "";
  if (els.userRole) els.userRole.value = user.role || "viewer";
  if (els.userStatus) els.userStatus.value = user.status || "active";
  if (els.userPassword) els.userPassword.value = "";
  if (els.userFormTitle) els.userFormTitle.textContent = `Edit ${user.name || "user"}`;
  if (els.saveUserButton) els.saveUserButton.textContent = "Save changes";
  if (els.cancelUserEditButton) els.cancelUserEditButton.hidden = false;
  els.userName?.focus();
}

function renderUserAuditEvents() {
  if (!els.userAuditEvents) return;
  if (!hasAdminAccess()) {
    els.userAuditEvents.innerHTML = `<div class="empty action-empty"><strong>Audit events are protected.</strong><p>Start or restore an admin session to inspect account changes.</p></div>`;
    return;
  }
  els.userAuditEvents.innerHTML = userAuditCache.length
    ? userAuditCache.map((event) => `<article class="item audit-item"><div class="row"><span>${html(event.action)}</span>${statusBadge("Loaded")}</div><p>Target: ${html(event.targetUserId || "none")}</p><p>${html(time(event.createdAt))}</p></article>`).join("")
    : `<div class="empty action-empty"><strong>No audit events yet.</strong><p>User changes will appear here after admins create, update, disable, or reactivate accounts.</p></div>`;
}

function renderUsers(users = usersCache, runtime = {}) {
  if (!els.users) return;
  setUserFormEnabled(hasAdminAccess());
  if (!hasAdminAccess()) {
    resetUserForm();
    els.users.innerHTML = `<article class="item"><div class="row"><span>Admin session required</span>${statusBadge(runtime.storageMode || "Public view")}</div><p>User records are protected. Start or restore an admin session before creating or editing accounts.</p></article>`;
    renderUserAuditEvents();
    return;
  }
  const query = els.userSearch?.value || "";
  const filteredUsers = users.filter((user) => textMatch(user.name, query) || textMatch(user.email, query) || textMatch(user.role, query) || textMatch(user.status, query));
  els.users.innerHTML = filteredUsers.length ? filteredUsers.map((user) => {
    const disabled = user.status === "disabled";
    const statusAction = disabled
      ? `<button data-user-reactivate="${html(user.id)}" type="button">Reactivate</button>`
      : `<button data-user-disable="${html(user.id)}" type="button">Disable</button>`;
    return `<article class="item user-item${user.id === editingUserId ? " active" : ""}"><div class="row"><span>${html(user.name)}</span>${statusBadge(user.status || "unknown")}</div><p>${html(user.email)} - ${html(user.role || "viewer")}</p><p>Updated ${html(time(user.updatedAt))}</p><div class="actions"><button data-user-edit="${html(user.id)}" type="button">Edit</button>${statusAction}</div></article>`;
  }).join("") : `<div class="empty action-empty"><strong>No users match this search.</strong><p>Clear the search or create a new user record.</p></div>`;
  els.users.querySelectorAll("[data-user-edit]").forEach((button) => button.addEventListener("click", () => {
    const user = usersCache.find((item) => item.id === button.dataset.userEdit);
    if (user) fillUserForm(user);
    renderUsers();
  }));
  els.users.querySelectorAll("[data-user-disable]").forEach((button) => button.addEventListener("click", () => updateUserStatus(button.dataset.userDisable, "disable")));
  els.users.querySelectorAll("[data-user-reactivate]").forEach((button) => button.addEventListener("click", () => updateUserStatus(button.dataset.userReactivate, "reactivate")));
  renderUserAuditEvents();
}

function renderSystemHealth(status = lastStatus || {}) {
  if (!els.systemHealth) return;
  const accessAvailable = hasAdminAccess();
  const rows = [
    ["Storage", status.storageAvailable === false ? "Error" : "Ready", status.storageMode || "unknown"],
    ["AI availability", status.aiAvailable ? "Ready" : "Storage-only", status.aiAvailable ? "Responses enabled" : "Messages are saved for review"],
    ["Directory loaded", status.directoryAvailable ? "Loaded" : "Error", Array.isArray(status.filesLoaded) ? `${status.filesLoaded.length} files loaded` : "No file count"],
    ["Protected route status", accessAvailable ? "Ready" : "Public view", accessAvailable ? "Admin access is available in this browser session" : "Protected management routes remain hidden in public view"]
  ];
  els.systemHealth.innerHTML = rows.map(([label, state, detail]) => `<article class="item health-item"><div class="row"><span>${html(label)}</span>${statusBadge(state)}</div><p>${html(detail)}</p></article>`).join("");
}

async function loadChat(chatId) {
  selectedChatId = chatId;
  renderChats();
  if (els.chatDetail) els.chatDetail.innerHTML = `<div class="empty">Loading chat...</div>`;
  try {
    const url = hasAdminAccess() ? `/api/admin/chats/${encodeURIComponent(chatId)}` : `/api/chats/${encodeURIComponent(chatId)}`;
    const data = await fetchJson(url, {}, hasAdminAccess());
    const messages = data.chat.messages || [];
    if (els.chatDetail) {
      els.chatDetail.innerHTML = `<article class="item"><div class="row"><span>${html(data.chat.title)}</span><small>${html(messages.length)} messages</small></div>${messages.map((m) => `<div class="admin-message"><p class="admin-message-meta"><strong>${html(m.role)}</strong> ${html(time(m.createdAt))}</p><p class="admin-message-content">${html(m.content)}</p></div>`).join("")}</article>`;
    }
    renderFileManagementFromMessages(messages);
  } catch (error) {
    if (els.chatDetail) els.chatDetail.innerHTML = `<div class="empty">${html(error.message)}</div>`;
  }
}

async function updateKnowledge(entryId, status) {
  if (!hasAdminAccess()) return setStatus("Protected knowledge controls require an admin session.", true);
  setStatus(`Updating knowledge entry to ${status}...`);
  try {
    await fetchJson(`/api/admin/knowledge/${encodeURIComponent(entryId)}`, { method: "PATCH", body: JSON.stringify({ status }) }, true);
    await loadKnowledgePage();
  } catch (error) {
    setStatus(error.message, true);
  }
}

async function saveUser(event) {
  event.preventDefault();
  if (!hasAdminAccess()) return setStatus("User management requires an admin session.", true);
  const payload = {
    name: els.userName?.value,
    email: els.userEmail?.value,
    photoUrl: els.userPhotoUrl?.value,
    role: els.userRole?.value,
    status: els.userStatus?.value
  };
  const password = els.userPassword?.value || "";
  if (password) payload.password = password;
  const url = editingUserId ? `/api/admin/users/${encodeURIComponent(editingUserId)}` : "/api/admin/users";
  const method = editingUserId ? "PATCH" : "POST";
  setStatus(editingUserId ? "Saving user changes..." : "Creating user...");
  try {
    await fetchJson(url, { method, body: JSON.stringify(payload) }, true);
    resetUserForm();
    await loadUserPage();
    setStatus(method === "POST" ? "User created." : "User updated.");
  } catch (error) {
    setStatus(error.message, true);
  }
}

async function updateUserStatus(userId, action) {
  if (!hasAdminAccess()) return setStatus("User management requires an admin session.", true);
  setStatus(action === "disable" ? "Disabling user..." : "Reactivating user...");
  try {
    await fetchJson(`/api/admin/users/${encodeURIComponent(userId)}/${action}`, { method: "POST", body: "{}" }, true);
    if (editingUserId === userId) resetUserForm();
    await loadUserPage();
    setStatus(action === "disable" ? "User disabled." : "User reactivated.");
  } catch (error) {
    setStatus(error.message, true);
  }
}

async function loadChatPage() {
  setStatus(hasAdminAccess() ? "Loading admin chats..." : "Loading recent chats...");
  const [status, chats] = await Promise.all([
    fetchJson("/api/status"),
    hasAdminAccess() ? fetchJson("/api/admin/chats", {}, true) : fetchJson("/api/chats?includeArchived=true")
  ]);
  lastStatus = status;
  chatsCache = chats.chats || [];
  renderChats();
  renderFileManagementFromMessages();
  setStatus(`${chatsCache.length} chats available. Attachments appear after selecting a chat.`);
}

async function loadKnowledgePage() {
  setStatus(hasAdminAccess() ? "Loading protected knowledge base..." : "Loading project knowledge base...");
  const status = await fetchJson("/api/status");
  lastStatus = status;
  if (hasAdminAccess()) {
    const knowledge = await fetchJson(`/api/admin/knowledge?status=${encodeURIComponent(els.knowledgeStatus?.value === "project" ? "all" : els.knowledgeStatus?.value || "all")}`, {}, true);
    knowledgeCache = [...projectKnowledgeEntries, ...(knowledge.entries || [])];
  } else {
    knowledgeCache = [...projectKnowledgeEntries];
  }
  renderKnowledge();
  setStatus(`${knowledgeCache.length} knowledge base entries available.`);
}

async function loadUserPage() {
  setStatus(hasAdminAccess() ? "Loading user records..." : "Loading public user management state...");
  const status = await fetchJson("/api/status");
  lastStatus = status;
  if (hasAdminAccess()) {
    const [users, audit] = await Promise.all([
      fetchJson("/api/admin/users", {}, true),
      fetchJson("/api/admin/user-audit-events", {}, true)
    ]);
    usersCache = users.users || [];
    userAuditCache = audit.events || [];
    renderUsers(usersCache, status);
    setStatus(`${usersCache.length} user records available.`);
  } else {
    usersCache = [];
    userAuditCache = [];
    renderUsers([], { storageMode: status.storageMode || "public" });
    setStatus("User management requires an admin session.", true);
  }
}

async function loadSettingsPage() {
  setStatus(hasAdminAccess() ? "Loading settings and review history..." : "Loading settings...");
  const status = await fetchJson("/api/status");
  lastStatus = status;
  renderSystemHealth(status);
  if (hasAdminAccess()) {
    const runs = await fetchJson("/api/admin/review-runs", {}, true);
    renderRuns(runs.runs || []);
  } else {
    renderRuns();
  }
  setStatus("Settings page loaded.");
}

async function loadPlaygroundPage() {
  setStatus("Playground page loaded.");
}

async function loadPage() {
  refreshTokenFromSession();
  try {
    if (page === "chat") await loadChatPage();
    if (page === "knowledge") await loadKnowledgePage();
    if (page === "user") await loadUserPage();
    if (page === "settings") await loadSettingsPage();
    if (page === "playground") await loadPlaygroundPage();
    if (page === "update-profile") {
      loadProfileForm();
      setStatus("Update profile page loaded.");
    }
  } catch (error) {
    setStatus(error.message, true);
    renderKnowledge();
    renderRuns();
    renderUsers();
    renderSystemHealth(lastStatus || {});
  }
}

applyStoredThemePreference();
updateClock();
setInterval(updateClock, 30000);
refreshTokenFromSession();
els.themeToggle?.addEventListener("click", toggleTheme);
els.settingsThemeOptions?.forEach((button) => button.addEventListener("click", () => applyThemePreference(button.dataset.themeChoice)));
els.settingsThemeButton?.addEventListener("click", toggleTheme);
systemThemeQuery?.addEventListener?.("change", handleSystemThemeChange);
els.settingsRefreshOptions?.forEach((button) => button.addEventListener("click", () => applyRefreshCadence(button.dataset.refreshChoice)));
els.settingsRefreshNow?.addEventListener("click", () => loadPage().catch((error) => setStatus(error.message, true)));
els.logoutButton?.addEventListener("click", logout);
els.profileMenuButton?.addEventListener("click", toggleProfileDropdown);
els.profileLogoutButtons.forEach((button) => button.addEventListener("click", logout));
els.profilePhoto?.addEventListener("input", () => updateProfilePreview(els.profilePhoto.value));
els.profileForm?.addEventListener("submit", saveProfile);
els.userForm?.addEventListener("submit", saveUser);
els.cancelUserEditButton?.addEventListener("click", () => { resetUserForm(); renderUsers(); });
els.manageUsersButton?.addEventListener("click", () => {
  if (!hasAdminAccess()) return setStatus("User management requires an admin session.", true);
  resetUserForm();
  els.userName?.focus();
  setStatus("Ready to create a new user.");
});
document.addEventListener("click", (event) => {
  if (!els.profileDropdown || !els.profileMenuButton) return;
  if (els.profileDropdown.hidden) return;
  if (event.target.closest(".profile-menu")) return;
  closeProfileDropdown();
});
document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") closeProfileDropdown();
});
els.chatSearch?.addEventListener("input", renderChats);
els.knowledgeSearch?.addEventListener("input", renderKnowledge);
els.userSearch?.addEventListener("input", () => renderUsers());
els.knowledgeStatus?.addEventListener("change", () => loadKnowledgePage().catch((error) => setStatus(error.message, true)));
loadPage().catch(() => {});
applyRefreshCadence(getStoredRefreshCadence());

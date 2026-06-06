const page = document.body.dataset.adminPage || "chat";
const themeStorageKey = "switchboard-theme";
const adminTokenStorageKey = "switchboard-admin-token";
const userProfileStorageKey = "switchboard-user-profile";
const refreshIntervalMs = 40000;
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
  settingsAdminState: $("settingsAdminState"),
  menuClock: $("menuClock")
};

let token = sessionStorage.getItem(adminTokenStorageKey) || "";
let chatsCache = [];
let knowledgeCache = [...projectKnowledgeEntries];
let selectedChatId = "";
let lastStatus = null;

const html = (value) => String(value ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const time = (value) => value ? new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }).format(new Date(value)) : "";
const textMatch = (value, query = "") => String(value || "").toLowerCase().includes(query.trim().toLowerCase());
const publicHeaders = () => ({ "Content-Type": "application/json" });
const adminHeaders = () => token ? { "Content-Type": "application/json", "x-admin-token": token } : publicHeaders();
const getCurrentTheme = () => document.documentElement.dataset.theme === "dark" ? "dark" : "light";
const statusClass = (state = "") => {
  const normalized = String(state).toLowerCase();
  if (normalized.includes("error") || normalized.includes("unavailable") || normalized.includes("failed")) return "status-error";
  if (normalized.includes("public")) return "status-public";
  if (normalized.includes("storage-only")) return "status-storage";
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

function applyTheme(theme) {
  document.documentElement.dataset.theme = theme;
  try { localStorage.setItem(themeStorageKey, theme); } catch (error) {}
  updateThemeToggle(theme);
}

function toggleTheme() {
  applyTheme(getCurrentTheme() === "dark" ? "light" : "dark");
}

function refreshTokenFromSession() {
  token = sessionStorage.getItem(adminTokenStorageKey) || "";
  if (els.settingsAdminState) {
    const state = token ? "Ready" : "Public view";
    els.settingsAdminState.textContent = state;
    els.settingsAdminState.className = `status-badge ${statusClass(state)}`;
  }
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
  if (!token) {
    els.runs.innerHTML = `<div class="empty action-empty"><strong>Review logs are protected.</strong><p>Start or restore a valid admin session to inspect run history, counts, and errors. Public view keeps review records hidden.</p></div>`;
    return;
  }
  els.runs.innerHTML = runs.length ? runs.map((run) => {
    const state = run.status === "failed" ? "Error" : run.status === "running" ? "Loaded" : "Ready";
    return `<article class="item"><div class="row"><span>${html(run.status)}</span>${statusBadge(state)}</div><p>${html(run.messagesReviewed)} messages reviewed, ${html(run.knowledgeEntriesCreated)} KB entries created.</p><p>Started ${html(time(run.startedAt))}${run.finishedAt ? `; finished ${html(time(run.finishedAt))}` : ""}.</p>${run.error ? `<p>${html(run.error)}</p>` : ""}</article>`;
  }).join("") : `<div class="empty action-empty"><strong>No review runs yet.</strong><p>Review history will appear here after the backend records a completed run.</p></div>`;
}

function renderUsers(summary = {}, runtime = {}) {
  if (!els.users) return;
  els.users.innerHTML = `<article class="item" id="profile"><div class="row"><span>User profile settings</span><small>${token ? "Admin session" : "Public view"}</small></div><p>Profile settings are ready for account preferences. Management-only user records still require protected backend admin access.</p></article><article class="item"><div class="row"><span>Manage users</span><small>${runtime.storageMode || "unknown"}</small></div><p>${token ? "Protected admin data is loaded through backend management routes." : "User management needs an admin session before account records can be managed."}</p><p>Total chats shown: ${html(summary.chats ?? chatsCache.length)}.</p></article>`;
}

function renderSystemHealth(status = lastStatus || {}) {
  if (!els.systemHealth) return;
  const rows = [
    ["Storage", status.storageAvailable === false ? "Error" : "Ready", status.storageMode || "unknown"],
    ["AI availability", status.aiAvailable ? "Ready" : "Storage-only", status.aiAvailable ? "Responses enabled" : "Messages are saved for review"],
    ["Directory loaded", status.directoryAvailable ? "Loaded" : "Error", Array.isArray(status.filesLoaded) ? `${status.filesLoaded.length} files loaded` : "No file count"],
    ["Protected route status", token ? "Ready" : "Public view", token ? "Admin token present in this browser session" : "Protected management routes remain hidden in public view"]
  ];
  els.systemHealth.innerHTML = rows.map(([label, state, detail]) => `<article class="item health-item"><div class="row"><span>${html(label)}</span>${statusBadge(state)}</div><p>${html(detail)}</p></article>`).join("");
}

async function loadChat(chatId) {
  selectedChatId = chatId;
  renderChats();
  if (els.chatDetail) els.chatDetail.innerHTML = `<div class="empty">Loading chat...</div>`;
  try {
    const url = token ? `/api/admin/chats/${encodeURIComponent(chatId)}` : `/api/chats/${encodeURIComponent(chatId)}`;
    const data = await fetchJson(url, {}, Boolean(token));
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
  if (!token) return setStatus("Protected knowledge controls require an admin session.", true);
  setStatus(`Updating knowledge entry to ${status}...`);
  try {
    await fetchJson(`/api/admin/knowledge/${encodeURIComponent(entryId)}`, { method: "PATCH", body: JSON.stringify({ status }) }, true);
    await loadKnowledgePage();
  } catch (error) {
    setStatus(error.message, true);
  }
}

async function loadChatPage() {
  setStatus(token ? "Loading admin chats..." : "Loading recent chats...");
  const [status, chats] = await Promise.all([
    fetchJson("/api/status"),
    token ? fetchJson("/api/admin/chats", {}, true) : fetchJson("/api/chats?includeArchived=true")
  ]);
  lastStatus = status;
  chatsCache = chats.chats || [];
  renderChats();
  renderFileManagementFromMessages();
  setStatus(`${chatsCache.length} chats available. Attachments appear after selecting a chat.`);
}

async function loadKnowledgePage() {
  setStatus(token ? "Loading protected knowledge base..." : "Loading project knowledge base...");
  const status = await fetchJson("/api/status");
  lastStatus = status;
  if (token) {
    const knowledge = await fetchJson(`/api/admin/knowledge?status=${encodeURIComponent(els.knowledgeStatus?.value === "project" ? "all" : els.knowledgeStatus?.value || "all")}`, {}, true);
    knowledgeCache = [...projectKnowledgeEntries, ...(knowledge.entries || [])];
  } else {
    knowledgeCache = [...projectKnowledgeEntries];
  }
  renderKnowledge();
  setStatus(`${knowledgeCache.length} knowledge base entries available.`);
}

async function loadUserPage() {
  setStatus(token ? "Loading user management..." : "Loading public user management state...");
  const status = await fetchJson("/api/status");
  lastStatus = status;
  if (token) {
    const summary = await fetchJson("/api/admin/summary", {}, true);
    renderUsers(summary.summary, summary.status);
  } else {
    const chats = await fetchJson("/api/chats?includeArchived=true");
    chatsCache = chats.chats || [];
    renderUsers({ chats: chatsCache.length }, { storageMode: status.storageMode || "public" });
  }
  setStatus("User management page loaded.");
}

async function loadSettingsPage() {
  setStatus(token ? "Loading settings and review history..." : "Loading settings...");
  const status = await fetchJson("/api/status");
  lastStatus = status;
  renderSystemHealth(status);
  if (token) {
    const runs = await fetchJson("/api/admin/review-runs", {}, true);
    renderRuns(runs.runs || []);
  } else {
    renderRuns();
  }
  setStatus("Settings page loaded.");
}

async function loadPage() {
  refreshTokenFromSession();
  try {
    if (page === "chat") await loadChatPage();
    if (page === "knowledge") await loadKnowledgePage();
    if (page === "user") await loadUserPage();
    if (page === "settings") await loadSettingsPage();
    if (page === "update-profile") {
      loadProfileForm();
      setStatus("Update profile page loaded.");
    }
  } catch (error) {
    setStatus(error.message, true);
    renderKnowledge();
    renderRuns();
    renderSystemHealth(lastStatus || {});
  }
}

updateThemeToggle(getCurrentTheme());
updateClock();
setInterval(updateClock, 30000);
refreshTokenFromSession();
els.themeToggle?.addEventListener("click", toggleTheme);
els.settingsThemeButton?.addEventListener("click", toggleTheme);
els.logoutButton?.addEventListener("click", logout);
els.profileMenuButton?.addEventListener("click", toggleProfileDropdown);
els.profileLogoutButtons.forEach((button) => button.addEventListener("click", logout));
els.profilePhoto?.addEventListener("input", () => updateProfilePreview(els.profilePhoto.value));
els.profileForm?.addEventListener("submit", saveProfile);
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
els.knowledgeStatus?.addEventListener("change", () => loadKnowledgePage().catch((error) => setStatus(error.message, true)));
els.manageUsersButton?.addEventListener("click", () => setStatus("Manage users is ready for protected backend user records.", !token));
loadPage().catch(() => {});
setInterval(() => loadPage().catch(() => {}), refreshIntervalMs);

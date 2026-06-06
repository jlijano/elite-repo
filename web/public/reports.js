const reportsAdminTokenStorageKey = "switchboard-admin-token";
const reportsSessionTokenStorageKey = "switchboard-session-token";

const reportsEls = {
  status: document.getElementById("status"),
  menuClock: document.getElementById("menuClock"),
  profileMenuButton: document.getElementById("profileMenuButton"),
  profileDropdown: document.getElementById("profileDropdown"),
  profileLogoutButtons: document.querySelectorAll(".profile-logout"),
  reportsOverview: document.getElementById("reportsOverview"),
  logsList: document.getElementById("logsList"),
  reviewRunsReport: document.getElementById("reviewRunsReport"),
  systemHealthReport: document.getElementById("systemHealthReport"),
  userAuditReport: document.getElementById("userAuditReport"),
};

function setReportsStatus(message) {
  if (reportsEls.status) reportsEls.status.textContent = message;
}

function updateReportsClock() {
  if (!reportsEls.menuClock) return;
  reportsEls.menuClock.textContent = new Intl.DateTimeFormat(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date());
}

function closeReportsProfileDropdown() {
  if (!reportsEls.profileDropdown || !reportsEls.profileMenuButton) return;
  reportsEls.profileDropdown.hidden = true;
  reportsEls.profileMenuButton.setAttribute("aria-expanded", "false");
}

function toggleReportsProfileDropdown() {
  if (!reportsEls.profileDropdown || !reportsEls.profileMenuButton) return;
  const isOpen = !reportsEls.profileDropdown.hidden;
  reportsEls.profileDropdown.hidden = isOpen;
  reportsEls.profileMenuButton.setAttribute("aria-expanded", String(!isOpen));
}

async function logoutReportsUser() {
  const sessionToken = sessionStorage.getItem(reportsSessionTokenStorageKey);
  sessionStorage.removeItem(reportsAdminTokenStorageKey);
  sessionStorage.removeItem(reportsSessionTokenStorageKey);

  if (sessionToken) {
    try {
      await fetch("/api/auth/logout", { method: "POST", headers: { "x-session-token": sessionToken } });
    } catch (error) {
      console.warn("Session logout failed", error);
    }
  }

  window.location.href = "/login.html";
}

function reportsHeaders() {
  const headers = {};
  const adminToken = sessionStorage.getItem(reportsAdminTokenStorageKey);
  const sessionToken = sessionStorage.getItem(reportsSessionTokenStorageKey);
  if (adminToken) headers["x-admin-token"] = adminToken;
  if (sessionToken) headers["x-session-token"] = sessionToken;
  return headers;
}

async function reportsFetchJson(url, options = {}) {
  const response = await fetch(url, { ...options, headers: { ...reportsHeaders(), ...(options.headers || {}) } });
  if (!response.ok) throw new Error(`${url} returned ${response.status}`);
  return response.json();
}

function reportsStatusClass(state = "") {
  const normalized = String(state).toLowerCase();
  if (["ready", "ok", "available", "true"].includes(normalized)) return "status-ready";
  if (["loaded", "healthy", "success", "completed"].includes(normalized)) return "status-loaded";
  if (["error", "failed", "missing", "false"].includes(normalized)) return "status-error";
  if (["storage-only", "memory", "postgres"].includes(normalized)) return "status-storage";
  return "status-public";
}

function reportsBadge(label, state = label) {
  return `<small class="status-badge ${reportsStatusClass(state)}">${label}</small>`;
}

function escapeReportsText(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function formatReportsDate(value) {
  if (!value) return "No timestamp";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "No timestamp";
  return new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(date);
}

function protectedMessage(label) {
  return `<article class="item"><div class="row"><span>${label}</span>${reportsBadge("Protected", "public")}</div><p>Sign in with an owner/admin session to view this report data.</p></article>`;
}

function renderReviewRunItems(runs = []) {
  if (!runs.length) return protectedMessage("Review run history");
  return runs.slice(0, 20).map((run) => {
    const status = run.status || run.result || "completed";
    const count = run.knowledgeCreated ?? run.created_count ?? run.entriesCreated ?? 0;
    return `<article class="item"><div class="row"><span>${escapeReportsText(run.id || "Review run")}</span>${reportsBadge(escapeReportsText(status), status)}</div><p>${formatReportsDate(run.created_at || run.createdAt || run.started_at)} · ${escapeReportsText(count)} knowledge entries created</p></article>`;
  }).join("");
}

function renderAuditItems(audit = []) {
  if (!audit.length) return protectedMessage("User audit events");
  return audit.slice(0, 20).map((event) => {
    const action = event.action || event.event || "Audit event";
    const actor = event.actor_email || event.actorEmail || event.actor_user_id || "System";
    const target = event.target_email || event.targetEmail || event.target_user_id || "User record";
    return `<article class="item"><div class="row"><span>${escapeReportsText(action)}</span>${reportsBadge("Audit", "loaded")}</div><p>${formatReportsDate(event.created_at || event.createdAt)} · ${escapeReportsText(actor)} on ${escapeReportsText(target)}</p></article>`;
  }).join("");
}

function renderHealthItems(status = {}) {
  const rows = [
    ["Directory", status.directory?.status || status.directoryStatus || "loaded"],
    ["AI", status.ai?.status || status.aiStatus || "storage-only"],
    ["Storage", status.storage?.status || status.storageStatus || "loaded"],
    ["Admin routes", status.admin?.status || "protected"],
  ];
  return rows.map(([label, state]) => `<article class="health-card"><div class="row"><strong>${label}</strong>${reportsBadge(escapeReportsText(state), state)}</div><p>${label} status from /api/status.</p></article>`).join("");
}

function renderReportsOverview(status, summary, runs, audit) {
  if (!reportsEls.reportsOverview) return;
  const chats = summary?.counts?.chats ?? summary?.chatCount ?? "Protected";
  const knowledge = summary?.counts?.knowledge ?? summary?.knowledgeCount ?? "Protected";
  reportsEls.reportsOverview.innerHTML = `
    <article class="item"><div class="row"><span>Logs</span>${reportsBadge("Available", "ready")}</div><p>Combined review-run and user-audit activity.</p></article>
    <article class="item"><div class="row"><span>Review runs</span>${reportsBadge(String(runs.length || "Protected"), runs.length ? "loaded" : "public")}</div><p>Review workflow history and created knowledge counts.</p></article>
    <article class="item"><div class="row"><span>System health</span>${reportsBadge("Loaded", "loaded")}</div><p>Directory, AI, storage, and admin-route status.</p></article>
    <article class="item"><div class="row"><span>User audit</span>${reportsBadge(String(audit.length || "Protected"), audit.length ? "loaded" : "public")}</div><p>Recent user-management audit events.</p></article>
    <article class="item"><div class="row"><span>Protected summary</span>${reportsBadge(String(chats), typeof chats === "number" ? "loaded" : "public")}</div><p>Chats: ${escapeReportsText(chats)} · Knowledge: ${escapeReportsText(knowledge)} · Storage: ${escapeReportsText(status.storage?.status || status.storageStatus || "loaded")}</p></article>
  `;
}

function renderLogs(runs, audit) {
  if (!reportsEls.logsList) return;
  reportsEls.logsList.innerHTML = `${renderReviewRunItems(runs)}${renderAuditItems(audit)}`;
}

function renderReviewRuns(runs) {
  if (reportsEls.reviewRunsReport) reportsEls.reviewRunsReport.innerHTML = renderReviewRunItems(runs);
}

function renderSystemHealth(status) {
  if (reportsEls.systemHealthReport) reportsEls.systemHealthReport.innerHTML = renderHealthItems(status);
}

function renderUserAudit(audit) {
  if (reportsEls.userAuditReport) reportsEls.userAuditReport.innerHTML = renderAuditItems(audit);
}

async function loadReportsPage() {
  const page = document.body.dataset.adminPage;
  setReportsStatus("Loading report data...");
  let status = {};
  let summary = null;
  let runs = [];
  let audit = [];

  try {
    status = await reportsFetchJson("/api/status");
  } catch (error) {
    status = { storageStatus: "error" };
  }

  try {
    summary = await reportsFetchJson("/api/admin/summary");
  } catch (error) {
    summary = null;
  }

  try {
    const runData = await reportsFetchJson("/api/admin/review-runs");
    runs = Array.isArray(runData) ? runData : (runData.runs || runData.reviewRuns || []);
  } catch (error) {
    runs = [];
  }

  try {
    const auditData = await reportsFetchJson("/api/admin/user-audit-events");
    audit = Array.isArray(auditData) ? auditData : (auditData.events || auditData.auditEvents || []);
  } catch (error) {
    audit = [];
  }

  if (page === "reports") renderReportsOverview(status, summary, runs, audit);
  if (page === "logs") renderLogs(runs, audit);
  if (page === "review-runs") renderReviewRuns(runs);
  if (page === "system-health") renderSystemHealth(status);
  if (page === "user-audit") renderUserAudit(audit);
  setReportsStatus(summary ? "Reports loaded." : "Reports loaded. Protected details require an admin session.");
}

reportsEls.profileMenuButton?.addEventListener("click", toggleReportsProfileDropdown);
reportsEls.profileLogoutButtons?.forEach((button) => button.addEventListener("click", logoutReportsUser));
document.addEventListener("click", (event) => {
  if (!reportsEls.profileDropdown || !reportsEls.profileMenuButton) return;
  if (reportsEls.profileDropdown.hidden) return;
  if (!reportsEls.profileDropdown.contains(event.target) && !reportsEls.profileMenuButton.contains(event.target)) {
    closeReportsProfileDropdown();
  }
});

updateReportsClock();
setInterval(updateReportsClock, 60000);
loadReportsPage();

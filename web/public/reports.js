const reportsAdminTokenStorageKey = "switchboard-admin-token";
const reportsSessionTokenStorageKey = "switchboard-session-token";
const reportsNavGroups = {
  entra: {
    className: "entra-nav",
    label: "ENTRA",
    icon: "◉",
    itemLabel: "ENTRA navigation",
    pages: [
      { href: "/company.html", label: "Company", icon: "▣" },
      { href: "/department.html", label: "Department", icon: "◇" },
      { href: "/group.html", label: "Group", icon: "▦" },
      { href: "/user.html", label: "User", icon: "◉" }
    ]
  },
  playground: {
    className: "playground-nav",
    label: "PLAYGROUND",
    icon: "▦",
    itemLabel: "PLAYGROUND navigation",
    pages: [
      { href: "/playground.html", label: "Board", icon: "▦" },
      { href: "/playground-projects.html", label: "Projects", icon: "▣" },
      { href: "/playground-tasks.html", label: "Tasks", icon: "☑" },
      { href: "/playground-notes.html", label: "Notes", icon: "✎" },
      { href: "/playground-automation.html", label: "Automation", icon: "⚙" }
    ]
  },
  settings: {
    className: "settings-nav",
    label: "Settings",
    icon: "⚙",
    itemLabel: "Settings navigation",
    pages: [
      { href: "/settings.html", label: "Settings", icon: "⚙" },
      { href: "/builder.html", label: "Builder", icon: "🛠" }
    ]
  },
  reports: {
    className: "reports-nav",
    label: "REPORTS",
    icon: "▣",
    itemLabel: "REPORTS navigation",
    pages: [
      { href: "/reports.html", label: "Overview", icon: "▣" },
      { href: "/logs.html", label: "Logs", icon: "≡" },
      { href: "/review-runs.html", label: "Review runs", icon: "↻" },
      { href: "/system-health.html", label: "System health", icon: "✚" },
      { href: "/user-audit.html", label: "User audit", icon: "◎" }
    ]
  }
};
let reportsAuditCache = [];

function reportsCurrentPath() {
  return window.location.pathname || "/";
}

function createReportsNavIcon(value) {
  const icon = document.createElement("span");
  icon.className = "nav-icon";
  icon.setAttribute("aria-hidden", "true");
  icon.textContent = value;
  return icon;
}

function createReportsNavLink({ href, label, icon, className = "" }) {
  const path = reportsCurrentPath();
  const link = document.createElement("a");
  link.className = `nav-item${className ? ` ${className}` : ""}${href === path ? " active" : ""}`;
  link.href = href;
  link.dataset.navKey = href;
  if (href === path) link.setAttribute("aria-current", "page");
  link.append(createReportsNavIcon(icon), label);
  return link;
}

function createReportsBackLink() {
  const link = createReportsNavLink({ href: "/", label: "", icon: "←", className: "nav-back" });
  link.setAttribute("aria-label", "Back to chat");
  link.title = "Back to chat";
  const label = document.createElement("span");
  label.className = "sr-only";
  label.textContent = "Back to chat";
  link.appendChild(label);
  return link;
}

function createReportsNestedNav(group) {
  const path = reportsCurrentPath();
  const active = group.pages.some((page) => page.href === path);
  const details = document.createElement("details");
  details.className = `admin-section-list reports-nav ${group.className}`;
  details.open = true;

  const summary = document.createElement("summary");
  summary.className = `reports-summary${active ? " active" : ""}`;
  summary.setAttribute("aria-label", `${group.label} menu`);
  const label = document.createElement("span");
  label.className = "reports-summary-label";
  label.append(createReportsNavIcon(group.icon), group.label);
  const chevron = document.createElement("span");
  chevron.className = "reports-summary-chevron";
  chevron.setAttribute("aria-hidden", "true");
  chevron.textContent = "⌄";
  summary.append(label, chevron);

  const items = document.createElement("div");
  items.className = `reports-nav-items ${group.className}-items`;
  items.setAttribute("aria-label", group.itemLabel);
  group.pages.forEach((page) => items.appendChild(createReportsNavLink(page)));

  details.append(summary, items);
  return details;
}

function makeReportsBrandStatic() {
  const topbar = document.querySelector(".sidebar-topbar");
  const existingBrand = topbar?.querySelector(".brand-lockup");
  if (!topbar || !existingBrand || existingBrand.dataset.brandStatic === "true") return;
  const brand = document.createElement("div");
  brand.className = "brand-lockup brand-lockup-static";
  brand.dataset.brandStatic = "true";
  brand.setAttribute("role", "img");
  brand.setAttribute("aria-label", "Switchboard app");
  brand.append(createReportsNavIcon("⌘"), document.createTextNode("Switchboard"));
  brand.querySelector(".nav-icon").className = "brand-mark";
  existingBrand.replaceWith(brand);
}

function injectReportsSidebarStyles() {
  if (document.getElementById("canonicalSidebarNavStyles")) return;
  const style = document.createElement("style");
  style.id = "canonicalSidebarNavStyles";
  style.textContent = `
    .brand-lockup-static { cursor: default; user-select: none; }
    .admin-shell .nav-back { width: 42px; min-height: 38px; justify-content: center; padding: 0; border: 1px solid var(--sidebar-line); border-radius: 50%; }
    .admin-shell .nav-back .nav-icon { margin: 0; font-size: 1.15rem; }
    .admin-shell .nav-back .sr-only { position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px; overflow: hidden; clip: rect(0, 0, 0, 0); white-space: nowrap; border: 0; }
    .admin-shell .reports-summary.active { background: var(--sidebar-card); color: var(--sidebar-text); box-shadow: inset 3px 0 0 var(--primary); }
    .reports-summary-label { min-width: 0; display: inline-flex; align-items: center; gap: 12px; }
    .reports-summary-label .nav-icon { width: 22px; flex: 0 0 22px; color: var(--sidebar-muted); text-align: center; font-size: 1.05rem; }
    .reports-summary.active .reports-summary-label .nav-icon { color: var(--primary); }
    .reports-nav-items .nav-item { min-height: 36px; padding-left: 18px; font-size: 0.92rem; }
    @media (max-width: 900px) { .admin-shell .nav-back { width: 36px; min-height: 36px; } .reports-nav-items .nav-item { padding-left: 10px; } }
  `;
  document.head.appendChild(style);
}

function initReportsSidebarNav() {
  const nav = document.querySelector(".primary-nav");
  if (!nav) return;
  makeReportsBrandStatic();
  injectReportsSidebarStyles();
  nav.replaceChildren(
    createReportsBackLink(),
    createReportsNavLink({ href: "/chat.html", label: "Chat", icon: "□" }),
    createReportsNavLink({ href: "/knowledge.html", label: "Knowledge base", icon: "◇" }),
    createReportsNestedNav(reportsNavGroups.entra),
    createReportsNestedNav(reportsNavGroups.playground),
    createReportsNestedNav(reportsNavGroups.settings),
    createReportsNestedNav(reportsNavGroups.reports)
  );
}

initReportsSidebarNav();

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
  exportUserAuditReportButton: document.getElementById("exportUserAuditReportButton"),
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

function auditTimestamp(event = {}) {
  return event.created_at || event.createdAt || event.timestamp || "";
}

function auditActorName(event = {}) {
  return event.actorName || event.actor_name || event.actorEmail || event.actor_email || event.details?.actorName || event.details?.actorEmail || "System";
}

function auditActorEmail(event = {}) {
  return event.actorEmail || event.actor_email || event.details?.actorEmail || "";
}

function auditTargetName(event = {}) {
  return event.targetName || event.target_name || event.targetEmail || event.target_email || event.details?.targetName || event.details?.email || event.targetUserId || event.target_user_id || "User record";
}

function auditTargetEmail(event = {}) {
  return event.targetEmail || event.target_email || event.details?.targetEmail || event.details?.email || "";
}

function auditActionLabel(action = "") {
  const labels = {
    "user.login": "Logged in",
    "user.logout": "Logged out",
    "user.activity": "Recorded account activity",
    "user.updated": "Updated user record",
    "profile.updated": "Updated profile",
    "user.disabled": "Disabled user",
    "user.reactivated": "Reactivated user",
    "user.created": "Created user",
    "user.duration": "Recorded session duration"
  };
  return labels[action] || action || "Audit event";
}

function auditUpdateText(event = {}) {
  const action = event.action || event.event || "Audit event";
  const label = auditActionLabel(action);
  const target = auditTargetName(event);
  const fields = Array.isArray(event.details?.fields) && event.details.fields.length
    ? ` Fields: ${event.details.fields.join(", ")}.`
    : "";
  const status = event.details?.status ? ` Status: ${event.details.status}.` : "";
  const activity = event.details?.activity ? ` Activity: ${event.details.activity}.` : "";
  return `${label} for ${target}.${fields}${status}${activity}`;
}

function auditCsvEscape(value) {
  return `"${String(value || "").replace(/"/g, '""')}"`;
}

function renderReviewRunItems(runs = []) {
  if (!runs.length) return protectedMessage("Review run history");
  return runs.slice(0, 20).map((run) => {
    const status = run.status || run.result || "completed";
    const count = run.knowledgeCreated ?? run.created_count ?? run.entriesCreated ?? 0;
    return `<article class="item"><div class="row"><span>${escapeReportsText(run.id || "Review run")}</span>${reportsBadge(escapeReportsText(status), status)}</div><p>${formatReportsDate(run.created_at || run.createdAt || run.started_at)} - ${escapeReportsText(count)} knowledge entries created</p></article>`;
  }).join("");
}

function renderAuditItems(audit = []) {
  if (!audit.length) return protectedMessage("User audit events");
  return audit.slice(0, 20).map((event) => {
    return `<article class="item"><div class="row"><span>${escapeReportsText(auditActorName(event))}</span>${reportsBadge("Audit", "loaded")}</div><p>${escapeReportsText(auditUpdateText(event))}</p><p>${formatReportsDate(auditTimestamp(event))}</p></article>`;
  }).join("");
}

function renderAuditTable(audit = []) {
  if (!audit.length) return protectedMessage("User audit events");
  const rows = audit.slice(0, 100).map((event) => {
    const actorName = auditActorName(event);
    const actorEmail = auditActorEmail(event);
    return `<tr><td><span class="audit-user-name">${escapeReportsText(actorName)}</span>${actorEmail ? `<span class="audit-user-email">${escapeReportsText(actorEmail)}</span>` : ""}</td><td class="update-cell">${escapeReportsText(auditUpdateText(event))}</td><td class="muted-cell">${escapeReportsText(formatReportsDate(auditTimestamp(event)))}</td></tr>`;
  }).join("");
  return `<div class="audit-table-wrap"><table class="audit-table"><thead><tr><th>User</th><th>Update</th><th>Timestamp</th></tr></thead><tbody>${rows}</tbody></table></div>`;
}

function exportUserAuditReport() {
  if (!reportsAuditCache.length) {
    setReportsStatus("No user audit events available to export.");
    return;
  }
  const rows = reportsAuditCache.map((event) => [
    auditActorName(event),
    auditActorEmail(event),
    auditUpdateText(event),
    formatReportsDate(auditTimestamp(event)),
    auditTimestamp(event),
    auditTargetName(event),
    auditTargetEmail(event)
  ].map(auditCsvEscape).join(","));
  const csv = ["User,User email,Update,Timestamp,Raw timestamp,Target,Target email", ...rows].join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `user-audit-report-${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
  setReportsStatus("User audit report exported.");
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
    <article class="item"><div class="row"><span>User audit</span>${reportsBadge(String(audit.length || "Protected"), audit.length ? "loaded" : "public")}</div><p>User, update, and timestamp for recent account activity.</p></article>
    <article class="item"><div class="row"><span>Protected summary</span>${reportsBadge(String(chats), typeof chats === "number" ? "loaded" : "public")}</div><p>Chats: ${escapeReportsText(chats)} - Knowledge: ${escapeReportsText(knowledge)} - Storage: ${escapeReportsText(status.storage?.status || status.storageStatus || "loaded")}</p></article>
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
  if (reportsEls.userAuditReport) reportsEls.userAuditReport.innerHTML = renderAuditTable(audit);
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

  reportsAuditCache = audit;
  if (page === "reports") renderReportsOverview(status, summary, runs, audit);
  if (page === "logs") renderLogs(runs, audit);
  if (page === "review-runs") renderReviewRuns(runs);
  if (page === "system-health") renderSystemHealth(status);
  if (page === "user-audit") renderUserAudit(audit);
  setReportsStatus(summary ? "Reports loaded." : "Reports loaded. Protected details require an admin session.");
}

reportsEls.profileMenuButton?.addEventListener("click", toggleReportsProfileDropdown);
reportsEls.profileLogoutButtons?.forEach((button) => button.addEventListener("click", logoutReportsUser));
reportsEls.exportUserAuditReportButton?.addEventListener("click", exportUserAuditReport);
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
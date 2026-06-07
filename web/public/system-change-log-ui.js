(() => {
  if (document.body?.dataset.adminPage !== "logs") return;

  const adminTokenStorageKey = "switchboard-admin-token";
  const sessionTokenStorageKey = "switchboard-session-token";

  function headers() {
    const result = {};
    const adminToken = sessionStorage.getItem(adminTokenStorageKey);
    const sessionToken = sessionStorage.getItem(sessionTokenStorageKey);
    if (adminToken) result["x-admin-token"] = adminToken;
    if (sessionToken) result["x-session-token"] = sessionToken;
    return result;
  }

  function escapeText(value) {
    return String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function formatDate(value) {
    const date = new Date(value || Date.now());
    if (Number.isNaN(date.getTime())) return "No timestamp";
    return new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(date);
  }

  function formatChange(change = {}) {
    return `A new feature has been ${change.action || "Updated"} | ${change.module || "System"}`;
  }

  function renderSystemChanges(changes = []) {
    if (!changes.length) {
      return `<article class="item"><div class="row"><span>System Change Log</span>${reportsBadge("Ready", "ready")}</div><p>No system changes logged yet.</p></article>`;
    }
    return changes.slice(0, 30).map((change) => `
      <article class="item system-change-item">
        <div class="row"><span>${escapeText(formatChange(change))}</span>${reportsBadge(escapeText(change.action || "Updated"), change.action || "updated")}</div>
        <p>${escapeText(change.summary || "System change")}</p>
        <p>${escapeText(formatDate(change.createdAt))}</p>
      </article>
    `).join("");
  }

  async function loadSystemChanges() {
    const response = await fetch("/api/admin/system-change-log?limit=30", { headers: headers() });
    if (!response.ok) throw new Error("System change log requires an admin session.");
    const data = await response.json();
    return Array.isArray(data.changes) ? data.changes : [];
  }

  const originalRenderLogs = typeof renderLogs === "function" ? renderLogs : null;
  if (originalRenderLogs) {
    renderLogs = function renderLogsWithSystemChanges(runs, audit) {
      originalRenderLogs(runs, audit);
      const list = document.getElementById("logsList");
      if (!list) return;
      const existing = list.innerHTML;
      list.innerHTML = `<article class="item"><div class="row"><span>System Change Log</span>${reportsBadge("Loading", "storage")}</div><p>Loading system change notifications...</p></article>${existing}`;
      loadSystemChanges()
        .then((changes) => {
          list.innerHTML = `${renderSystemChanges(changes)}${existing}`;
        })
        .catch((error) => {
          list.innerHTML = `<article class="item"><div class="row"><span>System Change Log</span>${reportsBadge("Protected", "public")}</div><p>${escapeText(error.message)}</p></article>${existing}`;
        });
    };
  }
})();

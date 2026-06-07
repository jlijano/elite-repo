(() => {
  if (document.body?.dataset.adminPage !== "logs") return;

  const adminTokenStorageKey = "switchboard-admin-token";
  const sessionTokenStorageKey = "switchboard-session-token";

  function headers(extra = {}) {
    const result = { ...extra };
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

  function statusText(change = {}) {
    if (change.archivedAt) return "Archived";
    if (change.revertRequestedAt) return "Revert requested";
    if (change.implementedAt) return "Implemented";
    return "Ready";
  }

  function installReleaseControlStyles() {
    if (document.getElementById("systemChangeControlStyles")) return;
    const style = document.createElement("style");
    style.id = "systemChangeControlStyles";
    style.textContent = `
      .system-change-control-card {
        margin-top: 18px;
        border-color: var(--line);
      }
      .system-change-control-list {
        display: grid;
        gap: 10px;
        margin-top: 14px;
      }
      .system-change-control-item {
        display: grid;
        grid-template-columns: minmax(0, 1fr) auto;
        gap: 12px;
        align-items: center;
        padding: 12px;
        border: 1px solid var(--line);
        border-radius: var(--radius);
        background: color-mix(in srgb, var(--panel), transparent 8%);
      }
      .system-change-control-item strong,
      .system-change-control-item span,
      .system-change-control-item small {
        display: block;
      }
      .system-change-control-item strong {
        line-height: 1.35;
      }
      .system-change-control-item span {
        margin-top: 4px;
        color: var(--muted);
        font-size: 0.86rem;
        line-height: 1.35;
      }
      .system-change-control-item small {
        margin-top: 5px;
        color: var(--muted);
        font-size: 0.75rem;
        font-weight: 750;
      }
      .system-change-control-actions {
        display: flex;
        flex-wrap: wrap;
        justify-content: flex-end;
        gap: 6px;
      }
      .system-change-control-actions button {
        min-height: 34px;
        padding: 0 10px;
        border: 1px solid var(--line);
        border-radius: var(--radius);
        background: var(--panel-soft);
        color: var(--text);
        font-weight: 850;
      }
      .system-change-control-actions button:hover:not(:disabled),
      .system-change-control-actions button:focus-visible:not(:disabled) {
        border-color: var(--primary);
        background: var(--sidebar-card);
      }
      .system-change-control-actions button:disabled {
        opacity: 0.55;
      }
      .system-change-control-message {
        margin: 10px 0 0;
        color: var(--muted);
        font-size: 0.84rem;
      }
      @media (max-width: 820px) {
        .system-change-control-item {
          grid-template-columns: 1fr;
        }
        .system-change-control-actions {
          justify-content: flex-start;
        }
      }
    `;
    document.head.appendChild(style);
  }

  function renderSystemChanges(changes = []) {
    if (!changes.length) {
      return `<article class="item"><div class="row"><span>System Change Log</span>${reportsBadge("Ready", "ready")}</div><p>No system changes logged yet.</p></article>`;
    }
    return changes.slice(0, 30).map((change) => `
      <article class="item system-change-item">
        <div class="row"><span>${escapeText(formatChange(change))}</span>${reportsBadge(escapeText(statusText(change)), change.archivedAt ? "public" : change.revertRequestedAt ? "storage" : change.implementedAt ? "loaded" : "ready")}</div>
        <p>${escapeText(change.summary || "System change")}</p>
        <p>${escapeText(formatDate(change.createdAt))}</p>
      </article>
    `).join("");
  }

  function renderReleaseControl(changes = []) {
    const box = document.getElementById("systemChangeControlBox");
    if (!box) return;
    const active = changes.filter((change) => !change.archivedAt).slice(0, 12);
    if (!active.length) {
      box.innerHTML = `<div class="card-head"><div><p class="section-kicker">Release control</p><h2>GitHub Read-Back and System Changes</h2><p class="card-subtitle">No active shipped-change notifications. Archived notifications are hidden from the bell but the shipped change remains intact.</p></div></div>`;
      return;
    }
    box.innerHTML = `
      <div class="card-head">
        <div>
          <p class="section-kicker">Release control</p>
          <h2>GitHub Read-Back and System Changes</h2>
          <p class="card-subtitle">Track shipped features before production handoff. Archive purges only the notification record; revert requests require review before code changes.</p>
        </div>
      </div>
      <p class="system-change-control-message" id="systemChangeControlMessage">${active.length} active change${active.length === 1 ? "" : "s"} available.</p>
      <div class="system-change-control-list">
        ${active.map((change) => `
          <article class="system-change-control-item" data-change-id="${escapeText(change.id)}">
            <div>
              <strong>${escapeText(formatChange(change))}</strong>
              <span>${escapeText(change.summary || "System change")}</span>
              <small>${escapeText(statusText(change))} | ${escapeText(formatDate(change.createdAt))}</small>
            </div>
            <div class="system-change-control-actions">
              <button type="button" data-system-change-action="archive">Archive notification</button>
              <button type="button" data-system-change-action="revert-request"${change.revertRequestedAt ? " disabled" : ""}>Request revert</button>
              <button type="button" data-system-change-action="implement"${change.implementedAt ? " disabled" : ""}>Mark implemented</button>
            </div>
          </article>
        `).join("")}
      </div>
    `;
    box.querySelectorAll("button[data-system-change-action]").forEach((button) => button.addEventListener("click", handleChangeAction));
  }

  async function loadSystemChanges(options = {}) {
    const includeArchived = options.includeArchived ? "&includeArchived=true" : "";
    const response = await fetch(`/api/admin/system-change-log?limit=30${includeArchived}`, { headers: headers() });
    if (!response.ok) throw new Error("System change log requires an admin session.");
    const data = await response.json();
    return Array.isArray(data.changes) ? data.changes : [];
  }

  async function postChangeAction(changeId, action) {
    const response = await fetch(`/api/admin/system-change-log/${encodeURIComponent(changeId)}/${action}`, {
      method: "POST",
      headers: headers({ "Content-Type": "application/json" }),
      body: "{}"
    });
    if (!response.ok) throw new Error("The release-control action could not be saved.");
    return response.json();
  }

  async function handleChangeAction(event) {
    const button = event.currentTarget;
    const item = button.closest("[data-change-id]");
    const changeId = item?.dataset.changeId;
    const action = button.dataset.systemChangeAction;
    const message = document.getElementById("systemChangeControlMessage");
    if (!changeId || !action) return;
    if (action === "revert-request" && !window.confirm("Create a revert request for review? This will not change production code yet.")) return;
    button.disabled = true;
    if (message) message.textContent = "Saving release-control action...";
    try {
      await postChangeAction(changeId, action);
      const changes = await loadSystemChanges({ includeArchived: true });
      renderReleaseControl(changes);
      const list = document.getElementById("logsList");
      if (list) list.innerHTML = `${renderSystemChanges(changes.filter((change) => !change.archivedAt))}${list.dataset.baseLogs || ""}`;
    } catch (error) {
      button.disabled = false;
      if (message) message.textContent = error.message;
    }
  }

  function ensureReleaseControlBox() {
    installReleaseControlStyles();
    if (document.getElementById("systemChangeControlBox")) return;
    const logsPage = document.getElementById("logsPage");
    if (!logsPage) return;
    const box = document.createElement("section");
    box.className = "admin-card wide system-change-control-card";
    box.id = "systemChangeControlBox";
    box.innerHTML = `<div class="card-head"><div><p class="section-kicker">Release control</p><h2>GitHub Read-Back and System Changes</h2><p class="card-subtitle">Loading shipped-change controls...</p></div></div>`;
    logsPage.insertAdjacentElement("afterend", box);
  }

  const originalRenderLogs = typeof renderLogs === "function" ? renderLogs : null;
  if (originalRenderLogs) {
    renderLogs = function renderLogsWithSystemChanges(runs, audit) {
      originalRenderLogs(runs, audit);
      ensureReleaseControlBox();
      const list = document.getElementById("logsList");
      if (!list) return;
      const existing = list.innerHTML;
      list.dataset.baseLogs = existing;
      list.innerHTML = `<article class="item"><div class="row"><span>System Change Log</span>${reportsBadge("Loading", "storage")}</div><p>Loading system change notifications...</p></article>${existing}`;
      loadSystemChanges({ includeArchived: true })
        .then((changes) => {
          list.dataset.baseLogs = existing;
          list.innerHTML = `${renderSystemChanges(changes.filter((change) => !change.archivedAt))}${existing}`;
          renderReleaseControl(changes);
        })
        .catch((error) => {
          list.innerHTML = `<article class="item"><div class="row"><span>System Change Log</span>${reportsBadge("Protected", "public")}</div><p>${escapeText(error.message)}</p></article>${existing}`;
          renderReleaseControl([]);
        });
    };
  }
})();

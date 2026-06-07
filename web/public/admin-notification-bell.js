(() => {
  const headerActions = document.querySelector(".admin-header .header-actions");
  if (!headerActions || document.querySelector(".notification-bell-button")) return;

  const adminTokenStorageKey = "switchboard-admin-token";
  const sessionTokenStorageKey = "switchboard-session-token";

  const style = document.createElement("style");
  style.id = "notificationBellStyles";
  style.textContent = `
    .notification-bell-wrap {
      position: relative;
      display: inline-grid;
      place-items: center;
      flex: 0 0 auto;
    }
    .notification-bell-button {
      position: relative;
      width: 38px;
      height: 38px;
      min-height: 38px;
      flex: 0 0 38px;
      display: inline-grid;
      place-items: center;
      padding: 0 !important;
      border: 1px solid var(--line);
      border-radius: 50%;
      background: var(--panel-soft);
      color: var(--text);
      cursor: pointer;
    }
    .notification-bell-button:hover,
    .notification-bell-button:focus-visible,
    .notification-bell-button[aria-expanded="true"] {
      border-color: var(--primary);
      background: var(--sidebar-card);
      outline: 3px solid var(--focus-ring);
      outline-offset: 2px;
    }
    .notification-bell-button svg {
      width: 18px;
      height: 18px;
      stroke: currentColor;
      stroke-width: 2;
      stroke-linecap: round;
      stroke-linejoin: round;
      fill: none;
      pointer-events: none;
    }
    .notification-bell-indicator {
      position: absolute;
      top: 8px;
      right: 9px;
      width: 8px;
      height: 8px;
      border: 2px solid var(--panel-soft);
      border-radius: 50%;
      background: var(--primary);
      box-shadow: 0 0 0 2px rgba(16, 163, 127, 0.18);
      pointer-events: none;
    }
    .notification-bell-button:hover .notification-bell-indicator,
    .notification-bell-button:focus-visible .notification-bell-indicator,
    .notification-bell-button[aria-expanded="true"] .notification-bell-indicator {
      border-color: var(--sidebar-card);
    }
    .notification-dropdown {
      position: absolute;
      top: calc(100% + 10px);
      right: 0;
      z-index: 70;
      width: min(380px, calc(100vw - 28px));
      max-height: min(520px, calc(100vh - 96px));
      display: grid;
      grid-template-rows: auto minmax(0, 1fr) auto;
      overflow: hidden;
      border: 1px solid var(--line);
      border-radius: var(--radius);
      background: var(--panel);
      color: var(--text);
      box-shadow: 0 22px 60px rgba(0, 0, 0, 0.34);
    }
    .notification-dropdown[hidden] {
      display: none;
    }
    .notification-dropdown-head,
    .notification-dropdown-foot {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      padding: 12px 14px;
      border-bottom: 1px solid var(--line);
    }
    .notification-dropdown-foot {
      border-top: 1px solid var(--line);
      border-bottom: 0;
    }
    .notification-dropdown h2 {
      margin: 0;
      font-size: 0.95rem;
      line-height: 1.2;
    }
    .notification-dropdown small {
      color: var(--muted);
      font-size: 0.76rem;
      font-weight: 750;
    }
    .notification-list {
      min-height: 88px;
      max-height: 390px;
      overflow-y: auto;
      display: grid;
      gap: 0;
      padding: 4px;
    }
    .notification-item {
      display: grid;
      gap: 5px;
      padding: 10px;
      border-radius: calc(var(--radius) - 2px);
      border: 1px solid transparent;
    }
    .notification-item:hover,
    .notification-item:focus-within {
      border-color: var(--line);
      background: var(--panel-soft);
    }
    .notification-item strong {
      font-size: 0.86rem;
      line-height: 1.35;
    }
    .notification-item span {
      color: var(--muted);
      font-size: 0.76rem;
      line-height: 1.3;
    }
    .notification-empty {
      padding: 20px 12px;
      color: var(--muted);
      font-size: 0.86rem;
      line-height: 1.4;
      text-align: center;
    }
    .notification-log-link {
      color: var(--primary);
      font-size: 0.82rem;
      font-weight: 850;
      text-decoration: none;
    }
    .notification-log-link:hover,
    .notification-log-link:focus-visible {
      text-decoration: underline;
    }
    @media (max-width: 520px) {
      .notification-bell-button {
        width: 34px;
        height: 34px;
        min-height: 34px;
        flex-basis: 34px;
      }
      .notification-bell-button svg {
        width: 16px;
        height: 16px;
      }
      .notification-bell-indicator {
        top: 7px;
        right: 8px;
      }
    }
    @media (max-width: 340px), (max-height: 420px) and (max-width: 740px) {
      .notification-bell-button {
        width: 32px;
        height: 32px;
        min-height: 32px;
        flex-basis: 32px;
      }
      .notification-bell-button svg {
        width: 15px;
        height: 15px;
      }
      .notification-bell-indicator {
        width: 7px;
        height: 7px;
      }
    }
  `;
  document.head.appendChild(style);

  function escapeText(value) {
    return String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function notificationHeaders() {
    const headers = {};
    const adminToken = sessionStorage.getItem(adminTokenStorageKey);
    const sessionToken = sessionStorage.getItem(sessionTokenStorageKey);
    if (adminToken) headers["x-admin-token"] = adminToken;
    if (sessionToken) headers["x-session-token"] = sessionToken;
    return headers;
  }

  function formatDate(value) {
    const date = new Date(value || Date.now());
    if (Number.isNaN(date.getTime())) return "No timestamp";
    return new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(date);
  }

  function formatNotification(change = {}) {
    const action = change.action || "Updated";
    const module = change.module || "System";
    return `A new feature has been ${action} | ${module}`;
  }

  const wrapper = document.createElement("div");
  wrapper.className = "notification-bell-wrap";
  wrapper.innerHTML = `
    <button class="notification-bell-button" type="button" title="Notifications" aria-label="Open notifications" aria-haspopup="true" aria-expanded="false" aria-controls="notificationDropdown">
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 7h18s-3 0-3-7"></path>
        <path d="M13.7 21a2 2 0 0 1-3.4 0"></path>
      </svg>
      <span class="notification-bell-indicator" aria-hidden="true"></span>
    </button>
    <section class="notification-dropdown" id="notificationDropdown" aria-label="Notifications" hidden>
      <div class="notification-dropdown-head"><div><h2>Notifications</h2><small id="notificationCount">System changes</small></div></div>
      <div class="notification-list" id="notificationList"><p class="notification-empty">Loading notifications...</p></div>
      <div class="notification-dropdown-foot"><small>System change log</small><a class="notification-log-link" href="/logs.html">Open Logs</a></div>
    </section>
  `;

  const button = wrapper.querySelector(".notification-bell-button");
  const dropdown = wrapper.querySelector(".notification-dropdown");
  const list = wrapper.querySelector("#notificationList");
  const count = wrapper.querySelector("#notificationCount");

  function renderNotifications(changes = []) {
    count.textContent = `${changes.length} recent ${changes.length === 1 ? "change" : "changes"}`;
    if (!changes.length) {
      list.innerHTML = '<p class="notification-empty">No system changes logged yet.</p>';
      return;
    }
    list.innerHTML = changes.map((change) => `
      <article class="notification-item">
        <strong>${escapeText(formatNotification(change))}</strong>
        <span>${escapeText(change.summary || "System change")} | ${escapeText(formatDate(change.createdAt))}</span>
      </article>
    `).join("");
  }

  async function loadNotifications() {
    list.innerHTML = '<p class="notification-empty">Loading notifications...</p>';
    try {
      const response = await fetch("/api/admin/system-change-log?limit=12", { headers: notificationHeaders() });
      if (!response.ok) throw new Error("Notifications require an admin session.");
      const data = await response.json();
      renderNotifications(Array.isArray(data.changes) ? data.changes : []);
    } catch (error) {
      count.textContent = "Unavailable";
      list.innerHTML = `<p class="notification-empty">${escapeText(error.message || "Notifications could not be loaded.")}</p>`;
    }
  }

  function closeDropdown() {
    dropdown.hidden = true;
    button.setAttribute("aria-expanded", "false");
  }

  function openDropdown() {
    dropdown.hidden = false;
    button.setAttribute("aria-expanded", "true");
    loadNotifications();
  }

  button.addEventListener("click", (event) => {
    event.stopPropagation();
    if (dropdown.hidden) openDropdown();
    else closeDropdown();
  });

  document.addEventListener("click", (event) => {
    if (dropdown.hidden || wrapper.contains(event.target)) return;
    closeDropdown();
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") closeDropdown();
  });

  const profileMenu = headerActions.querySelector(".profile-menu");
  if (profileMenu) headerActions.insertBefore(wrapper, profileMenu);
  else headerActions.appendChild(wrapper);
})();

(function polishUserManagementPage() {
  if (document.body?.dataset?.adminPage !== "user") return;

  const tableLabels = ["", "Full Name", "Email", "Username", "Status", "Role", "Joined Date", "Last Active", "Actions"];
  const roleOptions = ["owner", "admin", "member", "viewer"];
  const statusOptions = ["active", "invited", "disabled"];

  function addStyles() {
    if (document.getElementById("userManagementPolishStyles")) return;
    const style = document.createElement("style");
    style.id = "userManagementPolishStyles";
    style.textContent = `
      body[data-admin-page="user"] #userDialog {
        width: min(800px, calc(100vw - 32px));
        max-height: min(800px, calc(100dvh - 32px));
        padding: 0;
        overflow: hidden;
      }

      body[data-admin-page="user"] #userDialog .modal-content {
        display: grid;
        grid-template-rows: auto minmax(0, 1fr);
        max-height: min(800px, calc(100dvh - 32px));
      }

      body[data-admin-page="user"] #userDialog .user-dialog-body {
        min-height: 0;
        overflow: auto;
      }

      body[data-admin-page="user"] #userDialog .management-form {
        align-items: start;
      }

      body[data-admin-page="user"] #userDialog .management-form > label {
        min-width: 0;
      }

      body[data-admin-page="user"] #userDialog input,
      body[data-admin-page="user"] #userDialog select {
        width: 100%;
        box-sizing: border-box;
      }

      body[data-admin-page="user"] #userDialog .form-actions {
        position: sticky;
        bottom: 0;
        z-index: 1;
        margin: 4px -20px -20px;
        padding: 14px 20px 0;
        background: linear-gradient(180deg, rgba(0, 0, 0, 0), var(--panel) 28%);
      }

      body[data-admin-page="user"] #userManagementPage {
        background: linear-gradient(180deg, rgba(255,255,255,0.035), rgba(255,255,255,0.012)), var(--panel);
      }

      body[data-admin-page="user"] #userManagementPage .card-head {
        gap: 16px;
        padding: 14px 16px;
        background: transparent;
      }

      body[data-admin-page="user"] .user-toolbar {
        flex: 1 1 auto;
        justify-content: flex-end;
        gap: 14px;
        min-width: min(880px, 100%);
      }

      body[data-admin-page="user"] .user-search-shell {
        position: relative;
        flex: 1 1 280px;
        max-width: 450px;
      }

      body[data-admin-page="user"] .user-search-shell::before {
        content: "";
        position: absolute;
        left: 18px;
        top: 50%;
        width: 14px;
        height: 14px;
        border: 2px solid currentColor;
        border-radius: 50%;
        color: var(--muted);
        transform: translateY(-55%);
        pointer-events: none;
      }

      body[data-admin-page="user"] .user-search-shell::after {
        content: "";
        position: absolute;
        left: 31px;
        top: calc(50% + 8px);
        width: 8px;
        height: 2px;
        border-radius: 999px;
        background: var(--muted);
        transform: rotate(45deg);
        transform-origin: left center;
        pointer-events: none;
      }

      body[data-admin-page="user"] .user-search-shell input {
        max-width: none;
        min-height: 58px;
        padding-left: 58px;
        border-radius: 999px;
        border-color: color-mix(in srgb, var(--line) 78%, white 22%);
        background: rgba(10, 16, 22, 0.54);
        box-shadow: inset 0 1px 0 rgba(255,255,255,0.04), 0 14px 34px rgba(0,0,0,0.16);
        color: var(--text);
        font-size: 1rem;
      }

      body[data-admin-page="user"] .user-filter-row,
      body[data-admin-page="user"] .user-toolbar-actions {
        display: inline-flex;
        align-items: center;
        gap: 12px;
      }

      body[data-admin-page="user"] .user-filter-control {
        position: relative;
        flex: 0 0 auto;
      }

      body[data-admin-page="user"] .user-filter-control select {
        width: auto;
        min-width: 150px;
        min-height: 58px;
        padding: 0 42px 0 48px;
        border-radius: 999px;
        border-color: color-mix(in srgb, var(--line) 82%, white 18%);
        background: rgba(10, 16, 22, 0.56);
        color: var(--text);
        font-weight: 750;
        appearance: none;
        cursor: pointer;
      }

      body[data-admin-page="user"] .user-filter-control::before {
        position: absolute;
        left: 18px;
        top: 50%;
        color: var(--text);
        font-size: 1.08rem;
        transform: translateY(-50%);
        pointer-events: none;
      }

      body[data-admin-page="user"] .user-filter-control.role-filter::before { content: "@"; }
      body[data-admin-page="user"] .user-filter-control.status-filter::before { content: "o"; }
      body[data-admin-page="user"] .user-filter-control.date-filter::before { content: "#"; }

      body[data-admin-page="user"] .user-filter-control::after {
        content: "⌄";
        position: absolute;
        right: 18px;
        top: 50%;
        color: var(--muted);
        transform: translateY(-54%);
        pointer-events: none;
      }

      body[data-admin-page="user"] .user-toolbar-actions button,
      body[data-admin-page="user"] #manageUsersButton {
        min-height: 58px;
        border-radius: 999px;
        padding-inline: 22px;
      }

      body[data-admin-page="user"] #manageUsersButton {
        border-color: rgba(45, 108, 223, 0.72);
        background: linear-gradient(180deg, #356fe9, #1e55d8);
        color: white;
        box-shadow: 0 18px 40px rgba(27, 81, 210, 0.28);
      }

      body[data-admin-page="user"] #exportUsersButton {
        border-color: color-mix(in srgb, var(--line) 72%, white 28%);
        background: rgba(10, 16, 22, 0.52);
      }

      body[data-admin-page="user"] .users-table-wrap {
        overflow-x: auto;
        padding: 0 14px 14px;
      }

      body[data-admin-page="user"] .users-table {
        min-width: 1280px;
        border-collapse: separate;
        border-spacing: 0;
        overflow: hidden;
        border: 1px solid color-mix(in srgb, var(--line) 82%, white 18%);
        border-radius: 8px;
        background: rgba(8, 13, 18, 0.68);
      }

      body[data-admin-page="user"] .users-table thead th {
        height: 58px;
        padding: 0 26px;
        border-bottom: 1px solid color-mix(in srgb, var(--line) 76%, white 24%);
        background: rgba(14, 20, 28, 0.74);
        color: color-mix(in srgb, var(--text) 88%, var(--muted) 12%);
        font-size: 1rem;
        font-weight: 650;
        letter-spacing: 0;
        text-transform: none;
        white-space: nowrap;
      }

      body[data-admin-page="user"] .users-table thead th:not(.select-column)::after {
        content: "↕";
        float: right;
        margin-left: 12px;
        color: var(--muted);
        font-size: 0.9rem;
      }

      body[data-admin-page="user"] .users-table th,
      body[data-admin-page="user"] .users-table td {
        border-bottom: 1px solid color-mix(in srgb, var(--line) 76%, white 18%);
      }

      body[data-admin-page="user"] .users-table tbody tr:last-child td { border-bottom: 0; }
      body[data-admin-page="user"] .users-table tbody tr:hover { background: rgba(255,255,255,0.035); }
      body[data-admin-page="user"] .users-table tr.active td { box-shadow: none; background: rgba(16, 163, 127, 0.05); }

      body[data-admin-page="user"] .users-table td {
        height: 56px;
        padding: 10px 26px;
        color: color-mix(in srgb, var(--text) 92%, white 8%);
        font-size: 1rem;
        vertical-align: middle;
        white-space: nowrap;
      }

      body[data-admin-page="user"] .select-column,
      body[data-admin-page="user"] .select-cell {
        width: 54px;
        padding-inline: 24px 10px !important;
        text-align: center;
      }

      body[data-admin-page="user"] .user-row-checkbox {
        width: 20px;
        height: 20px;
        min-height: 20px;
        accent-color: #2f6df0;
        cursor: pointer;
      }

      body[data-admin-page="user"] .user-name-cell {
        display: flex;
        align-items: center;
        gap: 16px;
        min-width: 230px;
      }

      body[data-admin-page="user"] .user-avatar {
        width: 40px;
        height: 40px;
        flex: 0 0 40px;
        display: grid;
        place-items: center;
        overflow: hidden;
        border-radius: 50%;
        background: linear-gradient(135deg, #e7e7e4, #92979b);
        color: #111827;
        font-size: 0.82rem;
        font-weight: 900;
      }

      body[data-admin-page="user"] .user-avatar img {
        width: 100%;
        height: 100%;
        object-fit: cover;
      }

      body[data-admin-page="user"] .user-full-name {
        color: var(--text);
        font-weight: 750;
      }

      body[data-admin-page="user"] .users-table .muted-cell {
        color: color-mix(in srgb, var(--text) 86%, var(--muted) 14%);
      }

      body[data-admin-page="user"] .users-table .status-badge,
      body[data-admin-page="user"] .users-table .user-status-pill {
        min-width: 96px;
        min-height: 38px;
        justify-content: center;
        border: 0;
        border-radius: 999px;
        color: white !important;
        font-size: 0.95rem;
        font-weight: 800;
        text-transform: capitalize;
      }

      body[data-admin-page="user"] .users-table .status-active { background: linear-gradient(180deg, #2ea642, #18772d); }
      body[data-admin-page="user"] .users-table .status-invited { background: linear-gradient(180deg, #1d55c9, #13357f); }
      body[data-admin-page="user"] .users-table .status-disabled { background: linear-gradient(180deg, #48505a, #2d333a); }
      body[data-admin-page="user"] .users-table .status-unknown { background: linear-gradient(180deg, #636b75, #3a414a); }

      body[data-admin-page="user"] .users-table .actions {
        display: inline-flex;
        align-items: center;
        justify-content: flex-start;
        gap: 18px;
        min-width: 104px;
      }

      body[data-admin-page="user"] .users-table .actions button {
        width: 28px;
        min-width: 28px;
        height: 28px;
        min-height: 28px;
        padding: 0;
        border: 0;
        border-radius: 0;
        background: transparent;
        color: var(--text);
        font-size: 1.25rem;
        line-height: 1;
        box-shadow: none;
      }

      body[data-admin-page="user"] .users-table .actions [data-user-purge],
      body[data-admin-page="user"] .users-table .actions .danger-action {
        color: #ff5252 !important;
      }

      body[data-admin-page="user"] .users-table .actions [data-user-disable],
      body[data-admin-page="user"] .users-table .actions [data-user-reactivate] {
        color: color-mix(in srgb, var(--text) 90%, var(--muted) 10%);
      }

      @media (max-width: 1180px) {
        body[data-admin-page="user"] .user-card-head { align-items: stretch; flex-direction: column; }
        body[data-admin-page="user"] .user-toolbar { width: 100%; min-width: 0; justify-content: flex-start; flex-wrap: wrap; }
        body[data-admin-page="user"] .user-search-shell { max-width: none; }
        body[data-admin-page="user"] .user-filter-row { flex-wrap: wrap; }
      }

      @media (max-width: 760px) {
        body[data-admin-page="user"] .user-toolbar,
        body[data-admin-page="user"] .user-filter-row,
        body[data-admin-page="user"] .user-toolbar-actions { align-items: stretch; flex-direction: column; }
        body[data-admin-page="user"] .user-filter-control select,
        body[data-admin-page="user"] .user-toolbar-actions button { width: 100%; }
      }

      @media (max-width: 520px) {
        body[data-admin-page="user"] #userDialog {
          width: calc(100vw - 16px);
          max-height: calc(100dvh - 16px);
        }

        body[data-admin-page="user"] #userDialog .modal-content {
          max-height: calc(100dvh - 16px);
        }

        body[data-admin-page="user"] #userDialog .user-dialog-body {
          padding: 12px;
        }

        body[data-admin-page="user"] #userDialog .form-actions {
          margin: 4px -12px -12px;
          padding: 12px 12px 0;
        }

        body[data-admin-page="user"] .users-table-wrap {
          padding: 0 10px 10px;
          overflow-x: auto;
        }

        body[data-admin-page="user"] .users-table {
          min-width: 960px;
          display: table;
        }

        body[data-admin-page="user"] .users-table thead { display: table-header-group; }
        body[data-admin-page="user"] .users-table tbody { display: table-row-group; }
        body[data-admin-page="user"] .users-table tr { display: table-row; padding: 0; }
        body[data-admin-page="user"] .users-table td { display: table-cell; width: auto; padding: 10px 16px; font-size: 0.9rem; }
        body[data-admin-page="user"] .users-table td::before { content: none !important; }
      }
    `;
    document.head.appendChild(style);
  }

  function cleanUserName(value) {
    const withoutTrailingDirectoryText = String(value || "")
      .replace(/\s*(?:no|not\s+set)\s+(?:company|department|group)\b.*$/i, "")
      .replace(/\s+(?:company|department|group)\s*:\s*.*$/i, "")
      .trim();
    const parts = withoutTrailingDirectoryText
      .split(/\n|\||•|·/)
      .map((part) => part.trim())
      .filter(Boolean);
    const ignored = new Set(["admin", "owner", "member", "viewer", "active", "invited", "disabled"]);
    return parts.find((part) => {
      const normalized = part.toLowerCase();
      return !ignored.has(normalized) && !/^(role|company|department|group|status)\b/i.test(part);
    }) || parts[0] || "user";
  }

  function refreshNameTrigger(trigger) {
    const label = trigger.querySelector("span:first-child") || trigger;
    const currentText = label.textContent || trigger.textContent || "";
    const cleaned = cleanUserName(currentText);
    if (!cleaned || cleaned === currentText.trim()) return;
    label.textContent = cleaned;
    trigger.setAttribute("aria-label", `Edit ${cleaned}`);
  }

  function formatDate(value) {
    if (!value) return "Not available";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "Not available";
    return new Intl.DateTimeFormat(undefined, { month: "long", day: "numeric", year: "numeric" }).format(date);
  }

  function relativeTime(value) {
    if (!value) return "Not active";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "Not active";
    const diffSeconds = Math.round((date.getTime() - Date.now()) / 1000);
    const ranges = [
      [60, "second"],
      [60, "minute"],
      [24, "hour"],
      [7, "day"],
      [4.345, "week"],
      [12, "month"],
      [Number.POSITIVE_INFINITY, "year"]
    ];
    let duration = diffSeconds;
    for (const [range, unit] of ranges) {
      if (Math.abs(duration) < range) return new Intl.RelativeTimeFormat(undefined, { numeric: "auto" }).format(Math.round(duration), unit);
      duration /= range;
    }
    return formatDate(value);
  }

  function usernameFromEmail(email = "") {
    return String(email || "").split("@")[0] || "user";
  }

  function initials(name = "") {
    const parts = String(name || "User").trim().split(/\s+/).filter(Boolean);
    return (parts[0]?.[0] || "U") + (parts[1]?.[0] || "");
  }

  function findUserFromRow(row, email, name) {
    const editId = row.querySelector("[data-user-edit]")?.dataset?.userEdit;
    const users = typeof usersCache !== "undefined" ? usersCache : [];
    return users.find((user) => user.id === editId)
      || users.find((user) => String(user.email || "").toLowerCase() === String(email || "").toLowerCase())
      || users.find((user) => cleanUserName(user.name) === cleanUserName(name))
      || null;
  }

  function cell(content, className = "") {
    const td = document.createElement("td");
    if (className) td.className = className;
    if (content instanceof Node) td.appendChild(content);
    else td.textContent = content || "";
    return td;
  }

  function headerCell(label, className = "") {
    const th = document.createElement("th");
    if (className) th.className = className;
    if (className.includes("select-column")) {
      const checkbox = document.createElement("input");
      checkbox.className = "user-row-checkbox";
      checkbox.type = "checkbox";
      checkbox.setAttribute("aria-label", "Select all users");
      checkbox.addEventListener("change", () => {
        document.querySelectorAll(".users-table tbody .user-row-checkbox").forEach((input) => {
          input.checked = checkbox.checked;
        });
      });
      th.appendChild(checkbox);
    } else {
      th.textContent = label;
    }
    return th;
  }

  function nameCell(user, fallbackName) {
    const name = cleanUserName(user?.name || fallbackName || "User");
    const wrapper = document.createElement("div");
    wrapper.className = "user-name-cell";
    const avatar = document.createElement("span");
    avatar.className = "user-avatar";
    const photo = String(user?.photoUrl || "").trim();
    if (/^(https?:|data:image\/)/i.test(photo)) {
      const img = document.createElement("img");
      img.src = photo;
      img.alt = "";
      avatar.appendChild(img);
    } else {
      avatar.textContent = initials(name).toUpperCase();
    }
    const label = document.createElement("span");
    label.className = "user-full-name";
    label.textContent = name;
    wrapper.append(avatar, label);
    return wrapper;
  }

  function statusPill(source, status) {
    const normalized = String(status || source?.textContent || "unknown").trim().toLowerCase();
    const pill = source instanceof Element ? source.cloneNode(true) : document.createElement("small");
    pill.classList.add("user-status-pill", `status-${normalized || "unknown"}`);
    pill.textContent = normalized || "unknown";
    return pill;
  }

  function iconizeActions(actions) {
    if (!(actions instanceof Element)) return actions;
    actions.querySelectorAll("button").forEach((button) => {
      button.hidden = false;
      button.classList.remove("user-edit-action-hidden");
      button.removeAttribute("aria-hidden");
      button.tabIndex = 0;
      if (button.matches("[data-user-edit]")) {
        button.textContent = "✎";
        button.setAttribute("aria-label", "Edit user");
        button.setAttribute("title", "Edit user");
      } else if (button.matches("[data-user-disable]")) {
        button.textContent = "⊘";
        button.setAttribute("aria-label", "Disable user");
        button.setAttribute("title", "Disable user");
      } else if (button.matches("[data-user-reactivate]")) {
        button.textContent = "↻";
        button.setAttribute("aria-label", "Reactivate user");
        button.setAttribute("title", "Reactivate user");
      } else if (button.matches("[data-user-purge], [data-purge]")) {
        button.textContent = "×";
        button.setAttribute("aria-label", "Delete user");
        button.setAttribute("title", "Delete user");
      }
    });
    return actions;
  }

  function rebuildTable(table) {
    if (!table || table.dataset.referenceStyle === "true") return;
    const tbody = table.querySelector("tbody");
    if (!tbody) return;
    const rows = Array.from(tbody.rows);
    if (!rows.length || rows[0].cells.length >= tableLabels.length) return;

    const thead = table.querySelector("thead") || table.createTHead();
    const headerRow = document.createElement("tr");
    tableLabels.forEach((label, index) => headerRow.appendChild(headerCell(label, index === 0 ? "select-column" : "")));
    thead.replaceChildren(headerRow);

    rows.forEach((row) => {
      const original = Array.from(row.cells);
      const name = original[0]?.textContent?.trim() || "User";
      const email = original[1]?.textContent?.trim() || "";
      const role = original[2]?.textContent?.trim() || "viewer";
      const statusSource = original[3]?.firstElementChild || original[3];
      const status = statusSource?.textContent?.trim() || "unknown";
      const updated = original[4]?.textContent?.trim() || "";
      const actions = original[5]?.firstElementChild || document.createElement("div");
      const user = findUserFromRow(row, email, name);
      const rowCheckbox = document.createElement("input");
      rowCheckbox.className = "user-row-checkbox";
      rowCheckbox.type = "checkbox";
      rowCheckbox.setAttribute("aria-label", `Select ${cleanUserName(user?.name || name)}`);
      row.dataset.role = String(user?.role || role || "viewer").toLowerCase();
      row.dataset.status = String(user?.status || status || "unknown").toLowerCase();
      row.replaceChildren(
        cell(rowCheckbox, "select-cell"),
        cell(nameCell(user, name)),
        cell(user?.email || email, "muted-cell"),
        cell(usernameFromEmail(user?.email || email), "muted-cell"),
        cell(statusPill(statusSource, user?.status || status)),
        cell(user?.role || role || "viewer", "muted-cell"),
        cell(formatDate(user?.createdAt), "muted-cell"),
        cell(relativeTime(user?.lastLoginAt || user?.updatedAt) || updated, "muted-cell"),
        cell(iconizeActions(actions))
      );
    });
    table.dataset.referenceStyle = "true";
    applyTableFilters();
  }

  function enhanceTable() {
    document.querySelectorAll("#users .user-name-edit-trigger").forEach(refreshNameTrigger);
    document.querySelectorAll("#users .users-table").forEach(rebuildTable);
  }

  function applyTableFilters() {
    const role = document.getElementById("userRoleFilter")?.value || "all";
    const status = document.getElementById("userStatusFilter")?.value || "all";
    document.querySelectorAll("#users .users-table tbody tr").forEach((row) => {
      const visible = (role === "all" || row.dataset.role === role) && (status === "all" || row.dataset.status === status);
      row.hidden = !visible;
    });
  }

  function exportVisibleUsers() {
    const rows = Array.from(document.querySelectorAll("#users .users-table tbody tr:not([hidden])"));
    const csvRows = [["Full Name", "Email", "Username", "Status", "Role", "Joined Date", "Last Active"]];
    rows.forEach((row) => {
      const cells = Array.from(row.cells).slice(1, 8).map((td) => td.textContent.trim());
      csvRows.push(cells);
    });
    const csv = csvRows.map((row) => row.map((value) => `"${String(value).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = "users.csv";
    link.click();
    URL.revokeObjectURL(link.href);
  }

  function filterControl(id, className, label, options) {
    const wrapper = document.createElement("label");
    wrapper.className = `user-filter-control ${className}`;
    const select = document.createElement("select");
    select.id = id;
    select.setAttribute("aria-label", label);
    select.innerHTML = options.map(([value, text]) => `<option value="${value}">${text}</option>`).join("");
    select.addEventListener("change", applyTableFilters);
    wrapper.appendChild(select);
    return wrapper;
  }

  function enhanceToolbar() {
    const toolbar = document.querySelector("body[data-admin-page='user'] .user-toolbar");
    const search = document.getElementById("userSearch");
    const addButton = document.getElementById("manageUsersButton");
    if (!toolbar || !search || !addButton || toolbar.dataset.referenceStyle === "true") return;

    const searchShell = document.createElement("div");
    searchShell.className = "user-search-shell";
    search.before(searchShell);
    searchShell.appendChild(search);

    const filters = document.createElement("div");
    filters.className = "user-filter-row";
    filters.append(
      filterControl("userRoleFilter", "role-filter", "Filter by role", [["all", "Role"], ...roleOptions.map((role) => [role, role[0].toUpperCase() + role.slice(1)])]),
      filterControl("userStatusFilter", "status-filter", "Filter by status", [["all", "Status"], ...statusOptions.map((status) => [status, status[0].toUpperCase() + status.slice(1)])]),
      filterControl("userDateFilter", "date-filter", "Date sort", [["joined", "Date"], ["active", "Last active"]])
    );

    const actions = document.createElement("div");
    actions.className = "user-toolbar-actions";
    const exportButton = document.createElement("button");
    exportButton.id = "exportUsersButton";
    exportButton.type = "button";
    exportButton.textContent = "Export";
    exportButton.addEventListener("click", exportVisibleUsers);
    actions.append(exportButton, addButton);
    toolbar.append(filters, actions);
    toolbar.dataset.referenceStyle = "true";
  }

  function refreshEnhancements() {
    enhanceToolbar();
    enhanceTable();
    window.setTimeout(enhanceTable, 0);
    window.setTimeout(enhanceTable, 150);
  }

  function observeUsers() {
    const list = document.getElementById("users");
    refreshEnhancements();
    if (list) new MutationObserver(refreshEnhancements).observe(list, { childList: true, subtree: true });
  }

  addStyles();
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", observeUsers, { once: true });
  } else {
    observeUsers();
  }
})();
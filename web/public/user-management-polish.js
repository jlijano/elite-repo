(function polishUserManagementPage() {
  if (document.body?.dataset?.adminPage !== "user") return;

  const roleOptions = ["owner", "admin", "member", "viewer"];
  const statusOptions = ["active", "invited", "disabled"];
  const tableColumns = [
    { key: "select", label: "", className: "select-column" },
    { key: "name", label: "Full Name" },
    { key: "email", label: "Email" },
    { key: "username", label: "Username" },
    { key: "status", label: "Status" },
    { key: "role", label: "Role" },
    { key: "joined", label: "Joined Date" },
    { key: "active", label: "Last Active" },
    { key: "actions", label: "Actions", className: "actions-column" }
  ];
  let renderingTable = false;

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

      body[data-admin-page="user"] #userDialog .management-form { align-items: start; }
      body[data-admin-page="user"] #userDialog .management-form > label { min-width: 0; }
      body[data-admin-page="user"] #userDialog input,
      body[data-admin-page="user"] #userDialog select { width: 100%; box-sizing: border-box; }

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
        gap: 14px;
        padding: 12px 14px;
        background: transparent;
      }

      body[data-admin-page="user"] .user-toolbar {
        flex: 1 1 auto;
        justify-content: flex-end;
        gap: 10px;
        min-width: min(820px, 100%);
      }

      body[data-admin-page="user"] .user-search-shell {
        position: relative;
        flex: 1 1 260px;
        max-width: 420px;
      }

      body[data-admin-page="user"] .user-search-shell::before {
        content: "";
        position: absolute;
        left: 17px;
        top: 50%;
        width: 13px;
        height: 13px;
        border: 2px solid currentColor;
        border-radius: 50%;
        color: var(--muted);
        transform: translateY(-55%);
        pointer-events: none;
      }

      body[data-admin-page="user"] .user-search-shell::after {
        content: "";
        position: absolute;
        left: 29px;
        top: calc(50% + 7px);
        width: 7px;
        height: 2px;
        border-radius: 999px;
        background: var(--muted);
        transform: rotate(45deg);
        transform-origin: left center;
        pointer-events: none;
      }

      body[data-admin-page="user"] .user-search-shell input {
        max-width: none;
        min-height: 48px;
        padding-left: 52px;
        border-radius: 999px;
        border-color: color-mix(in srgb, var(--line) 78%, white 22%);
        background: rgba(10, 16, 22, 0.54);
        color: var(--text);
        font-size: 0.96rem;
      }

      body[data-admin-page="user"] .user-filter-row,
      body[data-admin-page="user"] .user-toolbar-actions {
        display: inline-flex;
        align-items: center;
        gap: 10px;
      }

      body[data-admin-page="user"] .user-filter-control {
        position: relative;
        flex: 0 0 auto;
      }

      body[data-admin-page="user"] .user-filter-control select {
        width: auto;
        min-width: 132px;
        min-height: 48px;
        padding: 0 34px 0 42px;
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
        left: 17px;
        top: 50%;
        color: var(--text);
        font-size: 0.95rem;
        transform: translateY(-50%);
        pointer-events: none;
      }

      body[data-admin-page="user"] .user-filter-control.role-filter::before { content: "@"; }
      body[data-admin-page="user"] .user-filter-control.status-filter::before { content: "o"; }
      body[data-admin-page="user"] .user-filter-control.date-filter::before { content: "#"; }

      body[data-admin-page="user"] .user-filter-control::after {
        content: "";
        position: absolute;
        right: 17px;
        top: calc(50% - 3px);
        width: 7px;
        height: 7px;
        border-right: 2px solid var(--muted);
        border-bottom: 2px solid var(--muted);
        transform: rotate(45deg);
        pointer-events: none;
      }

      body[data-admin-page="user"] .user-toolbar-actions button,
      body[data-admin-page="user"] #manageUsersButton {
        min-height: 48px;
        border-radius: 999px;
        padding-inline: 18px;
      }

      body[data-admin-page="user"] #manageUsersButton {
        border-color: rgba(45, 108, 223, 0.72);
        background: linear-gradient(180deg, #356fe9, #1e55d8);
        color: white;
      }

      body[data-admin-page="user"] #exportUsersButton {
        border-color: color-mix(in srgb, var(--line) 72%, white 28%);
        background: rgba(10, 16, 22, 0.52);
      }

      body[data-admin-page="user"] .users-table-wrap {
        width: 100%;
        overflow-x: auto;
        padding: 0 12px 12px;
      }

      body[data-admin-page="user"] .users-table {
        width: 100%;
        min-width: 1060px;
        table-layout: fixed;
        border-collapse: separate;
        border-spacing: 0;
        overflow: visible;
        border: 1px solid color-mix(in srgb, var(--line) 82%, white 18%);
        border-radius: 8px;
        background: rgba(8, 13, 18, 0.68);
      }

      body[data-admin-page="user"] .users-table th,
      body[data-admin-page="user"] .users-table td {
        border-bottom: 1px solid color-mix(in srgb, var(--line) 76%, white 18%);
      }

      body[data-admin-page="user"] .users-table thead th {
        height: 48px;
        padding: 0 14px;
        background: rgba(14, 20, 28, 0.78);
        color: color-mix(in srgb, var(--text) 88%, var(--muted) 12%);
        font-size: 0.92rem;
        font-weight: 750;
        letter-spacing: 0;
        text-transform: none;
        white-space: nowrap;
      }

      body[data-admin-page="user"] .user-th-label {
        display: inline-flex;
        align-items: center;
        gap: 8px;
        min-width: 0;
      }

      body[data-admin-page="user"] .sort-mark {
        position: relative;
        width: 8px;
        height: 14px;
        flex: 0 0 8px;
        opacity: 0.68;
      }

      body[data-admin-page="user"] .sort-mark::before,
      body[data-admin-page="user"] .sort-mark::after {
        content: "";
        position: absolute;
        left: 1px;
        border-left: 3px solid transparent;
        border-right: 3px solid transparent;
      }

      body[data-admin-page="user"] .sort-mark::before { top: 1px; border-bottom: 4px solid var(--muted); }
      body[data-admin-page="user"] .sort-mark::after { bottom: 1px; border-top: 4px solid var(--muted); }

      body[data-admin-page="user"] .users-table tbody tr:last-child td { border-bottom: 0; }
      body[data-admin-page="user"] .users-table tbody tr:hover { background: rgba(255,255,255,0.035); }
      body[data-admin-page="user"] .users-table tr.active td { box-shadow: none; background: rgba(16, 163, 127, 0.05); }

      body[data-admin-page="user"] .users-table td {
        height: 48px;
        padding: 7px 14px;
        color: color-mix(in srgb, var(--text) 92%, white 8%);
        font-size: 0.93rem;
        vertical-align: middle;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }

      body[data-admin-page="user"] .select-column,
      body[data-admin-page="user"] .select-cell {
        width: 44px;
        padding-inline: 12px !important;
        text-align: center;
      }

      body[data-admin-page="user"] .select-cell::before { content: none !important; }

      body[data-admin-page="user"] .user-row-checkbox {
        width: 18px;
        height: 18px;
        min-height: 18px;
        accent-color: #2f6df0;
        cursor: pointer;
      }

      body[data-admin-page="user"] .user-name-cell {
        display: flex;
        align-items: center;
        gap: 12px;
        min-width: 0;
      }

      body[data-admin-page="user"] .user-avatar {
        width: 34px;
        height: 34px;
        flex: 0 0 34px;
        display: grid;
        place-items: center;
        overflow: hidden;
        border-radius: 50%;
        background: linear-gradient(135deg, #e7e7e4, #92979b);
        color: #111827;
        font-size: 0.72rem;
        font-weight: 900;
      }

      body[data-admin-page="user"] .user-avatar img { width: 100%; height: 100%; object-fit: cover; }
      body[data-admin-page="user"] .user-full-name { min-width: 0; overflow: hidden; text-overflow: ellipsis; color: var(--text); font-weight: 750; }
      body[data-admin-page="user"] .users-table .muted-cell { color: color-mix(in srgb, var(--text) 84%, var(--muted) 16%); }

      body[data-admin-page="user"] .users-table .status-badge,
      body[data-admin-page="user"] .users-table .user-status-pill {
        width: fit-content;
        min-width: 0;
        min-height: 28px;
        padding: 0 13px;
        justify-content: center;
        border: 0;
        border-radius: 999px;
        color: white !important;
        font-size: 0.83rem;
        font-weight: 800;
        line-height: 1;
        text-transform: capitalize;
      }

      body[data-admin-page="user"] .users-table .status-active { background: linear-gradient(180deg, #2ea642, #18772d); }
      body[data-admin-page="user"] .users-table .status-invited { background: linear-gradient(180deg, #1d55c9, #13357f); }
      body[data-admin-page="user"] .users-table .status-disabled { background: linear-gradient(180deg, #48505a, #2d333a); }
      body[data-admin-page="user"] .users-table .status-unknown { background: linear-gradient(180deg, #636b75, #3a414a); }

      body[data-admin-page="user"] .users-table .actions-column,
      body[data-admin-page="user"] .users-table .actions-cell {
        position: sticky;
        right: 0;
        z-index: 2;
        width: 118px;
        min-width: 118px;
        background: rgba(10, 16, 22, 0.94);
        box-shadow: -1px 0 0 color-mix(in srgb, var(--line) 76%, white 18%);
      }

      body[data-admin-page="user"] .users-table thead .actions-column { z-index: 3; }

      body[data-admin-page="user"] .users-table .actions {
        display: inline-flex;
        align-items: center;
        justify-content: flex-start;
        gap: 10px;
        min-width: 0;
      }

      body[data-admin-page="user"] .users-table .actions button {
        width: 28px;
        min-width: 28px;
        height: 28px;
        min-height: 28px;
        padding: 0;
        border: 0;
        border-radius: 6px;
        background: transparent;
        color: var(--text);
        font-size: 0.8rem;
        line-height: 1;
        box-shadow: none;
      }

      body[data-admin-page="user"] .users-table .actions [data-user-purge],
      body[data-admin-page="user"] .users-table .actions .danger-action { color: #ff5252 !important; }
      body[data-admin-page="user"] .users-table .actions [data-user-disable],
      body[data-admin-page="user"] .users-table .actions [data-user-reactivate] { color: color-mix(in srgb, var(--text) 90%, var(--muted) 10%); }

      body[data-admin-page="user"] .col-name { width: 230px; }
      body[data-admin-page="user"] .col-email { width: 230px; }
      body[data-admin-page="user"] .col-username { width: 138px; }
      body[data-admin-page="user"] .col-status { width: 118px; }
      body[data-admin-page="user"] .col-role { width: 108px; }
      body[data-admin-page="user"] .col-joined { width: 150px; }
      body[data-admin-page="user"] .col-active { width: 140px; }

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
        body[data-admin-page="user"] #userDialog { width: calc(100vw - 16px); max-height: calc(100dvh - 16px); }
        body[data-admin-page="user"] #userDialog .modal-content { max-height: calc(100dvh - 16px); }
        body[data-admin-page="user"] #userDialog .user-dialog-body { padding: 12px; }
        body[data-admin-page="user"] #userDialog .form-actions { margin: 4px -12px -12px; padding: 12px 12px 0; }
        body[data-admin-page="user"] .users-table-wrap { padding: 0 8px 8px; overflow-x: auto; }
        body[data-admin-page="user"] .users-table { min-width: 980px; display: table; }
        body[data-admin-page="user"] .users-table thead { display: table-header-group; }
        body[data-admin-page="user"] .users-table tbody { display: table-row-group; }
        body[data-admin-page="user"] .users-table tr { display: table-row; padding: 0; }
        body[data-admin-page="user"] .users-table td { display: table-cell; width: auto; padding: 7px 12px; font-size: 0.86rem; }
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
      .split(/\n|\||\*|-/)
      .map((part) => part.trim())
      .filter(Boolean);
    const ignored = new Set(["admin", "owner", "member", "viewer", "active", "invited", "disabled"]);
    return parts.find((part) => {
      const normalized = part.toLowerCase();
      return !ignored.has(normalized) && !/^(role|company|department|group|status)\b/i.test(part);
    }) || parts[0] || "user";
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
    const ranges = [[60, "second"], [60, "minute"], [24, "hour"], [7, "day"], [4.345, "week"], [12, "month"], [Number.POSITIVE_INFINITY, "year"]];
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
    return ((parts[0]?.[0] || "U") + (parts[1]?.[0] || "")).toUpperCase();
  }

  function cell(content, className = "") {
    const td = document.createElement("td");
    if (className) td.className = className;
    if (content instanceof Node) td.appendChild(content);
    else td.textContent = content || "";
    return td;
  }

  function headerCell(column) {
    const th = document.createElement("th");
    if (column.className) th.className = column.className;
    if (column.key === "select") {
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
      return th;
    }
    const label = document.createElement("span");
    label.className = "user-th-label";
    const text = document.createElement("span");
    text.textContent = column.label;
    label.appendChild(text);
    if (column.key !== "actions") {
      const sort = document.createElement("span");
      sort.className = "sort-mark";
      sort.setAttribute("aria-hidden", "true");
      label.appendChild(sort);
    }
    th.appendChild(label);
    return th;
  }

  function nameCell(user) {
    const name = cleanUserName(user?.name || "User");
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
      avatar.textContent = initials(name);
    }
    const label = document.createElement("span");
    label.className = "user-full-name";
    label.textContent = name;
    wrapper.append(avatar, label);
    return wrapper;
  }

  function statusPill(status = "unknown") {
    const normalized = String(status || "unknown").trim().toLowerCase();
    const pill = document.createElement("small");
    pill.className = `status-badge user-status-pill status-${normalized || "unknown"}`;
    pill.textContent = normalized || "unknown";
    return pill;
  }

  function actionButton(label, text, datasetName, value, onClick) {
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = text;
    button.setAttribute("aria-label", label);
    button.setAttribute("title", label);
    button.dataset[datasetName] = value;
    button.addEventListener("click", onClick);
    return button;
  }

  function actionsCell(user) {
    const actions = document.createElement("div");
    actions.className = "actions";
    actions.appendChild(actionButton("Edit user", "Edit", "userEdit", user.id, () => {
      if (typeof fillUserForm === "function") fillUserForm(user);
      if (typeof renderUsers === "function") renderUsers();
      window.setTimeout(() => {
        const dialog = document.getElementById("userDialog");
        if (dialog && !dialog.open && typeof dialog.showModal === "function") dialog.showModal();
        document.getElementById("userName")?.focus();
      }, 0);
    }));

    const disabled = user.status === "disabled";
    actions.appendChild(actionButton(disabled ? "Reactivate user" : "Disable user", disabled ? "On" : "Off", disabled ? "userReactivate" : "userDisable", user.id, () => {
      if (typeof updateUserStatus === "function") updateUserStatus(user.id, disabled ? "reactivate" : "disable");
    }));
    return actions;
  }

  function currentUsers() {
    const users = typeof usersCache !== "undefined" && Array.isArray(usersCache) ? usersCache : [];
    const query = document.getElementById("userSearch")?.value || "";
    const role = document.getElementById("userRoleFilter")?.value || "all";
    const status = document.getElementById("userStatusFilter")?.value || "all";
    const normalizedQuery = query.trim().toLowerCase();
    return users.filter((user) => {
      const matchesQuery = !normalizedQuery || [user.name, user.email, user.role, user.status].some((value) => String(value || "").toLowerCase().includes(normalizedQuery));
      const matchesRole = role === "all" || user.role === role;
      const matchesStatus = status === "all" || user.status === status;
      return matchesQuery && matchesRole && matchesStatus;
    });
  }

  function renderReferenceTable() {
    const container = document.getElementById("users");
    if (!container || renderingTable) return;
    const users = currentUsers();
    if (!users.length) return;
    renderingTable = true;

    const wrap = document.createElement("div");
    wrap.className = "users-table-wrap";
    const table = document.createElement("table");
    table.className = "users-table";
    table.dataset.referenceStyle = "true";

    const colgroup = document.createElement("colgroup");
    ["select", "name", "email", "username", "status", "role", "joined", "active", "actions"].forEach((name) => {
      const col = document.createElement("col");
      col.className = `col-${name}`;
      colgroup.appendChild(col);
    });
    table.appendChild(colgroup);

    const thead = table.createTHead();
    const headerRow = thead.insertRow();
    tableColumns.forEach((column) => headerRow.appendChild(headerCell(column)));

    const tbody = table.createTBody();
    users.forEach((user) => {
      const row = tbody.insertRow();
      row.dataset.role = String(user.role || "viewer").toLowerCase();
      row.dataset.status = String(user.status || "unknown").toLowerCase();

      const rowCheckbox = document.createElement("input");
      rowCheckbox.className = "user-row-checkbox";
      rowCheckbox.type = "checkbox";
      rowCheckbox.setAttribute("aria-label", `Select ${cleanUserName(user.name)}`);

      row.appendChild(cell(rowCheckbox, "select-cell"));
      row.appendChild(cell(nameCell(user)));
      row.appendChild(cell(user.email || "", "muted-cell"));
      row.appendChild(cell(usernameFromEmail(user.email), "muted-cell"));
      row.appendChild(cell(statusPill(user.status)));
      row.appendChild(cell(user.role || "viewer", "muted-cell"));
      row.appendChild(cell(formatDate(user.createdAt), "muted-cell"));
      row.appendChild(cell(relativeTime(user.lastLoginAt || user.updatedAt), "muted-cell"));
      row.appendChild(cell(actionsCell(user), "actions-cell"));
    });

    wrap.appendChild(table);
    container.replaceChildren(wrap);
    renderingTable = false;
  }

  function exportVisibleUsers() {
    const users = currentUsers();
    const csvRows = [["Full Name", "Email", "Username", "Status", "Role", "Joined Date", "Last Active"]];
    users.forEach((user) => {
      csvRows.push([
        cleanUserName(user.name),
        user.email || "",
        usernameFromEmail(user.email),
        user.status || "unknown",
        user.role || "viewer",
        formatDate(user.createdAt),
        relativeTime(user.lastLoginAt || user.updatedAt)
      ]);
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
    select.addEventListener("change", renderReferenceTable);
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
    search.addEventListener("input", () => window.setTimeout(renderReferenceTable, 0));

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
    window.setTimeout(renderReferenceTable, 0);
    window.setTimeout(renderReferenceTable, 120);
  }

  function observeUsers() {
    const list = document.getElementById("users");
    refreshEnhancements();
    if (list) {
      new MutationObserver(() => {
        if (!renderingTable) refreshEnhancements();
      }).observe(list, { childList: true, subtree: false });
    }
  }

  addStyles();
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", observeUsers, { once: true });
  } else {
    observeUsers();
  }
})();
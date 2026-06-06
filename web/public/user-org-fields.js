(() => {
  if (document.body?.dataset.adminPage !== "user") return;

  const fieldIds = ["userCompany", "userDepartment", "userGroup"];
  const html = (value) => String(value ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/\"/g, "&quot;");
  const time = (value) => value ? new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }).format(new Date(value)) : "";
  const textMatch = (value, query = "") => String(value || "").toLowerCase().includes(query.trim().toLowerCase());
  const csvKey = (value) => String(value || "").trim().toLowerCase().replace(/[^a-z0-9]/g, "");

  function injectStyles() {
    if (document.getElementById("userOrgFieldsStyles")) return;
    const style = document.createElement("style");
    style.id = "userOrgFieldsStyles";
    style.textContent = `
      body[data-admin-page="user"] .users-table { min-width: 1040px; }
      body[data-admin-page="user"] .user-import-input { display: none; }
      body[data-admin-page="user"] .user-identity { display: flex; align-items: center; gap: 10px; min-width: 0; }
      body[data-admin-page="user"] .user-avatar { width: 36px; height: 36px; flex: 0 0 36px; display: grid; place-items: center; overflow: hidden; border: 1px solid var(--line); border-radius: 50%; background: var(--panel-soft); color: var(--muted); font-weight: 900; }
      body[data-admin-page="user"] .user-avatar img { width: 100%; height: 100%; object-fit: cover; }
      body[data-admin-page="user"] .user-name-copy { min-width: 0; display: grid; gap: 2px; }
      body[data-admin-page="user"] .user-name-copy strong, body[data-admin-page="user"] .user-name-copy small { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
      body[data-admin-page="user"] .user-name-copy small { color: var(--muted); font-size: 0.72rem; }
      body[data-admin-page="user"] .org-field-row { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 10px; }
      body[data-admin-page="user"] .org-empty { color: var(--muted); }
      @media (max-width: 760px) { body[data-admin-page="user"] .users-table { min-width: 980px; } body[data-admin-page="user"] .org-field-row { grid-template-columns: 1fr; } }
      @media (max-width: 520px) {
        body[data-admin-page="user"] .users-table { min-width: 0; }
        body[data-admin-page="user"] .users-table td { grid-template-columns: 82px minmax(0, 1fr); }
        body[data-admin-page="user"] .users-table td:nth-child(3)::before { content: "Company"; }
        body[data-admin-page="user"] .users-table td:nth-child(4)::before { content: "Department"; }
        body[data-admin-page="user"] .users-table td:nth-child(5)::before { content: "Group"; }
        body[data-admin-page="user"] .users-table td:nth-child(6)::before { content: "Role"; }
        body[data-admin-page="user"] .users-table td:nth-child(7)::before { content: "Status"; }
        body[data-admin-page="user"] .users-table td:nth-child(8)::before { content: "Updated"; }
        body[data-admin-page="user"] .users-table td:nth-child(9) { display: block; padding-top: 8px; }
        body[data-admin-page="user"] .users-table td:nth-child(9)::before { content: none; }
      }
    `;
    document.head.appendChild(style);
  }

  function addOrgFields() {
    const form = document.getElementById("userForm");
    if (!form || document.getElementById("userCompany")) return;
    const row = document.createElement("div");
    row.className = "org-field-row";
    row.innerHTML = `
      <label><span>Company</span><input id="userCompany" name="company" type="text" autocomplete="organization" placeholder="Company" /></label>
      <label><span>Department</span><input id="userDepartment" name="department" type="text" autocomplete="organization-title" placeholder="Department" /></label>
      <label><span>Group</span><input id="userGroup" name="group" type="text" placeholder="Group" autocomplete="off" /></label>`;
    const roleRow = form.querySelector(".form-row");
    form.insertBefore(row, roleRow || document.getElementById("userPassword")?.closest("label") || null);
  }

  function setOrgFields(user = {}) {
    const values = { userCompany: user.company || "", userDepartment: user.department || "", userGroup: user.group || user.groupName || "" };
    for (const id of fieldIds) {
      const field = document.getElementById(id);
      if (field) field.value = values[id] || "";
    }
  }

  function orgPayload() {
    return {
      company: document.getElementById("userCompany")?.value || "",
      department: document.getElementById("userDepartment")?.value || "",
      group: document.getElementById("userGroup")?.value || ""
    };
  }

  function userInitials(user = {}) {
    return String(user.name || user.email || "U").trim().split(/\s+/).slice(0, 2).map((part) => part[0] || "").join("").toUpperCase() || "U";
  }

  function avatarMarkup(user = {}) {
    const photo = String(user.photoUrl || "").trim();
    return `<span class="user-avatar">${photo ? `<img src="${html(photo)}" alt="">` : html(userInitials(user))}</span>`;
  }

  function statusBadge(state = "") {
    const normalized = String(state).toLowerCase();
    const cls = normalized.includes("disabled") ? "status-error" : normalized.includes("invited") ? "status-storage" : "status-ready";
    return `<small class="status-badge ${cls}">${html(state || "unknown")}</small>`;
  }

  function orgCell(value) {
    return value ? html(value) : `<span class="org-empty">Not set</span>`;
  }

  function currentUsers() {
    try { return Array.isArray(usersCache) ? usersCache : []; } catch (error) { return []; }
  }

  function currentEditingId() {
    try { return editingUserId || ""; } catch (error) { return ""; }
  }

  function setEditingId(value) {
    try { editingUserId = value || ""; } catch (error) {}
  }

  function prepareNewUserForm() {
    setEditingId("");
    setOrgFields();
    const status = document.getElementById("userStatus");
    if (status) status.value = "invited";
    const password = document.getElementById("userPassword");
    if (password) {
      password.value = "";
      password.placeholder = "Set by user after email verification";
    }
  }

  function inviteMessage(invite) {
    const details = invite?.invite || {};
    const link = details.verificationLink || "";
    if (!link) return "User created, but the verification link could not be created.";
    if (details.emailSent) return `User created. Verification email sent. Login setup link: ${link}`;
    return `User created. Copy and send this verification link: ${link}`;
  }

  async function createInvite(userId) {
    return fetchJson(`/api/admin/users/${encodeURIComponent(userId)}/invite`, { method: "POST", body: "{}" }, true);
  }

  function csvEscape(value) {
    const text = String(value ?? "");
    return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, "\"\"")}"` : text;
  }

  function downloadCsv(filename, rows) {
    const csv = rows.map((row) => row.map(csvEscape).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = filename;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
  }

  function exportUsersCsv() {
    const rows = [["name", "email", "company", "department", "group", "role", "status", "photoUrl"], ...currentUsers().map((user) => [
      user.name || "",
      user.email || "",
      user.company || "",
      user.department || "",
      user.group || "",
      user.role || "viewer",
      user.status || "active",
      user.photoUrl || ""
    ])];
    downloadCsv(`switchboard-users-${new Date().toISOString().slice(0, 10)}.csv`, rows);
    setStatus?.("User list exported.");
  }

  function parseCsv(text) {
    const rows = [];
    let row = [];
    let value = "";
    let quoted = false;
    for (let index = 0; index < text.length; index += 1) {
      const char = text[index];
      const next = text[index + 1];
      if (quoted) {
        if (char === '"' && next === '"') {
          value += '"';
          index += 1;
        } else if (char === '"') {
          quoted = false;
        } else {
          value += char;
        }
      } else if (char === '"') {
        quoted = true;
      } else if (char === ",") {
        row.push(value);
        value = "";
      } else if (char === "\n") {
        row.push(value);
        rows.push(row);
        row = [];
        value = "";
      } else if (char !== "\r") {
        value += char;
      }
    }
    row.push(value);
    rows.push(row);
    return rows.filter((item) => item.some((cell) => String(cell || "").trim()));
  }

  function rowsFromCsv(text) {
    const rows = parseCsv(text);
    if (!rows.length) return [];
    const headers = rows.shift().map(csvKey);
    return rows.map((row) => headers.reduce((record, header, index) => {
      record[header] = String(row[index] || "").trim();
      return record;
    }, {})).filter((record) => Object.values(record).some(Boolean));
  }

  function importedUserPayload(row) {
    const email = row.email || row.emailaddress || "";
    return {
      name: row.name || email,
      email,
      photoUrl: row.photourl || row.photo || "",
      company: row.company || "",
      department: row.department || "",
      group: row.group || row.groupname || "",
      role: row.role || "viewer",
      status: "invited"
    };
  }

  async function importUsersFile(file) {
    if (!file) return;
    const rows = rowsFromCsv(await file.text());
    const counts = { created: 0, skipped: 0, failed: 0 };
    const inviteRows = [["email", "verificationLink", "emailSent", "emailStatus"]];
    setStatus?.("Importing users...");
    for (const row of rows) {
      const payload = importedUserPayload(row);
      if (!payload.email || !payload.name) {
        counts.skipped += 1;
        continue;
      }
      try {
        const result = await fetchJson("/api/admin/users", { method: "POST", body: JSON.stringify(payload) }, true);
        counts.created += 1;
        if (result.user?.id) {
          const invite = await createInvite(result.user.id);
          const details = invite.invite || {};
          inviteRows.push([payload.email, details.verificationLink || "", details.emailSent ? "yes" : "no", details.emailStatus || ""]);
        }
      } catch (error) {
        counts.failed += 1;
      }
    }
    await loadUserPage();
    renderOrgUserTable();
    if (inviteRows.length > 1) downloadCsv(`switchboard-user-invites-${new Date().toISOString().slice(0, 10)}.csv`, inviteRows);
    setStatus?.(`Imported ${counts.created} users. Skipped ${counts.skipped}. Failed ${counts.failed}.`);
  }

  function injectUserImportExportControls() {
    const toolbar = document.querySelector(".user-toolbar");
    if (!toolbar || document.getElementById("exportUsersButton")) return;
    const exportButton = document.createElement("button");
    exportButton.id = "exportUsersButton";
    exportButton.type = "button";
    exportButton.textContent = "Export list";

    const importButton = document.createElement("button");
    importButton.id = "importUsersButton";
    importButton.type = "button";
    importButton.textContent = "Import list";

    const input = document.createElement("input");
    input.id = "importUsersInput";
    input.className = "user-import-input";
    input.type = "file";
    input.accept = ".csv,text/csv";

    toolbar.append(exportButton, importButton, input);
    exportButton.addEventListener("click", exportUsersCsv);
    importButton.addEventListener("click", () => input.click());
    input.addEventListener("change", () => {
      const [file] = input.files || [];
      importUsersFile(file).catch((error) => setStatus?.(error.message, true)).finally(() => { input.value = ""; });
    });
  }

  function renderOrgUserTable() {
    const usersContainer = document.getElementById("users");
    if (!usersContainer || !currentUsers().length) return;
    const query = document.getElementById("userSearch")?.value || "";
    const users = currentUsers().filter((user) => [user.name, user.email, user.role, user.status, user.company, user.department, user.group].some((value) => textMatch(value, query)));
    if (!users.length) {
      usersContainer.innerHTML = `<div class="empty action-empty"><strong>No users match this search.</strong><p>Clear the search or create a new user record.</p></div>`;
      return;
    }
    usersContainer.innerHTML = `<div class="users-table-wrap"><table class="users-table" data-org-users-table="true"><thead><tr><th>Name</th><th>Email</th><th>Company</th><th>Department</th><th>Group</th><th>Role</th><th>Status</th><th>Updated</th><th>Actions</th></tr></thead><tbody>${users.map((user) => {
      const disabled = user.status === "disabled";
      const statusAction = disabled
        ? `<button data-user-reactivate="${html(user.id)}" type="button">Reactivate</button>`
        : `<button data-user-disable="${html(user.id)}" type="button">Disable</button>`;
      return `<tr class="${user.id === currentEditingId() ? "active" : ""}">
        <td><div class="user-identity">${avatarMarkup(user)}<span class="user-name-copy"><strong>${html(user.name)}</strong><small>${html(user.company || "No company")}</small></span></div></td>
        <td class="muted-cell">${html(user.email)}</td>
        <td class="muted-cell">${orgCell(user.company)}</td>
        <td class="muted-cell">${orgCell(user.department)}</td>
        <td class="muted-cell">${orgCell(user.group)}</td>
        <td class="muted-cell">${html(user.role || "viewer")}</td>
        <td>${statusBadge(user.status)}</td>
        <td class="muted-cell">${html(time(user.updatedAt))}</td>
        <td><div class="actions"><button data-user-edit="${html(user.id)}" type="button">Edit</button>${statusAction}</div></td>
      </tr>`;
    }).join("")}</tbody></table></div>`;
  }

  async function saveUserWithOrg(event) {
    const form = document.getElementById("userForm");
    if (!form || event.target !== form) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    if (typeof hasAdminAccess === "function" && !hasAdminAccess()) return setStatus?.("User management requires an admin session.", true);
    const editingId = currentEditingId();
    const isCreate = !editingId;
    const payload = {
      name: document.getElementById("userName")?.value || "",
      email: document.getElementById("userEmail")?.value || "",
      photoUrl: document.getElementById("userPhotoUrl")?.value || "",
      ...orgPayload(),
      role: document.getElementById("userRole")?.value || "viewer",
      status: isCreate ? "invited" : document.getElementById("userStatus")?.value || "active"
    };
    const password = document.getElementById("userPassword")?.value || "";
    if (password && !isCreate) payload.password = password;
    const url = editingId ? `/api/admin/users/${encodeURIComponent(editingId)}` : "/api/admin/users";
    const method = editingId ? "PATCH" : "POST";
    setStatus?.(editingId ? "Saving user changes..." : "Creating invited user...");
    try {
      const result = await fetchJson(url, { method, body: JSON.stringify(payload) }, true);
      let createdInvite = null;
      if (isCreate && result.user?.id) {
        setStatus?.("Creating verification link...");
        createdInvite = await createInvite(result.user.id).catch((error) => ({ error: error.message }));
      }
      setOrgFields();
      if (typeof resetUserForm === "function") resetUserForm();
      await loadUserPage();
      renderOrgUserTable();
      if (isCreate) {
        setStatus?.(createdInvite?.error ? `User created, but verification link failed: ${createdInvite.error}` : inviteMessage(createdInvite), Boolean(createdInvite?.error));
      } else {
        setStatus?.("User updated.");
      }
      document.getElementById("userDialog")?.close?.();
    } catch (error) {
      setStatus?.(error.message, true);
    }
  }

  function bindActions() {
    const usersContainer = document.getElementById("users");
    usersContainer?.addEventListener("click", (event) => {
      const edit = event.target.closest("[data-user-edit]");
      const disable = event.target.closest("[data-user-disable]");
      const reactivate = event.target.closest("[data-user-reactivate]");
      if (edit) {
        const user = currentUsers().find((item) => item.id === edit.dataset.userEdit);
        if (!user) return;
        setEditingId(user.id);
        if (typeof fillUserForm === "function") fillUserForm(user);
        setOrgFields(user);
        window.setTimeout(renderOrgUserTable, 0);
      }
      if (disable && typeof updateUserStatus === "function") updateUserStatus(disable.dataset.userDisable, "disable").then(() => window.setTimeout(renderOrgUserTable, 0));
      if (reactivate && typeof updateUserStatus === "function") updateUserStatus(reactivate.dataset.userReactivate, "reactivate").then(() => window.setTimeout(renderOrgUserTable, 0));
    });

    document.getElementById("manageUsersButton")?.addEventListener("click", () => window.setTimeout(prepareNewUserForm, 0));
    document.getElementById("cancelUserEditButton")?.addEventListener("click", () => window.setTimeout(() => { setOrgFields(); renderOrgUserTable(); }, 0));
    document.getElementById("userSearch")?.addEventListener("input", (event) => {
      event.stopImmediatePropagation();
      renderOrgUserTable();
    }, true);
    document.getElementById("userForm")?.addEventListener("submit", saveUserWithOrg, true);
  }

  function init() {
    injectStyles();
    addOrgFields();
    injectUserImportExportControls();
    bindActions();
    const usersContainer = document.getElementById("users");
    if (usersContainer) {
      new MutationObserver(() => {
        if (usersContainer.querySelector("[data-org-users-table]")) return;
        window.setTimeout(renderOrgUserTable, 0);
      }).observe(usersContainer, { childList: true });
    }
    window.setTimeout(renderOrgUserTable, 0);
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init, { once: true });
  else init();
})();

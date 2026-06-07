(function polishUserManagementPage() {
  if (document.body?.dataset?.adminPage !== "user") return;

  const roleOptions = ["owner", "admin", "member", "viewer"];
  const statusOptions = ["active", "invited", "disabled"];
  let rendering = false;
  let lastRenderKey = "";

  function addStyles() {
    if (document.getElementById("userManagementPolishStyles")) return;
    const style = document.createElement("style");
    style.id = "userManagementPolishStyles";
    style.textContent = `
      body[data-admin-page="user"] #userManagementPage .card-head{gap:14px;padding:12px 14px;background:transparent}
      body[data-admin-page="user"] .user-toolbar{flex:1 1 auto;justify-content:flex-end;gap:10px;min-width:min(820px,100%)}
      body[data-admin-page="user"] .user-search-shell{position:relative;flex:1 1 260px;max-width:420px}
      body[data-admin-page="user"] .user-search-shell:before{content:"";position:absolute;left:17px;top:50%;width:13px;height:13px;border:2px solid currentColor;border-radius:50%;color:var(--muted);transform:translateY(-55%);pointer-events:none}
      body[data-admin-page="user"] .user-search-shell:after{content:"";position:absolute;left:29px;top:calc(50% + 7px);width:7px;height:2px;border-radius:999px;background:var(--muted);transform:rotate(45deg);transform-origin:left center;pointer-events:none}
      body[data-admin-page="user"] .user-search-shell input{max-width:none;min-height:48px;padding-left:52px;border-radius:999px;background:rgba(10,16,22,.54);color:var(--text);font-size:.96rem}
      body[data-admin-page="user"] .user-filter-row,body[data-admin-page="user"] .user-toolbar-actions{display:inline-flex;align-items:center;gap:10px}
      body[data-admin-page="user"] .user-filter-control{position:relative;flex:0 0 auto}
      body[data-admin-page="user"] .user-filter-control select{width:auto;min-width:132px;min-height:48px;padding:0 34px 0 42px;border-radius:999px;background:rgba(10,16,22,.56);color:var(--text);font-weight:750;appearance:none;cursor:pointer}
      body[data-admin-page="user"] .user-filter-control:before{position:absolute;left:17px;top:50%;color:var(--text);font-size:.95rem;transform:translateY(-50%);pointer-events:none}
      body[data-admin-page="user"] .role-filter:before{content:"@"}body[data-admin-page="user"] .status-filter:before{content:"o"}body[data-admin-page="user"] .date-filter:before{content:"#"}
      body[data-admin-page="user"] .user-filter-control:after{content:"";position:absolute;right:17px;top:calc(50% - 3px);width:7px;height:7px;border-right:2px solid var(--muted);border-bottom:2px solid var(--muted);transform:rotate(45deg);pointer-events:none}
      body[data-admin-page="user"] .user-toolbar-actions button,body[data-admin-page="user"] #manageUsersButton{min-height:48px;border-radius:999px;padding-inline:18px}
      body[data-admin-page="user"] #manageUsersButton{border-color:rgba(45,108,223,.72);background:linear-gradient(180deg,#356fe9,#1e55d8);color:#fff}
      body[data-admin-page="user"] #exportUsersButton{background:rgba(10,16,22,.52)}
      body[data-admin-page="user"] .users-table-wrap{width:100%;overflow-x:auto;padding:0 12px 12px}
      body[data-admin-page="user"] .users-table{width:100%;min-width:1060px;table-layout:fixed;border-collapse:separate;border-spacing:0;border:1px solid color-mix(in srgb,var(--line) 82%,white 18%);border-radius:8px;background:rgba(8,13,18,.68)}
      body[data-admin-page="user"] .users-table th,body[data-admin-page="user"] .users-table td{border-bottom:1px solid color-mix(in srgb,var(--line) 76%,white 18%)}
      body[data-admin-page="user"] .users-table thead th{height:48px;padding:0 14px;background:rgba(14,20,28,.78);color:color-mix(in srgb,var(--text) 88%,var(--muted) 12%);font-size:.92rem;font-weight:750;text-transform:none;white-space:nowrap}
      body[data-admin-page="user"] .user-th-label{display:inline-flex;align-items:center;gap:8px;min-width:0}.sort-mark{position:relative;width:8px;height:14px;flex:0 0 8px;opacity:.68}.sort-mark:before,.sort-mark:after{content:"";position:absolute;left:1px;border-left:3px solid transparent;border-right:3px solid transparent}.sort-mark:before{top:1px;border-bottom:4px solid var(--muted)}.sort-mark:after{bottom:1px;border-top:4px solid var(--muted)}
      body[data-admin-page="user"] .users-table tbody tr:last-child td{border-bottom:0}body[data-admin-page="user"] .users-table tbody tr:hover{background:rgba(255,255,255,.035)}
      body[data-admin-page="user"] .users-table td{height:48px;padding:7px 14px;color:color-mix(in srgb,var(--text) 92%,white 8%);font-size:.93rem;vertical-align:middle;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
      body[data-admin-page="user"] .select-column,body[data-admin-page="user"] .select-cell{width:44px;padding-inline:12px!important;text-align:center}body[data-admin-page="user"] .select-cell:before{content:none!important}
      body[data-admin-page="user"] .user-row-checkbox{width:18px;height:18px;min-height:18px;accent-color:#2f6df0;cursor:pointer}
      body[data-admin-page="user"] .user-name-cell{display:flex;align-items:center;gap:12px;min-width:0}.user-avatar{width:34px;height:34px;flex:0 0 34px;display:grid;place-items:center;overflow:hidden;border-radius:50%;background:linear-gradient(135deg,#e7e7e4,#92979b);color:#111827;font-size:.72rem;font-weight:900}.user-avatar img{width:100%;height:100%;object-fit:cover}.user-full-name{min-width:0;overflow:hidden;text-overflow:ellipsis;color:var(--text);font-weight:750}
      body[data-admin-page="user"] .users-table .muted-cell{color:color-mix(in srgb,var(--text) 84%,var(--muted) 16%)}
      body[data-admin-page="user"] .users-table .status-badge,body[data-admin-page="user"] .users-table .user-status-pill{width:fit-content;min-width:0;min-height:28px;padding:0 13px;justify-content:center;border:0;border-radius:999px;color:#fff!important;font-size:.83rem;font-weight:800;line-height:1;text-transform:capitalize}
      body[data-admin-page="user"] .status-active{background:linear-gradient(180deg,#2ea642,#18772d)}body[data-admin-page="user"] .status-invited{background:linear-gradient(180deg,#1d55c9,#13357f)}body[data-admin-page="user"] .status-disabled{background:linear-gradient(180deg,#48505a,#2d333a)}body[data-admin-page="user"] .status-unknown{background:linear-gradient(180deg,#636b75,#3a414a)}
      body[data-admin-page="user"] .actions-column,body[data-admin-page="user"] .actions-cell{position:sticky;right:0;z-index:2;width:118px;min-width:118px;background:rgba(10,16,22,.94);box-shadow:-1px 0 0 color-mix(in srgb,var(--line) 76%,white 18%)}body[data-admin-page="user"] thead .actions-column{z-index:3}
      body[data-admin-page="user"] .users-table .actions{display:inline-flex;align-items:center;justify-content:flex-start;gap:10px;min-width:0}body[data-admin-page="user"] .users-table .actions button{width:28px;min-width:28px;height:28px;min-height:28px;padding:0;border:0;border-radius:6px;background:transparent;color:var(--text);font-size:.75rem;line-height:1;box-shadow:none}body[data-admin-page="user"] .users-table .actions [data-user-purge],body[data-admin-page="user"] .users-table .actions .danger-action{color:#ff5252!important}
      body[data-admin-page="user"] .col-name{width:230px}.col-email{width:230px}.col-username{width:138px}.col-status{width:118px}.col-role{width:108px}.col-joined{width:150px}.col-active{width:140px}
      @media(max-width:1180px){body[data-admin-page="user"] .user-card-head{align-items:stretch;flex-direction:column}body[data-admin-page="user"] .user-toolbar{width:100%;min-width:0;justify-content:flex-start;flex-wrap:wrap}.user-search-shell{max-width:none}.user-filter-row{flex-wrap:wrap}}
      @media(max-width:760px){body[data-admin-page="user"] .user-toolbar,body[data-admin-page="user"] .user-filter-row,body[data-admin-page="user"] .user-toolbar-actions{align-items:stretch;flex-direction:column}body[data-admin-page="user"] .user-filter-control select,body[data-admin-page="user"] .user-toolbar-actions button{width:100%}}
      @media(max-width:520px){body[data-admin-page="user"] .users-table-wrap{padding:0 8px 8px;overflow-x:auto}body[data-admin-page="user"] .users-table{min-width:980px;display:table}body[data-admin-page="user"] .users-table thead{display:table-header-group}body[data-admin-page="user"] .users-table tbody{display:table-row-group}body[data-admin-page="user"] .users-table tr{display:table-row;padding:0}body[data-admin-page="user"] .users-table td{display:table-cell;width:auto;padding:7px 12px;font-size:.86rem}body[data-admin-page="user"] .users-table td:before{content:none!important}}
    `;
    document.head.appendChild(style);
  }

  const clean = (value) => String(value || "user").replace(/\s*(?:no|not\s+set)\s+(?:company|department|group)\b.*$/i, "").trim() || "user";
  const username = (email = "") => String(email || "").split("@")[0] || "user";
  const formatDate = (value) => value && !Number.isNaN(new Date(value).getTime()) ? new Intl.DateTimeFormat(undefined, { month: "long", day: "numeric", year: "numeric" }).format(new Date(value)) : "Not available";
  function relative(value) {
    if (!value || Number.isNaN(new Date(value).getTime())) return "Not active";
    const diff = Math.round((new Date(value).getTime() - Date.now()) / 1000);
    const steps = [[60,"second"],[60,"minute"],[24,"hour"],[7,"day"],[4.345,"week"],[12,"month"],[Infinity,"year"]];
    let n = diff;
    for (const [range, unit] of steps) { if (Math.abs(n) < range) return new Intl.RelativeTimeFormat(undefined, { numeric: "auto" }).format(Math.round(n), unit); n /= range; }
    return formatDate(value);
  }

  function users() {
    const list = typeof usersCache !== "undefined" && Array.isArray(usersCache) ? usersCache : [];
    const q = (document.getElementById("userSearch")?.value || "").trim().toLowerCase();
    const role = document.getElementById("userRoleFilter")?.value || "all";
    const status = document.getElementById("userStatusFilter")?.value || "all";
    return list.filter((user) => (!q || [user.name,user.email,user.role,user.status].some((v) => String(v || "").toLowerCase().includes(q))) && (role === "all" || user.role === role) && (status === "all" || user.status === status));
  }

  function td(content, className = "") { const cell = document.createElement("td"); if (className) cell.className = className; if (content instanceof Node) cell.appendChild(content); else cell.textContent = content || ""; return cell; }
  function th(label, className = "") { const cell = document.createElement("th"); if (className) cell.className = className; if (!label) { const cb = document.createElement("input"); cb.type = "checkbox"; cb.className = "user-row-checkbox"; cb.setAttribute("aria-label", "Select all users"); cb.addEventListener("change", () => document.querySelectorAll(".users-table tbody .user-row-checkbox").forEach((box) => { box.checked = cb.checked; })); cell.appendChild(cb); return cell; } const wrap = document.createElement("span"); wrap.className = "user-th-label"; wrap.innerHTML = `<span>${label}</span>${label === "Actions" ? "" : '<span class="sort-mark" aria-hidden="true"></span>'}`; cell.appendChild(wrap); return cell; }
  function avatar(user) { const wrap = document.createElement("div"); wrap.className = "user-name-cell"; const av = document.createElement("span"); av.className = "user-avatar"; const photo = String(user.photoUrl || "").trim(); if (/^(https?:|data:image\/)/i.test(photo)) { const img = document.createElement("img"); img.src = photo; img.alt = ""; av.appendChild(img); } else { av.textContent = clean(user.name).split(/\s+/).slice(0,2).map((p) => p[0]).join("").toUpperCase() || "U"; } const name = document.createElement("span"); name.className = "user-full-name"; name.textContent = clean(user.name); wrap.append(av, name); return wrap; }
  function badge(status) { const b = document.createElement("small"); const value = String(status || "unknown").toLowerCase(); b.className = `status-badge user-status-pill status-${value}`; b.textContent = value; return b; }
  function action(label, text, dataKey, value, handler) { const btn = document.createElement("button"); btn.type = "button"; btn.textContent = text; btn.dataset[dataKey] = value; btn.setAttribute("aria-label", label); btn.setAttribute("title", label); btn.addEventListener("click", handler); return btn; }
  function actionSet(user) { const box = document.createElement("div"); box.className = "actions"; box.appendChild(action("Edit user", "Edit", "userEdit", user.id, () => { if (typeof fillUserForm === "function") fillUserForm(user); if (typeof renderUsers === "function") renderUsers(); setTimeout(() => { const dialog = document.getElementById("userDialog"); if (dialog && !dialog.open && typeof dialog.showModal === "function") dialog.showModal(); document.getElementById("userName")?.focus(); }, 0); })); const disabled = user.status === "disabled"; box.appendChild(action(disabled ? "Reactivate user" : "Disable user", disabled ? "On" : "Off", disabled ? "userReactivate" : "userDisable", user.id, () => { if (typeof updateUserStatus === "function") updateUserStatus(user.id, disabled ? "reactivate" : "disable"); })); return box; }

  function renderTable(force = false) {
    const container = document.getElementById("users");
    if (!container || rendering) return;
    const data = users();
    if (!data.length) return;
    const key = JSON.stringify(data.map((u) => [u.id, u.updatedAt, u.status, u.role, u.email, u.name])) + "|" + (document.getElementById("userSearch")?.value || "") + "|" + (document.getElementById("userRoleFilter")?.value || "all") + "|" + (document.getElementById("userStatusFilter")?.value || "all");
    if (!force && key === lastRenderKey && container.querySelector(".users-table[data-reference-style='true']")) return;
    rendering = true;
    lastRenderKey = key;
    const wrap = document.createElement("div"); wrap.className = "users-table-wrap";
    const table = document.createElement("table"); table.className = "users-table"; table.dataset.referenceStyle = "true";
    const colgroup = document.createElement("colgroup"); ["select","name","email","username","status","role","joined","active","actions"].forEach((name) => { const col = document.createElement("col"); col.className = `col-${name}`; colgroup.appendChild(col); }); table.appendChild(colgroup);
    const head = table.createTHead().insertRow(); [["","select-column"],["Full Name",""],["Email",""],["Username",""],["Status",""],["Role",""],["Joined Date",""],["Last Active",""],["Actions","actions-column"]].forEach(([label, cls]) => head.appendChild(th(label, cls)));
    const body = table.createTBody();
    data.forEach((user) => { const row = body.insertRow(); const cb = document.createElement("input"); cb.type = "checkbox"; cb.className = "user-row-checkbox"; cb.setAttribute("aria-label", `Select ${clean(user.name)}`); row.appendChild(td(cb, "select-cell")); row.appendChild(td(avatar(user))); row.appendChild(td(user.email || "", "muted-cell")); row.appendChild(td(username(user.email), "muted-cell")); row.appendChild(td(badge(user.status))); row.appendChild(td(user.role || "viewer", "muted-cell")); row.appendChild(td(formatDate(user.createdAt), "muted-cell")); row.appendChild(td(relative(user.lastLoginAt || user.updatedAt), "muted-cell")); row.appendChild(td(actionSet(user), "actions-cell")); });
    wrap.appendChild(table); container.replaceChildren(wrap); rendering = false;
  }

  function exportUsers() { const rows = [["Full Name","Email","Username","Status","Role","Joined Date","Last Active"], ...users().map((u) => [clean(u.name), u.email || "", username(u.email), u.status || "unknown", u.role || "viewer", formatDate(u.createdAt), relative(u.lastLoginAt || u.updatedAt)])]; const csv = rows.map((row) => row.map((value) => `"${String(value).replace(/"/g, '""')}"`).join(",")).join("\n"); const blob = new Blob([csv], { type: "text/csv;charset=utf-8" }); const link = document.createElement("a"); link.href = URL.createObjectURL(blob); link.download = "users.csv"; link.click(); URL.revokeObjectURL(link.href); }
  function filter(id, cls, label, options) { const wrap = document.createElement("label"); wrap.className = `user-filter-control ${cls}`; const select = document.createElement("select"); select.id = id; select.setAttribute("aria-label", label); select.innerHTML = options.map(([value, text]) => `<option value="${value}">${text}</option>`).join(""); select.addEventListener("change", () => renderTable(true)); wrap.appendChild(select); return wrap; }
  function enhanceToolbar() { const toolbar = document.querySelector(".user-toolbar"); const search = document.getElementById("userSearch"); const add = document.getElementById("manageUsersButton"); if (!toolbar || !search || !add || toolbar.dataset.referenceStyle === "true") return; const shell = document.createElement("div"); shell.className = "user-search-shell"; search.before(shell); shell.appendChild(search); search.addEventListener("input", () => setTimeout(() => renderTable(true), 0)); const filters = document.createElement("div"); filters.className = "user-filter-row"; filters.append(filter("userRoleFilter", "role-filter", "Filter by role", [["all","Role"], ...roleOptions.map((role) => [role, role[0].toUpperCase() + role.slice(1)])]), filter("userStatusFilter", "status-filter", "Filter by status", [["all","Status"], ...statusOptions.map((status) => [status, status[0].toUpperCase() + status.slice(1)])]), filter("userDateFilter", "date-filter", "Date sort", [["joined","Date"], ["active","Last active"]])); const actions = document.createElement("div"); actions.className = "user-toolbar-actions"; const exp = document.createElement("button"); exp.id = "exportUsersButton"; exp.type = "button"; exp.textContent = "Export"; exp.addEventListener("click", exportUsers); actions.append(exp, add); toolbar.append(filters, actions); toolbar.dataset.referenceStyle = "true"; }
  function refresh(force = false) { enhanceToolbar(); setTimeout(() => renderTable(force), 0); setTimeout(() => renderTable(force), 120); }
  function start() { const list = document.getElementById("users"); refresh(true); if (list) new MutationObserver(() => { if (!rendering && !list.querySelector(".users-table[data-reference-style='true']")) refresh(true); }).observe(list, { childList: true, subtree: false }); }

  addStyles();
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start, { once: true });
  else start();
})();
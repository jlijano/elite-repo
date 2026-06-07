(function stabilizeAdminUx() {
  const page = document.body?.dataset?.adminPage || "";
  if (!document.querySelector(".admin-shell")) return;

  const clickedNavStorageKey = "switchboard-admin-clicked-nav";
  const pageLabels = {
    "/company.html": "Company",
    "/department.html": "Department",
    "/group.html": "Group",
    "/user.html": "User",
    "/chat.html": "Chat",
    "/knowledge.html": "Knowledge base",
    "/playground.html": "Playground",
    "/settings.html": "Settings",
    "/reports.html": "Reports",
    "/logs.html": "Logs",
    "/review-runs.html": "Review runs",
    "/system-health.html": "System health",
    "/user-audit.html": "User audit",
    "/": "Chat"
  };

  function addStyles() {
    if (document.getElementById("adminUxStabilityStyles")) return;
    const style = document.createElement("style");
    style.id = "adminUxStabilityStyles";
    style.textContent = `
      .admin-shell .admin-layout{width:min(1500px,calc(100vw - 48px));}
      .admin-shell .admin-card.wide{min-height:0;}
      .admin-shell .admin-status{width:100%;}
      .admin-shell .card-head{gap:18px;}
      .admin-shell .card-actions{flex-wrap:wrap;justify-content:flex-end;}
      .admin-shell.is-navigating .admin-panel{opacity:.82;}
      .admin-shell.is-navigating .admin-card{position:relative;min-height:280px;}
      .admin-shell.is-navigating .admin-card:after{content:"";position:absolute;inset:74px 14px 14px;border:1px solid rgba(148,163,184,.16);border-radius:10px;background:linear-gradient(90deg,rgba(255,255,255,.035),rgba(255,255,255,.08),rgba(255,255,255,.035));background-size:220% 100%;animation:adminUxShimmer 1.1s linear infinite;}
      @keyframes adminUxShimmer{from{background-position:120% 0}to{background-position:-120% 0}}

      body[data-admin-page="user"] .user-toolbar{gap:14px;align-items:center;}
      body[data-admin-page="user"] .user-search-shell{flex:1 1 360px;max-width:560px;min-width:320px;}
      body[data-admin-page="user"] .user-search-shell input{padding-right:18px;}
      body[data-admin-page="user"] .user-filter-row,
      body[data-admin-page="user"] .user-toolbar-actions{gap:12px;}
      body[data-admin-page="user"] .users-table-wrap{overflow-x:visible;padding-inline:14px;}
      body[data-admin-page="user"] .users-table{min-width:0!important;table-layout:auto!important;}
      body[data-admin-page="user"] .users-table td{white-space:normal;overflow:visible;text-overflow:clip;line-height:1.3;}
      body[data-admin-page="user"] .users-table .muted-cell{overflow-wrap:anywhere;}
      body[data-admin-page="user"] .col-name{width:240px!important;}
      body[data-admin-page="user"] .col-email{width:260px!important;}
      body[data-admin-page="user"] .col-username{width:150px!important;}
      body[data-admin-page="user"] .col-status{width:116px!important;}
      body[data-admin-page="user"] .col-role{width:110px!important;}
      body[data-admin-page="user"] .col-joined{width:150px!important;}
      body[data-admin-page="user"] .col-active{width:140px!important;}
      body[data-admin-page="user"] .actions-column,
      body[data-admin-page="user"] .actions-cell{position:static!important;width:176px!important;min-width:176px!important;background:transparent!important;box-shadow:none!important;}

      body[data-admin-page="company"] .entra-toolbar,
      body[data-admin-page="department"] .entra-toolbar,
      body[data-admin-page="group"] .entra-toolbar{gap:12px;flex-wrap:wrap;min-width:min(760px,100%);}
      body[data-admin-page="company"] .entra-toolbar input,
      body[data-admin-page="department"] .entra-toolbar input,
      body[data-admin-page="group"] .entra-toolbar input{flex:1 1 320px;min-width:280px;}
      body[data-admin-page="company"] .entra-table-wrap,
      body[data-admin-page="department"] .entra-table-wrap,
      body[data-admin-page="group"] .entra-table-wrap{overflow-x:visible;}
      body[data-admin-page="company"] .entra-table,
      body[data-admin-page="department"] .entra-table,
      body[data-admin-page="group"] .entra-table{min-width:0!important;table-layout:auto;}
      body[data-admin-page="company"] .entra-table td,
      body[data-admin-page="department"] .entra-table td,
      body[data-admin-page="group"] .entra-table td{white-space:normal;line-height:1.35;}

      .management-icon-action{width:auto!important;min-width:74px!important;height:36px!important;min-height:36px!important;padding:0 12px!important;border-radius:10px!important;font-size:.86rem!important;font-weight:800!important;}
      .management-icon-action.danger-action{border-color:rgba(239,68,68,.34)!important;background:rgba(127,29,29,.2)!important;color:#fecaca!important;}
      .management-icon-action:not(.danger-action){border:1px solid rgba(148,163,184,.24)!important;background:rgba(15,23,42,.58)!important;color:var(--text)!important;}

      @media(max-width:1180px){
        .admin-shell .admin-layout{width:min(100%,calc(100vw - 32px));}
        body[data-admin-page="user"] .users-table-wrap,
        body[data-admin-page="company"] .entra-table-wrap,
        body[data-admin-page="department"] .entra-table-wrap,
        body[data-admin-page="group"] .entra-table-wrap{overflow-x:auto;}
        body[data-admin-page="user"] .users-table{min-width:1060px!important;}
        body[data-admin-page="company"] .entra-table,
        body[data-admin-page="department"] .entra-table,
        body[data-admin-page="group"] .entra-table{min-width:760px!important;}
      }
      @media(max-width:760px){
        body[data-admin-page="user"] .user-search-shell,
        body[data-admin-page="company"] .entra-toolbar input,
        body[data-admin-page="department"] .entra-toolbar input,
        body[data-admin-page="group"] .entra-toolbar input{min-width:0;max-width:none;}
      }
    `;
    document.head.appendChild(style);
  }

  function currentPath() {
    const path = window.location.pathname || "/";
    return path === "/index.html" ? "/" : path;
  }

  function clearRememberedNav() {
    try { sessionStorage.removeItem(clickedNavStorageKey); } catch (error) {}
  }

  function navKey(item) {
    return item?.getAttribute("href") || item?.dataset?.navKey || "";
  }

  function setActiveByLocation() {
    const path = currentPath();
    document.querySelectorAll(".admin-shell .nav-item, .mobile-admin-menu-link").forEach((item) => {
      const href = navKey(item);
      const normalized = href === "/index.html" ? "/" : href;
      const active = normalized === path;
      item.classList.toggle("active", active);
      if (active) item.setAttribute("aria-current", "page");
      else item.removeAttribute("aria-current");
    });
  }

  function destinationLabel(href) {
    try {
      const path = new URL(href, window.location.origin).pathname || "/";
      return pageLabels[path] || path.replace(/^\/|\.html$/g, "") || "page";
    } catch (error) {
      return "page";
    }
  }

  function showNavigationPending(label) {
    const shell = document.querySelector(".admin-shell");
    const status = document.getElementById("status");
    const title = document.querySelector(".admin-header-title h1");
    const subtitle = document.querySelector(".admin-header-title p");
    shell?.classList.add("is-navigating");
    if (title) title.textContent = label;
    if (subtitle) subtitle.textContent = `Loading ${label.toLowerCase()} workspace...`;
    if (status) {
      status.textContent = `Loading ${label.toLowerCase()}...`;
      status.hidden = false;
      status.classList.remove("error");
    }
  }

  function wireNavigationLoading() {
    document.querySelectorAll(".admin-shell .nav-item[href], .mobile-admin-menu-link[href]").forEach((item) => {
      if (item.dataset.uxNavigationWired === "true") return;
      item.dataset.uxNavigationWired = "true";
      item.addEventListener("click", () => {
        const href = item.getAttribute("href") || "";
        if (!href || href.startsWith("#") || href === currentPath()) return;
        clearRememberedNav();
        showNavigationPending(destinationLabel(href));
      }, { capture: true });
    });
  }

  function labelActionButtons() {
    document.querySelectorAll("[data-archive]").forEach((button) => {
      button.textContent = "Archive";
      button.setAttribute("aria-label", "Archive record");
      button.setAttribute("title", "Archive record");
    });
    document.querySelectorAll("[data-reactivate], [data-user-reactivate]").forEach((button) => {
      button.textContent = "Reactivate";
      button.setAttribute("aria-label", "Reactivate record");
      button.setAttribute("title", "Reactivate record");
    });
    document.querySelectorAll("[data-user-disable]").forEach((button) => {
      button.textContent = "Disable";
      button.setAttribute("aria-label", "Disable user");
      button.setAttribute("title", "Disable user");
    });
    document.querySelectorAll("[data-purge], [data-user-purge]").forEach((button) => {
      button.textContent = "Delete";
      button.setAttribute("aria-label", "Delete record");
      button.setAttribute("title", "Delete record");
    });
  }

  function stabilize() {
    clearRememberedNav();
    setActiveByLocation();
    wireNavigationLoading();
    labelActionButtons();
  }

  addStyles();
  stabilize();
  window.addEventListener("pageshow", stabilize);
  new MutationObserver(stabilize).observe(document.body, { childList: true, subtree: true });
})();
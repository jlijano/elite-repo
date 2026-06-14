(() => {
  const sessionTokenStorageKey = "switchboard-session-token";
  const adminTokenStorageKey = "switchboard-admin-token";
  const legacyProfileStorageKey = "switchboard-user-profile";
  const sessionUserStorageKey = "switchboard-session-user";
  const adminPaths = new Set([
    "/chat.html",
    "/knowledge.html",
    "/company.html",
    "/department.html",
    "/group.html",
    "/user.html",
    "/playground.html",
    "/playground-projects.html",
    "/playground-tasks.html",
    "/playground-notes.html",
    "/playground-automation.html",
    "/reports.html",
    "/logs.html",
    "/review-runs.html",
    "/system-health.html",
    "/user-audit.html",
    "/settings.html",
    "/builder.html"
  ]);
  const navGroups = {
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
  const playgroundPages = navGroups.playground.pages;

  function storedSessionToken() {
    return sessionStorage.getItem(sessionTokenStorageKey) || "";
  }

  function isAdminRole(role) {
    return role === "owner" || role === "admin";
  }

  function currentPath() {
    return window.location.pathname || "/";
  }

  function onAdminPage() {
    return adminPaths.has(currentPath()) || document.body?.dataset.adminPage;
  }

  function safeRedirectTarget() {
    return `${currentPath()}${window.location.search || ""}${window.location.hash || ""}`;
  }

  function clearSessionState() {
    sessionStorage.removeItem(sessionTokenStorageKey);
    sessionStorage.removeItem(adminTokenStorageKey);
    sessionStorage.removeItem(sessionUserStorageKey);
    localStorage.removeItem(legacyProfileStorageKey);
  }

  function loginUrl(reason = "expired") {
    const params = new URLSearchParams({ redirect: safeRedirectTarget(), reason });
    return `/login.html?${params.toString()}`;
  }

  function redirectToLogin(reason = "expired") {
    clearSessionState();
    if (currentPath() !== "/login.html") window.location.replace(loginUrl(reason));
  }

  function redirectNonAdmin() {
    const params = new URLSearchParams({ reason: "not-admin" });
    window.location.replace(`/update-profile.html?${params.toString()}`);
  }

  function attachSessionHeader(options = {}) {
    const token = storedSessionToken();
    if (!token) return options;
    const headers = new Headers(options.headers || {});
    headers.set("x-session-token", token);
    return { ...options, headers };
  }

  function createIcon(value) {
    const icon = document.createElement("span");
    icon.className = "nav-icon";
    icon.setAttribute("aria-hidden", "true");
    icon.textContent = value;
    return icon;
  }

  function createNavLink({ href, label, icon, className = "" }) {
    const path = currentPath();
    const link = document.createElement("a");
    link.className = `nav-item${className ? ` ${className}` : ""}${href === path ? " active" : ""}`;
    link.href = href;
    link.dataset.navKey = href;
    if (href === path) link.setAttribute("aria-current", "page");
    link.append(createIcon(icon), label);
    return link;
  }

  function createBackLink() {
    const link = createNavLink({ href: "/", label: "", icon: "←", className: "nav-back" });
    link.setAttribute("aria-label", "Back to chat");
    link.title = "Back to chat";
    const label = document.createElement("span");
    label.className = "sr-only";
    label.textContent = "Back to chat";
    link.appendChild(label);
    return link;
  }

  function createNestedNav(group) {
    const path = currentPath();
    const active = group.pages.some((page) => page.href === path);
    const details = document.createElement("details");
    details.className = `admin-section-list reports-nav ${group.className}`;
    details.open = active || true;

    const summary = document.createElement("summary");
    summary.className = `reports-summary${active ? " active" : ""}`;
    summary.setAttribute("aria-label", `${group.label} menu`);
    const label = document.createElement("span");
    label.className = "reports-summary-label";
    label.append(createIcon(group.icon), group.label);
    const chevron = document.createElement("span");
    chevron.className = "reports-summary-chevron";
    chevron.setAttribute("aria-hidden", "true");
    chevron.textContent = "⌄";
    summary.append(label, chevron);

    const items = document.createElement("div");
    items.className = `reports-nav-items ${group.className}-items`;
    items.setAttribute("aria-label", group.itemLabel);
    group.pages.forEach((page) => items.appendChild(createNavLink(page)));

    details.append(summary, items);
    return details;
  }

  function makeBrandStatic() {
    const topbar = document.querySelector(".sidebar-topbar");
    const existingBrand = topbar?.querySelector(".brand-lockup");
    if (!topbar || !existingBrand || existingBrand.dataset.brandStatic === "true") return;
    const brand = document.createElement("div");
    brand.className = "brand-lockup brand-lockup-static";
    brand.dataset.brandStatic = "true";
    brand.setAttribute("role", "img");
    brand.setAttribute("aria-label", "Switchboard app");
    brand.append(createIcon("⌘"), document.createTextNode("Switchboard"));
    const icon = brand.querySelector(".nav-icon");
    icon.className = "brand-mark";
    existingBrand.replaceWith(brand);
  }

  function injectCanonicalSidebarStyles() {
    if (document.getElementById("canonicalSidebarNavStyles")) return;
    const style = document.createElement("style");
    style.id = "canonicalSidebarNavStyles";
    style.textContent = `
      .brand-lockup-static { cursor: default; user-select: none; }
      .brand-lockup-static:focus { outline: none; }
      .admin-shell .nav-back { width: 42px; min-height: 38px; justify-content: center; padding: 0; border: 1px solid var(--sidebar-line); border-radius: 50%; }
      .admin-shell .nav-back .nav-icon { margin: 0; font-size: 1.15rem; }
      .admin-shell .nav-back .sr-only { position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px; overflow: hidden; clip: rect(0, 0, 0, 0); white-space: nowrap; border: 0; }
      .admin-shell .reports-summary.active { background: var(--sidebar-card); color: var(--sidebar-text); box-shadow: inset 3px 0 0 var(--primary); }
      .reports-summary-label { min-width: 0; display: inline-flex; align-items: center; gap: 12px; }
      .reports-summary-label .nav-icon { width: 22px; flex: 0 0 22px; color: var(--sidebar-muted); text-align: center; font-size: 1.05rem; }
      .reports-summary.active .reports-summary-label .nav-icon { color: var(--primary); }
      .reports-nav-items .nav-item { min-height: 36px; padding-left: 18px; font-size: 0.92rem; }
      @media (max-width: 900px) {
        .admin-shell .nav-back { width: 36px; min-height: 36px; }
        .reports-nav-items .nav-item { padding-left: 10px; }
      }
    `;
    document.head.appendChild(style);
  }

  function renderCanonicalSidebarNav() {
    const nav = document.querySelector(".primary-nav");
    if (!nav) return;
    makeBrandStatic();
    injectCanonicalSidebarStyles();
    nav.replaceChildren(
      createBackLink(),
      createNavLink({ href: "/chat.html", label: "Chat", icon: "□" }),
      createNavLink({ href: "/knowledge.html", label: "Knowledge base", icon: "◇" }),
      createNestedNav(navGroups.entra),
      createNestedNav(navGroups.playground),
      createNestedNav(navGroups.settings),
      createNestedNav(navGroups.reports)
    );
  }

  function syncActiveNav() {
    const path = currentPath();
    document.querySelectorAll(".admin-shell .nav-item, .mobile-admin-menu-link").forEach((link) => {
      const href = link.getAttribute("href") || link.dataset.navKey || "";
      const active = href === path;
      link.classList.toggle("active", active);
      if (active) link.setAttribute("aria-current", "page");
      else link.removeAttribute("aria-current");
    });
    document.querySelectorAll(".reports-summary").forEach((summary) => {
      summary.classList.toggle("active", Boolean(summary.closest("details")?.querySelector(".nav-item.active")));
    });
  }

  function protectRealPlaygroundLinks() {
    document.addEventListener("click", (event) => {
      const link = event.target?.closest?.('a[href="/playground.html"]');
      if (!link || currentPath() === "/playground.html") return;
      event.preventDefault();
      event.stopImmediatePropagation();
      window.sessionStorage?.removeItem?.("switchboard-admin-clicked-nav");
      window.location.assign(link.href);
    }, true);
  }

  function resetAdminScrollPosition() {
    if (!onAdminPage()) return;
    if ("scrollRestoration" in window.history) window.history.scrollRestoration = "manual";
    requestAnimationFrame(() => {
      window.scrollTo(0, 0);
      document.querySelectorAll(".admin-scroll, .builder-canvas-frame, .builder-list, .builder-form").forEach((element) => {
        element.scrollTop = 0;
        element.scrollLeft = 0;
      });
    });
  }

  function normalizePlaygroundLabels() {
    document.querySelectorAll('a[href="/playground-automation.html"]').forEach((link) => {
      const label = "Automation";
      const icon = link.querySelector('span[aria-hidden="true"], .nav-icon');
      if (icon) {
        link.textContent = "";
        link.append(icon, label);
      } else {
        link.textContent = label;
      }
      link.title = label;
    });
  }

  function normalizeQuickActions() {
    const adminPage = String(document.body?.dataset.adminPage || "");
    if (!adminPage.startsWith("playground")) return;
    const actions = document.querySelector(".admin-header .header-actions");
    if (!actions || actions.dataset.normalizedPlaygroundActions === "true") return;
    const profileMenu = actions.querySelector(".profile-menu");
    actions.querySelectorAll("a.secondary-action").forEach((link) => {
      if (playgroundPages.some((page) => page.href === link.getAttribute("href"))) link.remove();
    });
    for (const page of playgroundPages) {
      const link = document.createElement("a");
      link.className = "secondary-action";
      link.href = page.href;
      link.textContent = page.label;
      link.title = page.label;
      if (page.href === currentPath()) {
        link.classList.add("active");
        link.setAttribute("aria-current", "page");
        link.setAttribute("aria-disabled", "true");
      }
      if (profileMenu) actions.insertBefore(link, profileMenu);
      else actions.appendChild(link);
    }
    actions.dataset.normalizedPlaygroundActions = "true";
  }

  function annotateDisabledRefreshButtons() {
    document.querySelectorAll('button:disabled').forEach((button) => {
      if (!/refresh/i.test(button.textContent || "")) return;
      const message = "Refresh is unavailable until this page has a live data source or pending request to reload.";
      button.title = message;
      button.setAttribute("aria-label", `${button.textContent.trim()}. ${message}`);
    });
  }

  function polishUserManagementLayout() {
    if (document.body?.dataset.adminPage !== "user") return;
    const search = document.getElementById("userSearch");
    if (search) {
      search.placeholder = "Search name, email, or username";
      search.title = "Search name, email, or username";
    }
    if (document.getElementById("userManagementResponsivePatch")) return;
    const style = document.createElement("style");
    style.id = "userManagementResponsivePatch";
    style.textContent = `
      body[data-admin-page="user"] .user-toolbar input { min-width: 240px; text-overflow: ellipsis; }
      body[data-admin-page="user"] .users-table-wrap { width: 100%; overflow-x: auto; scrollbar-width: thin; }
      body[data-admin-page="user"] .users-table { min-width: 0 !important; table-layout: fixed; }
      body[data-admin-page="user"] .users-table th, body[data-admin-page="user"] .users-table td { overflow-wrap: anywhere; }
      body[data-admin-page="user"] .users-table th:nth-child(1), body[data-admin-page="user"] .users-table td:nth-child(1) { width: 20%; }
      body[data-admin-page="user"] .users-table th:nth-child(2), body[data-admin-page="user"] .users-table td:nth-child(2) { width: 27%; }
      body[data-admin-page="user"] .users-table th:nth-child(3), body[data-admin-page="user"] .users-table td:nth-child(3) { width: 12%; }
      body[data-admin-page="user"] .users-table th:nth-child(4), body[data-admin-page="user"] .users-table td:nth-child(4) { width: 12%; }
      body[data-admin-page="user"] .users-table th:nth-child(5), body[data-admin-page="user"] .users-table td:nth-child(5) { width: 14%; }
      body[data-admin-page="user"] .users-table th:nth-child(6), body[data-admin-page="user"] .users-table td:nth-child(6) { width: 15%; }
      body[data-admin-page="user"] .users-table td:last-child { min-width: 140px; padding-left: 12px; }
      body[data-admin-page="user"] .users-table .actions { justify-content: flex-end; flex-wrap: wrap !important; gap: 8px; }
      @media (max-width: 900px) { body[data-admin-page="user"] .users-table { min-width: 720px !important; table-layout: auto; } }
      @media (max-width: 720px) { body[data-admin-page="user"] .users-table td:last-child { min-width: 0; padding-left: 0; } }
    `;
    document.head.appendChild(style);
  }

  function runLayoutPolish() {
    renderCanonicalSidebarNav();
    syncActiveNav();
    normalizePlaygroundLabels();
    normalizeQuickActions();
    annotateDisabledRefreshButtons();
    polishUserManagementLayout();
  }

  function updateRoleAwareMenu(user) {
    const admin = isAdminRole(user?.role);
    document.body.dataset.userRole = user?.role || "guest";
    document.querySelectorAll("[data-admin-only]").forEach((element) => { element.hidden = !admin; });
    if (admin) return;
    document.querySelectorAll(".primary-nav .nav-item").forEach((link) => {
      const href = link.getAttribute("href") || "";
      if (adminPaths.has(href)) {
        link.setAttribute("aria-disabled", "true");
        link.tabIndex = -1;
      }
    });
  }

  function persistUser(user) {
    if (!user) return;
    sessionStorage.setItem(sessionUserStorageKey, JSON.stringify({ id: user.id, name: user.name, email: user.email, role: user.role }));
    if (isAdminRole(user.role)) sessionStorage.setItem(adminTokenStorageKey, storedSessionToken());
    else sessionStorage.removeItem(adminTokenStorageKey);
  }

  async function bootstrapSession() {
    if (!onAdminPage()) return;
    const token = storedSessionToken();
    if (!token) return redirectToLogin("required");
    const response = await nativeFetch("/api/profile", {
      headers: { "x-session-token": token, "Content-Type": "application/json" }
    }).catch(() => null);
    if (!response || response.status === 401) return redirectToLogin("expired");
    const data = await response.json().catch(() => ({}));
    if (!response.ok) return redirectToLogin("expired");
    persistUser(data.user);
    updateRoleAwareMenu(data.user);
    if (!isAdminRole(data.user?.role)) redirectNonAdmin();
  }

  function loadScriptOnce(id, src) {
    if (document.getElementById(id)) return;
    const script = document.createElement("script");
    script.id = id;
    script.src = src;
    document.body.appendChild(script);
  }

  function loadUserOrgFields() {
    if (document.body?.dataset.adminPage !== "user") return;
    loadScriptOnce("userOrgFieldsScript", "/user-org-fields.js");
    loadScriptOnce("userEntraSuggestionsScript", "/user-entra-suggestions.js");
  }

  function loadPlaygroundCrud() {
    if (!String(document.body?.dataset.adminPage || "").startsWith("playground")) return;
    loadScriptOnce("playgroundCrudManagementScript", "/playground-management-ui.js");
  }

  const nativeFetch = window.fetch.bind(window);
  protectRealPlaygroundLinks();
  resetAdminScrollPosition();
  runLayoutPolish();

  window.fetch = async (input, options = {}) => {
    const url = typeof input === "string" ? input : input?.url || "";
    const requestOptions = url.includes("/api/admin/") ? attachSessionHeader(options) : options;
    const response = await nativeFetch(input, requestOptions);
    if (url.includes("/api/admin/") && (response.status === 401 || response.status === 403)) {
      redirectToLogin(response.status === 403 ? "not-admin" : "expired");
    }
    return response;
  };

  document.addEventListener("click", (event) => {
    if (!event.target.closest(".profile-logout") && !event.target.closest("#logoutButton")) return;
    const token = storedSessionToken();
    clearSessionState();
    if (token) {
      nativeFetch("/api/auth/logout", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-session-token": token },
        body: "{}",
        keepalive: true
      }).catch(() => {});
    }
  }, true);

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", bootstrapSession, { once: true });
    document.addEventListener("DOMContentLoaded", runLayoutPolish, { once: true });
    document.addEventListener("DOMContentLoaded", resetAdminScrollPosition, { once: true });
    document.addEventListener("DOMContentLoaded", loadUserOrgFields, { once: true });
    document.addEventListener("DOMContentLoaded", loadPlaygroundCrud, { once: true });
  } else {
    bootstrapSession();
    loadUserOrgFields();
    loadPlaygroundCrud();
    runLayoutPolish();
  }
})();
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
    "/settings.html"
  ]);
  const entraPages = [
    { href: "/company.html", label: "Company", icon: "▣" },
    { href: "/department.html", label: "Department", icon: "◇" },
    { href: "/group.html", label: "Group", icon: "▦" },
    { href: "/user.html", label: "User", icon: "◉" }
  ];
  const playgroundPages = [
    { href: "/playground.html", label: "Board", icon: "▦" },
    { href: "/playground-projects.html", label: "Projects", icon: "▣" },
    { href: "/playground-tasks.html", label: "Tasks", icon: "☑" },
    { href: "/playground-notes.html", label: "Notes", icon: "✎" },
    { href: "/playground-automation.html", label: "Automations", icon: "⚙" }
  ];

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

  function nestedAdminNav({ className, summaryLabel, summaryIcon = "", itemLabel, pages }) {
    const path = currentPath();
    const active = pages.some((page) => page.href === path);
    const details = document.createElement("details");
    details.className = `admin-section-list reports-nav ${className}`;
    details.open = true;

    const summary = document.createElement("summary");
    summary.className = `reports-summary${active ? " active" : ""}`;
    const iconMarkup = summaryIcon ? `<span aria-hidden="true">${summaryIcon}</span>` : "";
    summary.innerHTML = `<span class="reports-summary-label">${iconMarkup}${summaryLabel}</span><span class="reports-summary-chevron" aria-hidden="true">⌄</span>`;

    const items = document.createElement("div");
    items.className = `reports-nav-items ${className}-items`;
    items.setAttribute("aria-label", itemLabel);

    for (const page of pages) {
      const link = document.createElement("a");
      link.className = `nav-item${page.href === path ? " active" : ""}`;
      link.href = page.href;
      link.dataset.navKey = page.href;
      if (page.href === path) link.setAttribute("aria-current", "page");
      const icon = document.createElement("span");
      icon.setAttribute("aria-hidden", "true");
      icon.textContent = page.icon;
      link.append(icon, page.label);
      items.appendChild(link);
    }

    details.append(summary, items);
    return details;
  }

  function initEntraNav() {
    const nav = document.querySelector(".primary-nav");
    const userLink = nav?.querySelector('a.nav-item[href="/user.html"]');
    if (!nav || !userLink || nav.querySelector(".entra-nav")) return;
    userLink.replaceWith(nestedAdminNav({ className: "entra-nav", summaryLabel: "Entra", summaryIcon: "◉", itemLabel: "Entra navigation", pages: entraPages }));
  }

  function initPlaygroundNav() {
    const nav = document.querySelector(".primary-nav");
    if (!nav || nav.querySelector(".playground-nav")) return;
    const playgroundLink = nav.querySelector('a.nav-item[href="/playground.html"]');
    const tasksLink = nav.querySelector('a.nav-item[href="/playground-tasks.html"]');
    const anchor = playgroundLink || tasksLink;
    if (!anchor) return;
    tasksLink?.remove();
    anchor.replaceWith(nestedAdminNav({ className: "playground-nav", summaryLabel: "Playground", itemLabel: "Playground navigation", pages: playgroundPages }));
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
      const label = "Automations";
      const icon = link.querySelector('span[aria-hidden="true"]');
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
      body[data-admin-page="user"] .user-toolbar input {
        min-width: 240px;
        text-overflow: ellipsis;
      }
      body[data-admin-page="user"] .users-table-wrap {
        width: 100%;
        overflow-x: auto;
        scrollbar-width: thin;
      }
      body[data-admin-page="user"] .users-table {
        min-width: 0 !important;
        table-layout: fixed;
      }
      body[data-admin-page="user"] .users-table th,
      body[data-admin-page="user"] .users-table td {
        overflow-wrap: anywhere;
      }
      body[data-admin-page="user"] .users-table th:nth-child(1),
      body[data-admin-page="user"] .users-table td:nth-child(1) { width: 20%; }
      body[data-admin-page="user"] .users-table th:nth-child(2),
      body[data-admin-page="user"] .users-table td:nth-child(2) { width: 27%; }
      body[data-admin-page="user"] .users-table th:nth-child(3),
      body[data-admin-page="user"] .users-table td:nth-child(3) { width: 12%; }
      body[data-admin-page="user"] .users-table th:nth-child(4),
      body[data-admin-page="user"] .users-table td:nth-child(4) { width: 12%; }
      body[data-admin-page="user"] .users-table th:nth-child(5),
      body[data-admin-page="user"] .users-table td:nth-child(5) { width: 14%; }
      body[data-admin-page="user"] .users-table th:nth-child(6),
      body[data-admin-page="user"] .users-table td:nth-child(6) { width: 15%; }
      body[data-admin-page="user"] .users-table td:last-child {
        min-width: 140px;
        padding-left: 12px;
      }
      body[data-admin-page="user"] .users-table .actions {
        justify-content: flex-end;
        flex-wrap: wrap !important;
        gap: 8px;
      }
      @media (max-width: 900px) {
        body[data-admin-page="user"] .users-table {
          min-width: 720px !important;
          table-layout: auto;
        }
      }
      @media (max-width: 720px) {
        body[data-admin-page="user"] .users-table td:last-child {
          min-width: 0;
          padding-left: 0;
        }
      }
    `;
    document.head.appendChild(style);
  }

  function runLayoutPolish() {
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
  initPlaygroundNav();
  initEntraNav();
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
    document.addEventListener("DOMContentLoaded", initPlaygroundNav, { once: true });
    document.addEventListener("DOMContentLoaded", initEntraNav, { once: true });
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
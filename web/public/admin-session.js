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
    "/playground-tasks.html",
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

  function initEntraNav() {
    const nav = document.querySelector(".primary-nav");
    const userLink = nav?.querySelector('a.nav-item[href="/user.html"]');
    if (!nav || !userLink || nav.querySelector(".entra-nav")) return;

    const path = currentPath();
    const isEntraPage = entraPages.some((page) => page.href === path);
    const details = document.createElement("details");
    details.className = "admin-section-list reports-nav entra-nav";
    details.open = true;

    const summary = document.createElement("summary");
    summary.className = `reports-summary${isEntraPage ? " active" : ""}`;
    summary.innerHTML = '<span class="reports-summary-label"><span aria-hidden="true">◉</span>Entra</span><span class="reports-summary-chevron" aria-hidden="true">⌄</span>';

    const items = document.createElement("div");
    items.className = "reports-nav-items entra-nav-items";
    items.setAttribute("aria-label", "Entra navigation");

    for (const page of entraPages) {
      const link = document.createElement("a");
      link.className = `nav-item${page.href === path ? " active" : ""}`;
      link.href = page.href;
      if (page.href === path) link.setAttribute("aria-current", "page");
      const icon = document.createElement("span");
      icon.setAttribute("aria-hidden", "true");
      icon.textContent = page.icon;
      link.append(icon, page.label);
      items.appendChild(link);
    }

    details.append(summary, items);
    userLink.replaceWith(details);
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

  const nativeFetch = window.fetch.bind(window);
  initEntraNav();

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
    document.addEventListener("DOMContentLoaded", initEntraNav, { once: true });
    document.addEventListener("DOMContentLoaded", loadUserOrgFields, { once: true });
  } else {
    bootstrapSession();
    loadUserOrgFields();
  }
})();

(() => {
  const sessionTokenStorageKey = "switchboard-session-token";
  const adminTokenStorageKey = "switchboard-admin-token";
  const legacyProfileStorageKey = "switchboard-user-profile";
  const sessionUserStorageKey = "switchboard-session-user";
  const adminPaths = new Set([
    "/chat.html",
    "/knowledge.html",
    "/user.html",
    "/playground.html",
    "/reports.html",
    "/logs.html",
    "/review-runs.html",
    "/system-health.html",
    "/user-audit.html",
    "/settings.html"
  ]);

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

  function renderLoggedInAs(user) {
    const actions = document.querySelector(".header-actions");
    if (!actions || actions.querySelector(".session-user-chip")) return;
    const chip = document.createElement("span");
    chip.className = "session-user-chip";
    const name = document.createElement("strong");
    name.textContent = user?.name || user?.email || "Signed in";
    const role = document.createElement("small");
    role.textContent = user?.role ? `Logged in as ${user.role}` : "Logged in";
    chip.append(name, role);
    actions.prepend(chip);
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
    renderLoggedInAs(data.user);
    if (!isAdminRole(data.user?.role)) redirectNonAdmin();
  }

  const nativeFetch = window.fetch.bind(window);
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
  } else {
    bootstrapSession();
  }
})();

(() => {
  const sessionTokenStorageKey = "switchboard-session-token";
  const adminTokenStorageKey = "switchboard-admin-token";
  const legacyProfileStorageKey = "switchboard-user-profile";

  function storedSessionToken() {
    return sessionStorage.getItem(sessionTokenStorageKey) || "";
  }

  function attachSessionHeader(options = {}) {
    const token = storedSessionToken();
    if (!token) return options;
    const headers = new Headers(options.headers || {});
    headers.set("x-session-token", token);
    return { ...options, headers };
  }

  const nativeFetch = window.fetch.bind(window);
  window.fetch = (input, options = {}) => {
    const url = typeof input === "string" ? input : input?.url || "";
    const requestOptions = url.includes("/api/admin/") ? attachSessionHeader(options) : options;
    return nativeFetch(input, requestOptions);
  };

  document.addEventListener("click", (event) => {
    if (!event.target.closest(".profile-logout") && !event.target.closest("#logoutButton")) return;
    const token = storedSessionToken();
    sessionStorage.removeItem(sessionTokenStorageKey);
    sessionStorage.removeItem(adminTokenStorageKey);
    localStorage.removeItem(legacyProfileStorageKey);
    if (token) {
      nativeFetch("/api/auth/logout", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-session-token": token },
        body: "{}",
        keepalive: true
      }).catch(() => {});
    }
  }, true);
})();

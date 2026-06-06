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

const form = document.getElementById("loginForm");
const email = document.getElementById("loginEmail");
const password = document.getElementById("loginPassword");
const status = document.getElementById("loginStatus");

function setLoginStatus(message, error = false) {
  if (!status) return;
  status.textContent = message;
  status.hidden = false;
  status.classList.toggle("error", error);
}

function isAdminRole(role) {
  return role === "owner" || role === "admin";
}

function safeRequestedPath(value) {
  if (!value || !value.startsWith("/") || value.startsWith("//")) return "";
  try {
    return new URL(value, window.location.origin).pathname;
  } catch {
    return "";
  }
}

function redirectTarget(user) {
  const params = new URLSearchParams(window.location.search);
  const requested = params.get("redirect");
  const requestedPath = safeRequestedPath(requested);
  if (requested && requestedPath) {
    if (!adminPaths.has(requestedPath) || isAdminRole(user?.role)) return requested;
  }
  return isAdminRole(user?.role) ? "/user.html" : "/update-profile.html?reason=not-admin";
}

function explainReason() {
  const reason = new URLSearchParams(window.location.search).get("reason");
  if (reason === "expired") setLoginStatus("Your session expired. Please sign in again.", true);
  if (reason === "required") setLoginStatus("Please sign in to continue.", true);
  if (reason === "not-admin") setLoginStatus("That area requires an admin account. Sign in with an admin user to continue.", true);
}

form?.addEventListener("submit", async (event) => {
  event.preventDefault();
  setLoginStatus("Signing in...");
  try {
    const response = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: email?.value || "", password: password?.value || "" })
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || "Could not log in.");
    sessionStorage.setItem(sessionTokenStorageKey, data.sessionToken);
    sessionStorage.setItem(sessionUserStorageKey, JSON.stringify({ id: data.user?.id, name: data.user?.name, email: data.user?.email, role: data.user?.role }));
    localStorage.removeItem(legacyProfileStorageKey);
    if (isAdminRole(data.user?.role)) {
      sessionStorage.setItem(adminTokenStorageKey, data.sessionToken);
    } else {
      sessionStorage.removeItem(adminTokenStorageKey);
    }
    window.location.href = redirectTarget(data.user);
  } catch (error) {
    setLoginStatus(error.message, true);
  }
});

explainReason();

const sessionTokenStorageKey = "switchboard-session-token";
const adminTokenStorageKey = "switchboard-admin-token";
const legacyProfileStorageKey = "switchboard-user-profile";

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

function redirectTarget(user) {
  const params = new URLSearchParams(window.location.search);
  const requested = params.get("redirect");
  if (requested && requested.startsWith("/") && !requested.startsWith("//")) return requested;
  return ["owner", "admin"].includes(user?.role) ? "/user.html" : "/update-profile.html";
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
    localStorage.removeItem(legacyProfileStorageKey);
    if (["owner", "admin"].includes(data.user?.role)) {
      sessionStorage.setItem(adminTokenStorageKey, data.sessionToken);
    } else {
      sessionStorage.removeItem(adminTokenStorageKey);
    }
    window.location.href = redirectTarget(data.user);
  } catch (error) {
    setLoginStatus(error.message, true);
  }
});

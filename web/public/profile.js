const themeStorageKey = "switchboard-theme";
const sessionTokenStorageKey = "switchboard-session-token";
const adminTokenStorageKey = "switchboard-admin-token";
const legacyProfileStorageKey = "switchboard-user-profile";
const sessionUserStorageKey = "switchboard-session-user";
const minPasswordLength = 12;

const $ = (id) => document.getElementById(id);
const els = {
  status: $("status"),
  menuClock: $("menuClock"),
  profileMenuButton: $("profileMenuButton"),
  profileDropdown: $("profileDropdown"),
  profileLogoutButtons: document.querySelectorAll(".profile-logout"),
  profileForm: $("profileForm"),
  profilePhoto: $("profilePhoto"),
  profileName: $("profileName"),
  profileEmail: $("profileEmail"),
  profileCurrentPassword: $("profileCurrentPassword"),
  profileNewPassword: $("profileNewPassword"),
  profileConfirmPassword: $("profileConfirmPassword"),
  profilePhotoPreview: $("profilePhotoPreview")
};

const html = (value) => String(value ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

function setStatus(message, error = false) {
  if (!els.status) return;
  els.status.textContent = message;
  els.status.hidden = false;
  els.status.classList.toggle("error", error);
}

function sessionToken() {
  return sessionStorage.getItem(sessionTokenStorageKey) || "";
}

function isAdminRole(role) {
  return role === "owner" || role === "admin";
}

function authHeaders() {
  return { "Content-Type": "application/json", "x-session-token": sessionToken() };
}

function clearSessionState() {
  sessionStorage.removeItem(sessionTokenStorageKey);
  sessionStorage.removeItem(adminTokenStorageKey);
  sessionStorage.removeItem(sessionUserStorageKey);
  localStorage.removeItem(legacyProfileStorageKey);
}

function persistSessionUser(user) {
  if (!user) return;
  sessionStorage.setItem(sessionUserStorageKey, JSON.stringify({ id: user.id, name: user.name, email: user.email, role: user.role }));
  if (isAdminRole(user.role)) sessionStorage.setItem(adminTokenStorageKey, sessionToken());
  else sessionStorage.removeItem(adminTokenStorageKey);
}

function redirectToLogin(reason = "expired") {
  clearSessionState();
  const params = new URLSearchParams({ redirect: "/update-profile.html", reason });
  window.location.href = `/login.html?${params.toString()}`;
}

async function fetchJson(url, options = {}) {
  const response = await fetch(url, { ...options, headers: { ...authHeaders(), ...(options.headers || {}) } });
  const data = await response.json().catch(() => ({}));
  if (response.status === 401) redirectToLogin("expired");
  if (!response.ok) {
    const error = new Error(data.error || "Request failed.");
    error.status = response.status;
    throw error;
  }
  return data;
}

function updateClock() {
  if (!els.menuClock) return;
  els.menuClock.textContent = new Intl.DateTimeFormat(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit"
  }).format(new Date());
}

function updateProfilePreview(photo = "") {
  if (!els.profilePhotoPreview) return;
  const safePhoto = String(photo || "").trim();
  els.profilePhotoPreview.innerHTML = safePhoto ? `<img src="${html(safePhoto)}" alt="">` : "👤";
}

function clearPasswordFields() {
  [els.profileCurrentPassword, els.profileNewPassword, els.profileConfirmPassword].forEach((field) => {
    if (field) field.value = "";
  });
}

function setProfileDropdownOpen(open) {
  if (!els.profileMenuButton || !els.profileDropdown) return;
  els.profileMenuButton.setAttribute("aria-expanded", String(open));
  els.profileDropdown.hidden = !open;
}

function closeProfileDropdown() {
  setProfileDropdownOpen(false);
}

function explainReason() {
  const reason = new URLSearchParams(window.location.search).get("reason");
  if (reason === "not-admin") setStatus("You are signed in, but admin pages require an owner or admin role.", true);
}

async function logout() {
  const token = sessionToken();
  if (token) {
    await fetch("/api/auth/logout", { method: "POST", headers: authHeaders(), body: "{}", keepalive: true }).catch(() => {});
  }
  clearSessionState();
  window.location.href = "/login.html";
}

async function loadProfile() {
  localStorage.removeItem(legacyProfileStorageKey);
  if (!sessionToken()) {
    setStatus("Login required. Redirecting to the login page...", true);
    redirectToLogin("required");
    return;
  }
  if (!els.status?.textContent) setStatus("Loading profile...");
  const data = await fetchJson("/api/profile");
  persistSessionUser(data.user);
  els.profilePhoto.value = data.user?.photoUrl || "";
  els.profileName.value = data.user?.name || "";
  els.profileEmail.value = data.user?.email || "";
  updateProfilePreview(data.user?.photoUrl || "");
  if (!els.status?.classList.contains("error")) setStatus("Profile loaded.");
}

async function saveProfile(event) {
  event.preventDefault();
  const newPassword = els.profileNewPassword?.value || "";
  const confirmPassword = els.profileConfirmPassword?.value || "";
  const currentPassword = els.profileCurrentPassword?.value || "";
  if (newPassword || confirmPassword) {
    if (newPassword.length < minPasswordLength) return setStatus(`New password must be at least ${minPasswordLength} characters.`, true);
    if (new Set(newPassword).size < 4) return setStatus("New password must use at least four different characters.", true);
    if (newPassword !== confirmPassword) return setStatus("New password and confirmation must match.", true);
    if (!currentPassword) return setStatus("Current password is required to change your password.", true);
  }
  setStatus("Saving profile...");
  try {
    const data = await fetchJson("/api/profile", {
      method: "PATCH",
      body: JSON.stringify({
        photoUrl: els.profilePhoto?.value || "",
        name: els.profileName?.value || "",
        email: els.profileEmail?.value || "",
        currentPassword,
        newPassword
      })
    });
    if (data.sessionToken) {
      sessionStorage.setItem(sessionTokenStorageKey, data.sessionToken);
    }
    persistSessionUser(data.user);
    clearPasswordFields();
    updateProfilePreview(data.user?.photoUrl || "");
    setStatus(data.passwordChanged ? "Profile and password updated. Your session was refreshed." : "Profile updated.");
  } catch (error) {
    if (error.status !== 401) setStatus(error.message, true);
  }
}

updateClock();
setInterval(updateClock, 30000);
explainReason();
els.profilePhoto?.addEventListener("input", () => updateProfilePreview(els.profilePhoto.value));
els.profileForm?.addEventListener("submit", saveProfile);
els.profileMenuButton?.addEventListener("click", () => setProfileDropdownOpen(els.profileDropdown?.hidden !== false));
els.profileLogoutButtons.forEach((button) => button.addEventListener("click", logout));
document.addEventListener("click", (event) => {
  if (!els.profileDropdown || !els.profileMenuButton) return;
  if (els.profileDropdown.hidden) return;
  if (event.target.closest(".profile-menu")) return;
  closeProfileDropdown();
});
document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") closeProfileDropdown();
});
loadProfile().catch((error) => {
  if (error.status !== 401) setStatus(error.message, true);
});

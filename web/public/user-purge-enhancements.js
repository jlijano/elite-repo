(function enhanceUserPurgeActions() {
  if (document.body?.dataset?.adminPage !== "user") return;

  function sessionHeaders() {
    const headers = { "Content-Type": "application/json" };
    const sessionToken = sessionStorage.getItem("switchboard-session-token") || localStorage.getItem("switchboard_session_token");
    const adminToken = sessionStorage.getItem("switchboard-admin-token") || localStorage.getItem("switchboard_admin_token");
    if (sessionToken) headers["x-session-token"] = sessionToken;
    if (adminToken) headers["x-admin-token"] = adminToken;
    return headers;
  }

  function isGlobalAdmin() {
    try {
      const user = JSON.parse(sessionStorage.getItem("switchboard-session-user") || "{}");
      return user.role === "owner";
    } catch (error) {
      return false;
    }
  }

  function addStyles() {
    if (document.getElementById("userPurgeEnhancementStyles")) return;
    const style = document.createElement("style");
    style.id = "userPurgeEnhancementStyles";
    style.textContent = `
      .danger-action {
        border-color: rgba(239, 68, 68, 0.28) !important;
        color: #b91c1c !important;
        background: rgba(254, 242, 242, 0.78) !important;
      }

      .danger-action:hover {
        border-color: rgba(220, 38, 38, 0.45) !important;
        background: rgba(254, 226, 226, 0.92) !important;
      }
    `;
    document.head.appendChild(style);
  }

  function rowUserId(row) {
    return row.querySelector("[data-user-edit]")?.dataset.userEdit ||
      row.querySelector("[data-user-disable]")?.dataset.userDisable ||
      row.querySelector("[data-user-reactivate]")?.dataset.userReactivate ||
      row.querySelector("[data-user-purge]")?.dataset.userPurge ||
      "";
  }

  function enhanceRows() {
    if (!isGlobalAdmin()) return;
    const list = document.getElementById("users");
    if (!list) return;
    list.querySelectorAll("tr, .user-card, li, article").forEach((row) => {
      const userId = rowUserId(row);
      if (!userId || row.querySelector("[data-user-purge]")) return;
      const actions = row.querySelector(".actions, .user-actions, td:last-child") || row;
      const button = document.createElement("button");
      button.type = "button";
      button.className = "danger-action";
      button.dataset.userPurge = userId;
      button.textContent = "Delete";
      actions.appendChild(button);
    });
  }

  async function deleteUser(userId) {
    const confirmed = window.confirm("Permanently delete this user? This cannot be undone.");
    if (!confirmed) return;
    const response = await fetch(`/api/admin/users/${encodeURIComponent(userId)}`, {
      method: "DELETE",
      headers: sessionHeaders(),
      credentials: "same-origin"
    });
    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      throw new Error(data.error || "Could not delete user.");
    }
    window.location.reload();
  }

  function bindClicks() {
    document.addEventListener("click", async (event) => {
      const button = event.target.closest("[data-user-purge]");
      if (!button) return;
      event.preventDefault();
      event.stopPropagation();
      button.disabled = true;
      try {
        await deleteUser(button.dataset.userPurge);
      } catch (error) {
        button.disabled = false;
        window.alert(error.message || "Delete failed.");
      }
    });
  }

  function observeUsers() {
    const list = document.getElementById("users");
    if (!list) return;
    enhanceRows();
    new MutationObserver(enhanceRows).observe(list, { childList: true, subtree: true });
  }

  addStyles();
  bindClicks();
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", observeUsers);
  } else {
    observeUsers();
  }
})();
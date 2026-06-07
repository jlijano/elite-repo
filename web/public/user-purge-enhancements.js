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
      body[data-admin-page="user"] .danger-action {
        color: #ff5252 !important;
      }

      body[data-admin-page="user"] .users-table .actions .danger-action {
        background: transparent !important;
        border: 0 !important;
      }

      body[data-admin-page="user"] .user-item .danger-action {
        border-color: rgba(239, 68, 68, 0.28) !important;
        color: #b91c1c !important;
        background: rgba(254, 242, 242, 0.78) !important;
      }

      body[data-admin-page="user"] .user-item .danger-action:hover {
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

  function actionsContainer(row) {
    if (row.closest(".users-table")) {
      return row.querySelector(".actions") || row.cells?.[row.cells.length - 1] || null;
    }
    return row.querySelector(".actions, .user-actions") || row;
  }

  function ensurePurgeButtons() {
    const list = document.getElementById("users");
    if (!list || !isGlobalAdmin()) return;

    list.querySelectorAll(".users-table tbody tr, .user-item, article").forEach((row) => {
      const userId = rowUserId(row);
      const actions = actionsContainer(row);
      if (!userId || !actions || actions.querySelector("[data-user-purge]")) return;

      const button = document.createElement("button");
      button.type = "button";
      button.className = "danger-action";
      button.dataset.userPurge = userId;
      button.textContent = "x";
      button.setAttribute("aria-label", "Delete user");
      button.setAttribute("title", "Delete user");
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
    ensurePurgeButtons();
    if (list) new MutationObserver(ensurePurgeButtons).observe(list, { childList: true, subtree: true });
  }

  addStyles();
  bindClicks();
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", observeUsers, { once: true });
  } else {
    observeUsers();
  }
})();
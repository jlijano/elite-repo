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

      .user-name-edit-trigger {
        appearance: none;
        display: inline-flex;
        flex-direction: column;
        align-items: flex-start;
        gap: 0.35rem;
        width: 100%;
        padding: 0;
        border: 0 !important;
        border-radius: 0;
        color: inherit;
        background: transparent !important;
        box-shadow: none !important;
        font: inherit;
        text-align: left;
        cursor: pointer;
      }

      .user-name-edit-trigger:focus {
        outline: none;
      }

      .user-name-edit-trigger:focus-visible {
        outline: none;
      }

      .user-name-edit-trigger > span:first-child {
        position: relative;
        display: inline-flex;
        color: inherit;
        font-weight: 700;
      }

      .user-name-edit-trigger > span:first-child::after {
        content: "";
        position: absolute;
        left: 0;
        right: 0;
        bottom: -0.18rem;
        height: 2px;
        border-radius: 999px;
        background: currentColor;
        transform: scaleX(0);
        transform-origin: left;
        transition: transform 160ms ease;
      }

      .user-name-edit-trigger:hover > span:first-child::after,
      .user-name-edit-trigger:focus-visible > span:first-child::after {
        transform: scaleX(1);
      }

      .user-edit-action-hidden {
        display: none !important;
      }

      .user-transfer-menu {
        position: relative;
        flex: 0 0 auto;
        display: inline-flex;
        align-items: center;
      }

      .user-transfer-toggle {
        width: 40px;
        min-width: 40px !important;
        min-height: 38px;
        padding: 0 !important;
        display: inline-grid;
        place-items: center;
        font-size: 1rem;
        line-height: 1;
      }

      .user-transfer-menu-list {
        position: absolute;
        top: calc(100% + 8px);
        right: 0;
        z-index: 30;
        min-width: 180px;
        display: grid;
        gap: 4px;
        padding: 6px;
        border: 1px solid var(--line);
        border-radius: var(--radius);
        background: var(--panel);
        box-shadow: 0 18px 44px rgba(0, 0, 0, 0.18);
      }

      .user-transfer-menu-list[hidden] {
        display: none;
      }

      .user-transfer-menu-list button {
        width: 100%;
        justify-content: flex-start;
        text-align: left;
        background: transparent !important;
        border-color: transparent !important;
      }

      .user-transfer-menu-list button:hover,
      .user-transfer-menu-list button:focus-visible {
        background: var(--panel-soft) !important;
        border-color: var(--line) !important;
      }

      body[data-admin-page="user"] .users-table.user-list-compact {
        min-width: 620px;
      }

      @media (max-width: 520px) {
        .user-transfer-menu {
          width: 100%;
        }

        .user-transfer-toggle {
          width: 100%;
        }

        .user-transfer-menu-list {
          left: 0;
          right: 0;
        }

        body[data-admin-page="user"] .users-table.user-list-compact td:nth-child(5) {
          display: block;
          padding-top: 8px;
        }

        body[data-admin-page="user"] .users-table.user-list-compact td:nth-child(5)::before {
          content: none;
        }
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

  function hideEditButton(button) {
    if (!button || button.classList.contains("user-edit-action-hidden")) return;
    button.classList.add("user-edit-action-hidden");
    button.hidden = true;
    button.tabIndex = -1;
    button.setAttribute("aria-hidden", "true");
  }

  function openUserDialogFallback() {
    const dialog = document.getElementById("userDialog");
    if (dialog && !dialog.open) {
      if (typeof dialog.showModal === "function") {
        dialog.showModal();
      } else {
        dialog.setAttribute("open", "");
      }
    }

    window.setTimeout(() => {
      document.getElementById("userPhotoUrl")?.dispatchEvent(new Event("input", { bubbles: true }));
      document.getElementById("userName")?.focus();
    }, 0);
  }

  function bindNameTrigger(trigger, editButton, nameText) {
    trigger.type = "button";
    trigger.className = "user-name-edit-trigger";
    trigger.dataset.userEdit = editButton.dataset.userEdit || "";
    trigger.setAttribute("aria-label", `Edit ${nameText || "user"}`);
    trigger.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      editButton.click();
      window.setTimeout(openUserDialogFallback, 0);
    });
  }

  function enhanceNameTrigger(row, editButton) {
    if (!editButton || row.querySelector(".user-name-edit-trigger")) return;
    const titleRow = row.querySelector(".row");
    const name = titleRow?.querySelector("span:first-child");
    if (titleRow && name) {
      const trigger = document.createElement("button");
      bindNameTrigger(trigger, editButton, name.textContent?.trim());
      titleRow.replaceChild(trigger, name);
      trigger.appendChild(name);
      return;
    }

    const nameCell = row.querySelector("td:first-child");
    if (!nameCell) return;
    const nameText = nameCell.textContent?.trim() || "user";
    const trigger = document.createElement("button");
    bindNameTrigger(trigger, editButton, nameText);
    const label = document.createElement("span");
    label.textContent = nameText;
    trigger.appendChild(label);
    nameCell.replaceChildren(trigger);
  }

  function hideListOnlyFields() {
    const list = document.getElementById("users");
    if (!list) return;

    list.querySelectorAll(".user-item > p").forEach((paragraph) => {
      if (/^Updated\b/i.test(paragraph.textContent?.trim() || "")) paragraph.hidden = true;
    });

    list.querySelectorAll("table").forEach((table) => {
      const headers = Array.from(table.querySelectorAll("thead th"));
      if (!headers.length) return;
      const hiddenColumnLabels = new Set(["department", "group", "updated"]);
      const columnsToRemove = headers
        .map((header, index) => ({ header, index }))
        .filter(({ header }) => hiddenColumnLabels.has((header.textContent || "").trim().toLowerCase()))
        .map(({ index }) => index)
        .sort((left, right) => right - left);

      if (!columnsToRemove.length) return;
      columnsToRemove.forEach((index) => {
        table.querySelectorAll("tr").forEach((row) => row.children[index]?.remove());
      });
      table.classList.add("user-list-compact");
    });
  }

  function enhanceRows() {
    const list = document.getElementById("users");
    if (!list) return;
    hideListOnlyFields();
    list.querySelectorAll("tr, .user-card, li, article").forEach((row) => {
      const editButton = row.querySelector("[data-user-edit]");
      const userId = rowUserId(row);
      const actions = row.querySelector(".actions, .user-actions, td:last-child") || row;

      if (editButton) {
        enhanceNameTrigger(row, editButton);
        hideEditButton(editButton);
      }

      if (!isGlobalAdmin() || !userId || row.querySelector("[data-user-purge]")) return;
      const button = document.createElement("button");
      button.type = "button";
      button.className = "danger-action";
      button.dataset.userPurge = userId;
      button.textContent = "Delete";
      actions.appendChild(button);
    });
  }

  function isTransferButton(button) {
    const label = (button.textContent || button.getAttribute("aria-label") || "").trim().toLowerCase();
    return /\b(import|export)\b/.test(label) && /\buser/.test(label);
  }

  function enhanceTransferMenu() {
    const toolbar = document.querySelector(".user-toolbar");
    if (!toolbar || toolbar.querySelector(".user-transfer-menu")) return;
    const transferButtons = Array.from(toolbar.querySelectorAll("button")).filter((button) => {
      if (button.id === "manageUsersButton") return false;
      return isTransferButton(button);
    });
    if (transferButtons.length < 2) return;

    const menu = document.createElement("div");
    menu.className = "user-transfer-menu";

    const toggle = document.createElement("button");
    toggle.type = "button";
    toggle.className = "user-transfer-toggle";
    toggle.setAttribute("aria-label", "Open user import and export menu");
    toggle.setAttribute("aria-haspopup", "true");
    toggle.setAttribute("aria-expanded", "false");
    toggle.textContent = "⇅";

    const list = document.createElement("div");
    list.className = "user-transfer-menu-list";
    list.hidden = true;
    list.setAttribute("role", "menu");

    transferButtons.forEach((button) => {
      button.setAttribute("role", "menuitem");
      list.appendChild(button);
    });

    toggle.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      list.hidden = !list.hidden;
      toggle.setAttribute("aria-expanded", String(!list.hidden));
    });

    list.addEventListener("click", () => {
      list.hidden = true;
      toggle.setAttribute("aria-expanded", "false");
    });

    document.addEventListener("click", (event) => {
      if (list.hidden || menu.contains(event.target)) return;
      list.hidden = true;
      toggle.setAttribute("aria-expanded", "false");
    });

    document.addEventListener("keydown", (event) => {
      if (event.key !== "Escape" || list.hidden) return;
      list.hidden = true;
      toggle.setAttribute("aria-expanded", "false");
      toggle.focus();
    });

    menu.appendChild(toggle);
    menu.appendChild(list);
    const addButton = document.getElementById("manageUsersButton");
    if (addButton?.parentElement === toolbar) addButton.insertAdjacentElement("afterend", menu);
    else toolbar.appendChild(menu);
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
    enhanceTransferMenu();
    if (list) {
      enhanceRows();
      new MutationObserver(enhanceRows).observe(list, { childList: true, subtree: true });
    }
    const toolbar = document.querySelector(".user-toolbar");
    if (toolbar) new MutationObserver(enhanceTransferMenu).observe(toolbar, { childList: true, subtree: true });
  }

  addStyles();
  bindClicks();
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", observeUsers);
  } else {
    observeUsers();
  }
})();
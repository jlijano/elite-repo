(function polishUserManagementPage() {
  if (document.body?.dataset?.adminPage !== "user") return;

  function addStyles() {
    if (document.getElementById("userManagementPolishStyles")) return;
    const style = document.createElement("style");
    style.id = "userManagementPolishStyles";
    style.textContent = `
      body[data-admin-page="user"] #userDialog {
        width: min(800px, calc(100vw - 32px));
        max-height: min(800px, calc(100dvh - 32px));
        padding: 0;
        overflow: hidden;
      }

      body[data-admin-page="user"] #userDialog .modal-content {
        display: grid;
        grid-template-rows: auto minmax(0, 1fr);
        max-height: min(800px, calc(100dvh - 32px));
      }

      body[data-admin-page="user"] #userDialog .user-dialog-body {
        min-height: 0;
        overflow: auto;
      }

      body[data-admin-page="user"] #userDialog .management-form {
        align-items: start;
      }

      body[data-admin-page="user"] #userDialog .management-form > label {
        min-width: 0;
      }

      body[data-admin-page="user"] #userDialog input,
      body[data-admin-page="user"] #userDialog select {
        width: 100%;
        box-sizing: border-box;
      }

      body[data-admin-page="user"] #userDialog .form-actions {
        position: sticky;
        bottom: 0;
        z-index: 1;
        margin: 4px -20px -20px;
        padding: 14px 20px 0;
        background: linear-gradient(180deg, rgba(0, 0, 0, 0), var(--panel) 28%);
      }

      @media (max-width: 520px) {
        body[data-admin-page="user"] #userDialog {
          width: calc(100vw - 16px);
          max-height: calc(100dvh - 16px);
        }

        body[data-admin-page="user"] #userDialog .modal-content {
          max-height: calc(100dvh - 16px);
        }

        body[data-admin-page="user"] #userDialog .user-dialog-body {
          padding: 12px;
        }

        body[data-admin-page="user"] #userDialog .form-actions {
          margin: 4px -12px -12px;
          padding: 12px 12px 0;
        }
      }
    `;
    document.head.appendChild(style);
  }

  function cleanUserName(value) {
    const withoutTrailingDirectoryText = String(value || "")
      .replace(/\s*(?:no|not\s+set)\s+(?:company|department|group)\b.*$/i, "")
      .replace(/\s+(?:company|department|group)\s*:\s*.*$/i, "")
      .trim();
    const parts = withoutTrailingDirectoryText
      .split(/\n|\||•|·/)
      .map((part) => part.trim())
      .filter(Boolean);
    const ignored = new Set(["admin", "owner", "member", "viewer", "active", "invited", "disabled"]);
    return parts.find((part) => {
      const normalized = part.toLowerCase();
      return !ignored.has(normalized) && !/^(role|company|department|group|status)\b/i.test(part);
    }) || parts[0] || "user";
  }

  function refreshNameTrigger(trigger) {
    const label = trigger.querySelector("span:first-child") || trigger;
    const currentText = label.textContent || trigger.textContent || "";
    const cleaned = cleanUserName(currentText);
    if (!cleaned || cleaned === currentText.trim()) return;
    label.textContent = cleaned;
    trigger.setAttribute("aria-label", `Edit ${cleaned}`);
  }

  function refreshNameTriggers() {
    document.querySelectorAll("#users .user-name-edit-trigger").forEach(refreshNameTrigger);
  }

  function observeUsers() {
    const list = document.getElementById("users");
    refreshNameTriggers();
    if (list) new MutationObserver(refreshNameTriggers).observe(list, { childList: true, subtree: true });
  }

  addStyles();
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", observeUsers, { once: true });
  } else {
    observeUsers();
  }
})();
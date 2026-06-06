(function polishManagementActionIcons() {
  const page = document.body?.dataset?.adminPage || "";
  const supportedPages = new Set(["company", "department", "group", "user"]);
  if (!supportedPages.has(page)) return;

  const actionConfig = [
    { selector: "[data-user-disable]", icon: "⊘", label: "Disable" },
    { selector: "[data-user-reactivate], [data-reactivate]", icon: "↻", label: "Reactivate" },
    { selector: "[data-user-purge], [data-purge]", icon: "×", label: "Delete", danger: true },
    { selector: "[data-archive]", icon: "↓", label: "Archive" },
    { selector: "[data-user-edit]:not(.user-name-edit-trigger), [data-edit]", icon: "✎", label: "Edit" }
  ];

  function addStyles() {
    if (document.getElementById("managementActionIconStyles")) return;
    const style = document.createElement("style");
    style.id = "managementActionIconStyles";
    style.textContent = `
      body[data-admin-page="company"] .actions,
      body[data-admin-page="department"] .actions,
      body[data-admin-page="group"] .actions,
      body[data-admin-page="user"] .actions {
        display: inline-flex;
        align-items: center;
        justify-content: flex-end;
        gap: 8px;
      }

      .management-icon-action {
        width: 38px !important;
        min-width: 38px !important;
        height: 38px !important;
        min-height: 38px !important;
        flex: 0 0 38px !important;
        display: inline-grid !important;
        place-items: center !important;
        padding: 0 !important;
        border-radius: 10px !important;
        font-size: 1.05rem !important;
        line-height: 1 !important;
        font-weight: 900 !important;
        white-space: nowrap;
      }

      .management-icon-action.danger-action {
        color: #b91c1c !important;
      }

      .management-icon-action:hover,
      .management-icon-action:focus-visible {
        transform: translateY(-1px);
      }

      @media (max-width: 520px) {
        body[data-admin-page="company"] .entra-table .actions,
        body[data-admin-page="department"] .entra-table .actions,
        body[data-admin-page="group"] .entra-table .actions,
        body[data-admin-page="user"] .users-table .actions {
          justify-content: flex-start;
          flex-wrap: wrap;
        }

        body[data-admin-page="company"] .entra-table .actions .management-icon-action,
        body[data-admin-page="department"] .entra-table .actions .management-icon-action,
        body[data-admin-page="group"] .entra-table .actions .management-icon-action,
        body[data-admin-page="user"] .users-table .actions .management-icon-action {
          flex: 0 0 38px !important;
        }
      }
    `;
    document.head.appendChild(style);
  }

  function describeAction(button, config) {
    const currentLabel = button.getAttribute("aria-label") || button.getAttribute("title") || button.textContent || config.label;
    const cleanLabel = currentLabel.trim() || config.label;
    button.setAttribute("aria-label", cleanLabel);
    button.setAttribute("title", cleanLabel);
  }

  function iconizeButton(button, config) {
    if (!button || button.classList.contains("user-name-edit-trigger")) return;
    button.classList.add("management-icon-action");
    if (config.danger) button.classList.add("danger-action");
    describeAction(button, config);
    if (button.textContent.trim() !== config.icon) button.textContent = config.icon;
  }

  function iconizeActions() {
    for (const config of actionConfig) {
      document.querySelectorAll(config.selector).forEach((button) => iconizeButton(button, config));
    }
  }

  function observeActions() {
    iconizeActions();
    const target = page === "user" ? document.getElementById("users") : document.getElementById("entraList");
    if (target) new MutationObserver(iconizeActions).observe(target, { childList: true, subtree: true });
  }

  addStyles();
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", observeActions, { once: true });
  } else {
    observeActions();
  }
})();
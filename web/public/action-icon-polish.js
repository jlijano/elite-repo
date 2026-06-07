(function polishManagementActions() {
  const page = document.body?.dataset?.adminPage || "";
  const supportedPages = new Set(["company", "department", "group", "user"]);
  if (!supportedPages.has(page)) return;

  const actionConfig = [
    { selector: "[data-user-disable]", label: "Disable" },
    { selector: "[data-user-reactivate], [data-reactivate]", label: "Reactivate" },
    { selector: "[data-user-purge], [data-purge]", label: "Delete", danger: true },
    { selector: "[data-archive]", label: "Archive" }
  ];
  if (page !== "user") actionConfig.push({ selector: ".actions [data-edit]", label: "Edit" });

  const activePath = `${window.location.pathname || ""}`.toLowerCase();
  const pathLabels = {
    "/company.html": "Company",
    "/department.html": "Department",
    "/group.html": "Group",
    "/user.html": "User",
    "/playground.html": "Playground",
    "/builder.html": "Builder",
    "/settings.html": "Settings"
  };

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
        flex-wrap: wrap;
        gap: 8px;
      }

      body[data-admin-page="user"] .users-table td:last-child {
        min-width: 180px;
        padding-left: 18px;
      }

      body[data-admin-page="user"] .users-table .actions {
        gap: 8px;
      }

      .management-icon-action {
        min-width: 0 !important;
        min-height: 34px !important;
        display: inline-flex !important;
        align-items: center !important;
        justify-content: center !important;
        padding: 8px 12px !important;
        border-radius: 10px !important;
        border: 1px solid rgba(148, 163, 184, 0.26) !important;
        background: rgba(15, 23, 42, 0.56) !important;
        color: rgba(226, 232, 240, 0.9) !important;
        font-size: 0.78rem !important;
        line-height: 1 !important;
        font-weight: 800 !important;
        letter-spacing: 0 !important;
        white-space: nowrap;
      }

      .management-icon-action.danger-action {
        border-color: rgba(248, 113, 113, 0.42) !important;
        background: rgba(127, 29, 29, 0.24) !important;
        color: #fecaca !important;
      }

      .management-icon-action:hover,
      .management-icon-action:focus-visible {
        transform: translateY(-1px);
      }

      .user-edit-action-hidden {
        display: none !important;
      }

      .admin-shell .nav-item:not(.active):hover,
      .admin-shell .nav-item:not(.active):focus-visible,
      .mobile-admin-menu-link:not(.active):hover,
      .mobile-admin-menu-link:not(.active):focus-visible {
        background: transparent !important;
      }

      .admin-shell .nav-item.active,
      .mobile-admin-menu-link.active {
        background: var(--sidebar-card) !important;
      }

      .admin-shell .nav-item[data-playground-placeholder="true"],
      .mobile-admin-menu-link[data-playground-placeholder="true"] {
        cursor: pointer;
      }

      @media (max-width: 720px) {
        body[data-admin-page="company"] .entra-table .actions,
        body[data-admin-page="department"] .entra-table .actions,
        body[data-admin-page="group"] .entra-table .actions,
        body[data-admin-page="user"] .users-table .actions {
          justify-content: flex-start;
        }

        body[data-admin-page="user"] .users-table td:last-child {
          min-width: 0;
          padding-left: 0;
        }
      }
    `;
    document.head.appendChild(style);
  }

  function describeAction(button, config) {
    button.setAttribute("aria-label", config.label);
    button.setAttribute("title", config.label);
  }

  function hideRedundantUserEditActions() {
    if (page !== "user") return;
    document.querySelectorAll("#users [data-user-edit]:not(.user-name-edit-trigger)").forEach((button) => {
      button.classList.add("user-edit-action-hidden");
      button.hidden = true;
      button.tabIndex = -1;
      button.setAttribute("aria-hidden", "true");
    });
  }

  function labelButton(button, config) {
    if (!button || button.hidden || button.classList.contains("user-name-edit-trigger") || button.classList.contains("entra-name-edit-trigger")) return;
    button.classList.add("management-icon-action");
    if (config.danger) button.classList.add("danger-action");
    else button.classList.remove("danger-action");
    describeAction(button, config);
    if (button.textContent.trim() !== config.label) button.textContent = config.label;
  }

  function polishActions() {
    hideRedundantUserEditActions();
    for (const config of actionConfig) {
      document.querySelectorAll(config.selector).forEach((button) => labelButton(button, config));
    }
  }

  function navKey(item) {
    return item?.dataset?.navKey || item?.getAttribute("href") || item?.textContent?.trim() || "";
  }

  function playgroundItem(className = "nav-item") {
    const link = document.createElement("a");
    link.className = className;
    link.href = "/playground.html";
    link.dataset.playgroundPlaceholder = "true";
    link.dataset.navKey = "/playground.html";
    link.innerHTML = `<span aria-hidden="true">▦</span>Playground`;
    return link;
  }

  function ensurePlaygroundOption() {
    document.querySelectorAll(".admin-shell .primary-nav").forEach((nav) => {
      if (!nav.querySelector('[href="/playground.html"], [data-playground-placeholder="true"]')) {
        const userItem = nav.querySelector('[href="/user.html"]');
        const item = playgroundItem("nav-item");
        if (userItem) userItem.insertAdjacentElement("afterend", item);
        else nav.appendChild(item);
      }
    });

    document.querySelectorAll(".mobile-admin-menu-list").forEach((list) => {
      if (list.querySelector('[href="/playground.html"], [data-playground-placeholder="true"]')) return;
      const userItem = list.querySelector('[href="/user.html"]');
      const item = playgroundItem("mobile-admin-menu-link");
      item.setAttribute("role", "menuitem");
      if (userItem) userItem.insertAdjacentElement("afterend", item);
      else list.appendChild(item);
    });
  }

  function normalizeNavKeys() {
    document.querySelectorAll(".admin-shell .nav-item, .mobile-admin-menu-link").forEach((item) => {
      if (!item.dataset.navKey) item.dataset.navKey = item.getAttribute("href") || item.textContent.trim();
      if (item.getAttribute("href") === "/playground.html") item.dataset.playgroundPlaceholder = "true";
    });
  }

  function clearActiveNav() {
    document.querySelectorAll(".admin-shell .nav-item.active, .mobile-admin-menu-link.active").forEach((item) => {
      item.classList.remove("active");
      item.removeAttribute("aria-current");
    });
    document.querySelectorAll(".reports-summary.active").forEach((summary) => summary.classList.remove("active"));
  }

  function setActiveNavFromPath() {
    clearActiveNav();
    const label = pathLabels[activePath];
    document.querySelectorAll(".admin-shell .nav-item, .mobile-admin-menu-link").forEach((item) => {
      const key = navKey(item).toLowerCase();
      const text = item.textContent.trim().toLowerCase();
      const matchesPath = key === activePath;
      const matchesLabel = label && text.includes(label.toLowerCase());
      if (matchesPath || matchesLabel) {
        item.classList.add("active");
        item.setAttribute("aria-current", "page");
      }
    });
  }

  function wireNav() {
    document.querySelectorAll(".admin-shell .nav-item, .mobile-admin-menu-link").forEach((item) => {
      if (item.dataset.clickHighlightWired === "true") return;
      item.dataset.clickHighlightWired = "true";
      item.addEventListener("click", (event) => {
        if (item.dataset.playgroundPlaceholder === "true" || item.getAttribute("href") === "/playground.html") {
          event.preventDefault();
          const status = document.getElementById("status");
          if (status) {
            status.textContent = "Playground added. This option is parked for now.";
            status.hidden = false;
            status.classList.remove("error");
          }
          return;
        }
        window.sessionStorage?.removeItem?.("switchboard-admin-clicked-nav");
      });
    });
  }

  function refresh() {
    ensurePlaygroundOption();
    normalizeNavKeys();
    setActiveNavFromPath();
    wireNav();
    polishActions();
  }

  addStyles();
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", refresh, { once: true });
  } else {
    refresh();
  }
  new MutationObserver(refresh).observe(document.body, { childList: true, subtree: true });
})();

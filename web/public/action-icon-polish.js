(function polishManagementActionIcons() {
  const page = document.body?.dataset?.adminPage || "";
  const supportedPages = new Set(["company", "department", "group", "user"]);
  if (!supportedPages.has(page)) return;

  const actionConfig = [
    { selector: "[data-user-disable]", icon: "⊘", label: "Disable" },
    { selector: "[data-user-reactivate], [data-reactivate]", icon: "↻", label: "Reactivate" },
    { selector: "[data-user-purge], [data-purge]", icon: "×", label: "Delete", danger: true },
    { selector: "[data-archive]", icon: "↓", label: "Archive" }
  ];
  if (page !== "user") actionConfig.push({ selector: ".actions [data-edit]", icon: "✎", label: "Edit" });

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

      body[data-admin-page="user"] .users-table td:last-child {
        min-width: 112px;
        padding-left: 18px;
      }

      body[data-admin-page="user"] .users-table .actions {
        gap: 12px;
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

      .user-edit-action-hidden {
        display: none !important;
      }

      @media (max-width: 520px) {
        body[data-admin-page="company"] .entra-table .actions,
        body[data-admin-page="department"] .entra-table .actions,
        body[data-admin-page="group"] .entra-table .actions,
        body[data-admin-page="user"] .users-table .actions {
          justify-content: flex-start;
          flex-wrap: wrap;
        }

        body[data-admin-page="user"] .users-table td:last-child {
          min-width: 0;
          padding-left: 0;
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

  function hideRedundantUserEditActions() {
    if (page !== "user") return;
    document.querySelectorAll("#users [data-user-edit]:not(.user-name-edit-trigger)").forEach((button) => {
      button.classList.add("user-edit-action-hidden");
      button.hidden = true;
      button.tabIndex = -1;
      button.setAttribute("aria-hidden", "true");
    });
  }

  function iconizeButton(button, config) {
    if (!button || button.hidden || button.classList.contains("user-name-edit-trigger") || button.classList.contains("entra-name-edit-trigger")) return;
    button.classList.add("management-icon-action");
    if (config.danger) button.classList.add("danger-action");
    describeAction(button, config);
    if (button.textContent.trim() !== config.icon) button.textContent = config.icon;
  }

  function iconizeActions() {
    hideRedundantUserEditActions();
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

(function polishAdminNavigationClicks() {
  if (!document.querySelector(".admin-shell")) return;
  const activeNavStorageKey = "switchboard-admin-clicked-nav";
  const playgroundHref = "/playground.html";

  function addStyles() {
    if (document.getElementById("adminClickNavStyles")) return;
    const style = document.createElement("style");
    style.id = "adminClickNavStyles";
    style.textContent = `
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
    `;
    document.head.appendChild(style);
  }

  function navKey(item) {
    return item?.dataset?.navKey || item?.getAttribute("href") || item?.textContent?.trim() || "";
  }

  function matchingItems(key) {
    if (!key) return [];
    return [...document.querySelectorAll(".admin-shell .nav-item, .mobile-admin-menu-link")]
      .filter((item) => navKey(item) === key);
  }

  function clearActiveNav() {
    document.querySelectorAll(".admin-shell .nav-item.active, .mobile-admin-menu-link.active").forEach((item) => {
      item.classList.remove("active");
      item.removeAttribute("aria-current");
    });
    document.querySelectorAll(".reports-summary.active").forEach((summary) => summary.classList.remove("active"));
  }

  function setActiveNav(item) {
    const key = navKey(item);
    if (!key) return;
    clearActiveNav();
    matchingItems(key).forEach((match) => {
      match.classList.add("active");
      match.setAttribute("aria-current", "page");
    });
    try { sessionStorage.setItem(activeNavStorageKey, key); } catch (error) {}
  }

  function playgroundItem(className = "nav-item") {
    const link = document.createElement("a");
    link.className = className;
    link.href = playgroundHref;
    link.dataset.playgroundPlaceholder = "true";
    link.dataset.navKey = playgroundHref;
    link.innerHTML = `<span aria-hidden="true">▦</span>Playground`;
    return link;
  }

  function ensurePlaygroundOption() {
    document.querySelectorAll(".admin-shell .primary-nav").forEach((nav) => {
      if (!nav.querySelector(`[href="${playgroundHref}"], [data-playground-placeholder="true"]`)) {
        const userItem = nav.querySelector('[href="/user.html"]');
        const item = playgroundItem("nav-item");
        if (userItem) userItem.insertAdjacentElement("afterend", item);
        else nav.appendChild(item);
      }
    });

    document.querySelectorAll(".mobile-admin-menu-list").forEach((list) => {
      if (list.querySelector(`[href="${playgroundHref}"], [data-playground-placeholder="true"]`)) return;
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
      if (item.getAttribute("href") === playgroundHref) item.dataset.playgroundPlaceholder = "true";
    });
  }

  function restoreClickedNav() {
    let key = "";
    try { key = sessionStorage.getItem(activeNavStorageKey) || ""; } catch (error) {}
    clearActiveNav();
    if (key) matchingItems(key).forEach((item) => item.classList.add("active"));
  }

  function wireNav() {
    document.querySelectorAll(".admin-shell .nav-item, .mobile-admin-menu-link").forEach((item) => {
      if (item.dataset.clickHighlightWired === "true") return;
      item.dataset.clickHighlightWired = "true";
      item.addEventListener("click", (event) => {
        setActiveNav(item);
        if (item.dataset.playgroundPlaceholder === "true" || item.getAttribute("href") === playgroundHref) {
          event.preventDefault();
          const status = document.getElementById("status");
          if (status) {
            status.textContent = "Playground added. This option is parked for now.";
            status.hidden = false;
            status.classList.remove("error");
          }
        }
      });
    });
  }

  function refreshNav() {
    ensurePlaygroundOption();
    normalizeNavKeys();
    restoreClickedNav();
    wireNav();
  }

  addStyles();
  refreshNav();
  new MutationObserver(refreshNav).observe(document.body, { childList: true, subtree: true });
})();
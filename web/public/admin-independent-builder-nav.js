(() => {
  const navGroups = [
    {
      type: "link",
      href: "/chat.html",
      icon: "□",
      label: "Chat"
    },
    {
      type: "link",
      href: "/knowledge.html",
      icon: "◇",
      label: "Knowledge base"
    },
    {
      type: "details",
      key: "entra",
      icon: "◉",
      label: "ENTRA",
      childLabel: "ENTRA navigation",
      children: [
        { href: "/company.html", icon: "◌", label: "Company" },
        { href: "/department.html", icon: "◇", label: "Department" },
        { href: "/group.html", icon: "▦", label: "Groups" },
        { href: "/user.html", icon: "◉", label: "Users" }
      ]
    },
    {
      type: "details",
      key: "playground",
      icon: "▦",
      label: "PLAYGROUND",
      childLabel: "Playground navigation",
      children: [
        { href: "/playground.html", icon: "▦", label: "Overview" },
        { href: "/playground-projects.html", icon: "▣", label: "Projects" },
        { href: "/playground-tasks.html", icon: "✓", label: "Tasks" },
        { href: "/playground-notes.html", icon: "✎", label: "Notes" },
        { href: "/playground-automation.html", icon: "⚙", label: "Automation" }
      ]
    },
    {
      type: "details",
      key: "settings",
      icon: "⚙",
      label: "Settings",
      childLabel: "Settings navigation",
      children: [
        { href: "/settings.html", icon: "⚙", label: "Settings" },
        { href: "/builder.html", icon: "▣", label: "Builder" }
      ]
    },
    {
      type: "details",
      key: "reports",
      icon: "▣",
      label: "REPORTS",
      childLabel: "Reports navigation",
      children: [
        { href: "/reports.html", icon: "▣", label: "Overview" },
        { href: "/logs.html", icon: "≡", label: "Logs" },
        { href: "/review-runs.html", icon: "↻", label: "Review runs" },
        { href: "/system-health.html", icon: "✚", label: "System health" },
        { href: "/user-audit.html", icon: "◎", label: "User audit" }
      ]
    }
  ];

  function currentPath() {
    const pathname = window.location.pathname || "/";
    return pathname === "/index.html" ? "/" : pathname;
  }

  function isActiveHref(href) {
    return href === currentPath();
  }

  function injectSidebarStyles() {
    if (document.getElementById("switchboard-sidebar-nav-style")) return;
    const style = document.createElement("style");
    style.id = "switchboard-sidebar-nav-style";
    style.textContent = `
      .admin-shell .sidebar-brand {
        cursor: default;
        user-select: none;
      }

      .admin-shell .back-nav-item {
        width: 42px;
        min-height: 38px;
        justify-content: center;
        padding: 0;
      }

      .admin-shell .back-nav-item span:not(.sr-only) {
        width: 22px;
        flex: 0 0 22px;
      }

      .admin-shell .module-summary .reports-summary-label {
        min-width: 0;
        display: flex;
        align-items: center;
        gap: 12px;
      }

      .admin-shell .module-summary .reports-summary-label span {
        width: 22px;
        flex: 0 0 22px;
        color: var(--sidebar-muted);
        text-align: center;
        font-size: 1.08rem;
      }

      .admin-shell .module-nav.active > .module-summary {
        color: var(--sidebar-text);
        background: var(--sidebar-card);
        box-shadow: inset 3px 0 0 var(--primary);
      }

      .admin-shell .module-nav.active > .module-summary .reports-summary-label span {
        color: var(--primary);
      }

      .admin-shell .reports-nav-items {
        margin-left: 16px;
        padding-left: 10px;
        border-left: 1px solid var(--sidebar-line);
      }

      .admin-shell .reports-nav-items .nav-item {
        min-height: 38px;
        margin-left: 0;
        font-size: 0.92rem;
      }

      @media (max-width: 900px) {
        .admin-shell .back-nav-item {
          width: 38px;
          min-width: 38px;
          flex-basis: 38px;
        }

        .admin-shell .module-nav.active > .module-summary {
          box-shadow: inset 0 -3px 0 var(--primary);
        }

        .admin-shell .reports-nav-items {
          margin-left: 0;
          padding-left: 0;
          border-left: 0;
        }
      }
    `;
    document.head.appendChild(style);
  }

  function createIcon(icon) {
    const span = document.createElement("span");
    span.setAttribute("aria-hidden", "true");
    span.textContent = icon;
    return span;
  }

  function createLink({ href, icon, label }, className = "nav-item") {
    const link = document.createElement("a");
    link.className = className;
    link.href = href;
    link.dataset.navKey = href;
    link.append(createIcon(icon), document.createTextNode(label));
    if (isActiveHref(href)) {
      link.classList.add("active");
      link.setAttribute("aria-current", "page");
    }
    return link;
  }

  function createBackLink(className = "nav-item") {
    const link = document.createElement("a");
    link.className = `${className} back-nav-item`;
    link.href = "/";
    link.dataset.navKey = "/";
    link.setAttribute("aria-label", "Back to chat");
    link.setAttribute("title", "Back to chat");
    link.append(createIcon("←"));
    const label = document.createElement("span");
    label.className = "sr-only";
    label.textContent = "Back to chat";
    link.append(label);
    return link;
  }

  function createDetails(group) {
    const details = document.createElement("details");
    details.className = `admin-section-list reports-nav module-nav ${group.key}-nav`;
    const childActive = group.children.some((child) => isActiveHref(child.href));
    if (childActive) {
      details.open = true;
      details.classList.add("active");
    }

    const summary = document.createElement("summary");
    summary.className = `reports-summary module-summary${childActive ? " active" : ""}`;
    summary.setAttribute("aria-label", `${group.label} module`);

    const label = document.createElement("span");
    label.className = "reports-summary-label";
    label.append(createIcon(group.icon), document.createTextNode(group.label));

    const chevron = document.createElement("span");
    chevron.className = "reports-summary-chevron";
    chevron.setAttribute("aria-hidden", "true");
    chevron.textContent = "⌄";

    summary.append(label, chevron);

    const items = document.createElement("div");
    items.className = `reports-nav-items ${group.key}-nav-items`;
    items.setAttribute("aria-label", group.childLabel);
    group.children.forEach((child) => items.appendChild(createLink(child)));

    details.append(summary, items);
    return details;
  }

  function normalizeBrand(sidebar) {
    const topbar = sidebar.querySelector(".sidebar-topbar");
    if (!topbar) return;
    const brand = document.createElement("div");
    brand.className = "brand-lockup sidebar-brand";
    brand.setAttribute("aria-label", "Switchboard");
    brand.append(createIcon("★"), document.createTextNode("Switchboard"));
    brand.firstElementChild.className = "brand-mark";
    topbar.replaceChildren(brand);
  }

  function buildNav(nav) {
    const fragment = document.createDocumentFragment();
    fragment.appendChild(createBackLink());
    navGroups.forEach((group) => {
      fragment.appendChild(group.type === "details" ? createDetails(group) : createLink(group));
    });
    nav.replaceChildren(fragment);
  }

  function buildMobileMenuList(list) {
    const fragment = document.createDocumentFragment();
    fragment.appendChild(createBackLink("mobile-admin-menu-link"));
    navGroups.forEach((group) => {
      if (group.type === "link") {
        const item = createLink(group, "mobile-admin-menu-link");
        item.setAttribute("role", "menuitem");
        fragment.appendChild(item);
        return;
      }
      group.children.forEach((child) => {
        const item = createLink({ ...child, label: `${group.label}: ${child.label}` }, "mobile-admin-menu-link");
        item.setAttribute("role", "menuitem");
        fragment.appendChild(item);
      });
    });
    list.replaceChildren(fragment);
  }

  function syncModuleState() {
    document.querySelectorAll(".admin-shell .module-nav").forEach((details) => {
      const active = Boolean(details.querySelector(".nav-item.active"));
      details.classList.toggle("active", active);
      const summary = details.querySelector(".module-summary");
      summary?.classList.toggle("active", active);
      if (active) details.open = true;
    });
  }

  function normalizeSidebarNavigation() {
    injectSidebarStyles();
    document.querySelectorAll(".admin-shell .sidebar").forEach(normalizeBrand);
    document.querySelectorAll(".admin-shell .primary-nav").forEach(buildNav);
    document.querySelectorAll(".mobile-admin-menu-list").forEach(buildMobileMenuList);
    syncModuleState();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", normalizeSidebarNavigation, { once: true });
  } else {
    normalizeSidebarNavigation();
  }
  window.addEventListener("pageshow", normalizeSidebarNavigation);
})();

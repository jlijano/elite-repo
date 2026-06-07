(() => {
  function createNavItem(href, icon, label, active) {
    const item = document.createElement("a");
    item.className = `nav-item${active ? " active" : ""}`;
    item.href = href;
    if (active) item.setAttribute("aria-current", "page");
    item.innerHTML = `<span aria-hidden="true">${icon}</span>${label}`;
    return item;
  }

  function hasDirectLink(nav, href) {
    return [...nav.children].some((child) => child.matches?.(`a.nav-item[href="${href}"]`));
  }

  function normalizeBuilderNavigation() {
    const nav = document.querySelector(".primary-nav");
    if (!nav) return;

    const pathname = window.location.pathname || "/";
    const settingsDetails = nav.querySelector("details.settings-nav");
    const playgroundLink = nav.querySelector('a.nav-item[href="/playground.html"]');
    const reportsNav = nav.querySelector("details.reports-nav:not(.settings-nav)");

    if (!hasDirectLink(nav, "/settings.html")) {
      const settingsLink = createNavItem("/settings.html", "⚙", "Settings", pathname === "/settings.html");
      nav.insertBefore(settingsLink, reportsNav || playgroundLink?.nextSibling || null);
    }

    if (!hasDirectLink(nav, "/builder.html")) {
      const builderLink = createNavItem("/builder.html", "▣", "Builder", pathname === "/builder.html");
      const settingsLink = nav.querySelector('a.nav-item[href="/settings.html"]');
      nav.insertBefore(builderLink, reportsNav || settingsLink?.nextSibling || null);
    }

    if (settingsDetails) settingsDetails.remove();
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", normalizeBuilderNavigation);
  else normalizeBuilderNavigation();
})();

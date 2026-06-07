(() => {
  const sessionKey = "switchboard-session-token";
  const adminKey = "switchboard-admin-token";
  const contentDefinitions = [
    ["Home", "home", "/"]
  ].map(([title, slug, path]) => ({ title, slug, path, applicationOnly: false }));
  const applicationDefinitions = [
    ["Chat", "chat", "/chat.html"],
    ["Knowledge base", "knowledge", "/knowledge.html"],
    ["Company", "company", "/company.html"],
    ["Department", "department", "/department.html"],
    ["Group", "group", "/group.html"],
    ["User management", "user", "/user.html"],
    ["Board", "board", "/playground.html"],
    ["Projects", "projects", "/playground-projects.html"],
    ["Tasks", "tasks", "/playground-tasks.html"],
    ["Notes", "notes", "/playground-notes.html"],
    ["Automation", "automation", "/playground-automation.html"],
    ["Settings", "settings", "/settings.html"],
    ["Builder", "builder", "/builder.html"],
    ["Reports", "reports", "/reports.html"],
    ["Logs", "logs", "/logs.html"],
    ["Review runs", "review-runs", "/review-runs.html"],
    ["System health", "system-health", "/system-health.html"],
    ["User audit", "user-audit", "/user-audit.html"],
    ["Update profile", "update-profile", "/update-profile.html"],
    ["Login", "login", "/login.html"]
  ].map(([title, slug, path]) => ({ title, slug, path, applicationOnly: true }));
  const definitions = [...contentDefinitions, ...applicationDefinitions];

  let busy = false;
  let renderingRegistry = false;

  function headers() {
    const sessionToken = sessionStorage.getItem(sessionKey) || "";
    const adminToken = sessionStorage.getItem(adminKey) || "";
    return {
      "Content-Type": "application/json",
      ...(sessionToken ? { "x-session-token": sessionToken } : {}),
      ...(adminToken ? { "x-admin-token": adminToken } : {})
    };
  }

  async function requestJson(url, options = {}) {
    const response = await fetch(url, { ...options, headers: { ...headers(), ...(options.headers || {}) } });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || "Builder request failed.");
    return data;
  }

  function setStatus(message, error = false) {
    if (typeof window.setStatus === "function") {
      window.setStatus(message, error);
      return;
    }
    const status = document.getElementById("builderStatus");
    if (status) {
      status.textContent = message;
      status.classList.toggle("error", error);
    }
  }

  function escapeHtml(value) {
    return String(value ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/\"/g, "&quot;");
  }

  function makeBlock(type, name, content, style = {}) {
    return { id: crypto.randomUUID(), type, name, content, style, responsive: {}, children: [] };
  }

  function starterContent(definition) {
    return {
      version: 1,
      blocks: [
        makeBlock("section.hero", `${definition.title} hero`, {
          eyebrow: definition.title,
          heading: definition.title,
          body: "Draft page created from the editable page registry.",
          primaryButton: "Edit this page",
          secondaryButton: "Preview"
        }, { background: "#101010", text: "#ffffff", align: "left" })
      ]
    };
  }

  async function pages() {
    const data = await requestJson("/api/builder/pages");
    return Array.isArray(data.pages) ? data.pages : [];
  }

  function matchPage(list, definition) {
    return list.find((page) => page.slug === definition.slug || String(page.title || "").toLowerCase() === definition.title.toLowerCase()) || null;
  }

  async function ensurePage(definition) {
    if (definition.applicationOnly) return null;
    const existing = matchPage(await pages(), definition);
    if (existing) return existing;
    const data = await requestJson("/api/builder/pages", {
      method: "POST",
      body: JSON.stringify({
        title: definition.title,
        slug: definition.slug,
        seo: { title: definition.title, description: `${definition.title} draft page.` },
        content: starterContent(definition)
      })
    });
    return data.page || matchPage(await pages(), definition);
  }

  function syncToolbarSelection(page) {
    const select = document.getElementById("pageSelect");
    if (!select || !page?.id) return;
    let option = Array.from(select.options).find((item) => item.value === page.id);
    if (!option) {
      option = new Option(page.title || "Untitled page", page.id);
      select.add(option, 0);
    }
    option.textContent = page.title || "Untitled page";
    select.value = page.id;
  }

  function markRegistryActive(definition) {
    document.querySelectorAll("[data-page-slug]").forEach((item) => {
      item.classList.toggle("active", item.dataset.pageSlug === definition.slug);
    });
  }

  function openApplicationPage(definition, action) {
    markRegistryActive(definition);
    if (["create", "edit", "publish", "select"].includes(action)) {
      setStatus(`${definition.title} is a protected application page. Open or preview the live page instead of creating a Builder draft.`);
    }
    if (action === "preview") {
      window.open(definition.path, "_blank", "noopener,noreferrer");
      return;
    }
    if (action === "open" || action === "select" || action === "edit") {
      window.location.assign(definition.path);
    }
  }

  async function loadPage(definition, action) {
    if (definition.applicationOnly) {
      openApplicationPage(definition, action);
      return;
    }
    if (action === "select") {
      const existing = matchPage(await pages(), definition);
      if (!existing) {
        markRegistryActive(definition);
        setStatus(`No draft exists for ${definition.title}. Use Create draft first.`);
        return;
      }
    }
    const page = action === "select" ? matchPage(await pages(), definition) : await ensurePage(definition);
    if (!page?.id) throw new Error(`Could not create or load ${definition.title}.`);
    if (typeof window.loadDraft !== "function") throw new Error("Builder draft loader is not ready yet.");
    await window.loadDraft(page.id);
    syncToolbarSelection(page);
    markRegistryActive(definition);
    if (action === "preview" && typeof window.previewPage === "function") window.previewPage();
    if (action === "publish" && typeof window.publishPage === "function") await window.publishPage();
    setStatus(`${action === "preview" ? "Previewing" : action === "publish" ? "Publishing" : "Editing"} draft: ${definition.title}`);
  }

  function contentRegistryHtml() {
    return contentDefinitions.map((definition) => `
      <article class="application-page-item" data-page-slug="${escapeHtml(definition.slug)}">
        <button class="builder-list-item application-page-select" type="button" data-registry-action="select" data-page-slug="${escapeHtml(definition.slug)}">
          <strong>${escapeHtml(definition.title)}</strong>
          <small>${escapeHtml(definition.path)} - Builder-managed content page</small>
        </button>
        <div class="application-page-actions" aria-label="${escapeHtml(definition.title)} actions">
          <button type="button" data-registry-action="select" data-page-slug="${escapeHtml(definition.slug)}">Select page</button>
          <button type="button" data-registry-action="create" data-page-slug="${escapeHtml(definition.slug)}">Create draft</button>
          <button type="button" data-registry-action="edit" data-page-slug="${escapeHtml(definition.slug)}">Edit draft</button>
          <button type="button" data-registry-action="preview" data-page-slug="${escapeHtml(definition.slug)}">Preview</button>
          <button type="button" data-registry-action="publish" data-page-slug="${escapeHtml(definition.slug)}">Publish</button>
        </div>
      </article>
    `).join("");
  }

  function applicationRegistryHtml() {
    return applicationDefinitions.map((definition) => `
      <article class="application-page-item protected-application-page" data-page-slug="${escapeHtml(definition.slug)}">
        <button class="builder-list-item application-page-select" type="button" data-registry-action="open" data-page-slug="${escapeHtml(definition.slug)}">
          <strong>${escapeHtml(definition.title)}</strong>
          <small>${escapeHtml(definition.path)} - Protected live app page</small>
        </button>
        <div class="application-page-actions" aria-label="${escapeHtml(definition.title)} actions">
          <button type="button" data-registry-action="open" data-page-slug="${escapeHtml(definition.slug)}">Open live page</button>
          <button type="button" data-registry-action="preview" data-page-slug="${escapeHtml(definition.slug)}">Preview live page</button>
        </div>
      </article>
    `).join("");
  }

  function renderApplicationRegistry(force = false) {
    const container = document.querySelector(".application-pages-list");
    if (!container || renderingRegistry) return;
    if (!force && container.dataset.registryGuardReady === "true") return;
    renderingRegistry = true;
    container.dataset.registryGuardReady = "true";
    container.innerHTML = `
      <h3>Editable content pages</h3>
      ${contentRegistryHtml()}
      <h3>Application pages</h3>
      ${applicationRegistryHtml()}
    `;
    renderingRegistry = false;
  }

  function installRegistryClickFix() {
    renderApplicationRegistry(true);
    const container = document.querySelector(".application-pages-list");
    if (container) {
      new MutationObserver(() => {
        if (!renderingRegistry) window.requestAnimationFrame(() => renderApplicationRegistry(true));
      }).observe(container, { childList: true, subtree: false });
    }
    document.addEventListener("click", (event) => {
      const button = event.target.closest("[data-registry-action][data-page-slug]");
      if (!button || !document.body.contains(button)) return;
      const action = button.dataset.registryAction;
      if (!["select", "create", "edit", "preview", "publish", "open"].includes(action)) return;
      const definition = definitions.find((item) => item.slug === button.dataset.pageSlug);
      if (!definition) return;
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();
      if (busy) return;
      busy = true;
      loadPage(definition, action)
        .catch((error) => setStatus(error.message, true))
        .finally(() => { busy = false; });
    }, true);
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", installRegistryClickFix);
  else installRegistryClickFix();
})();

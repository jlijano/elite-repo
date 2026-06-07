(() => {
  const sessionKey = "switchboard-session-token";
  const adminKey = "switchboard-admin-token";
  const definitions = [
    ["Home", "home", "/"],
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
  ].map(([title, slug, path]) => ({ title, slug, path }));

  let busy = false;

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

  async function loadPage(definition, action) {
    const page = await ensurePage(definition);
    if (!page?.id) throw new Error(`Could not create or load ${definition.title}.`);
    if (typeof window.loadDraft !== "function") throw new Error("Builder draft loader is not ready yet.");
    await window.loadDraft(page.id);
    syncToolbarSelection(page);
    markRegistryActive(definition);
    if (action === "preview" && typeof window.previewPage === "function") window.previewPage();
    if (action === "publish" && typeof window.publishPage === "function") await window.publishPage();
    setStatus(`${action === "preview" ? "Previewing" : action === "publish" ? "Publishing" : "Editing"} draft: ${definition.title}`);
  }

  function renderApplicationRegistry() {
    const container = document.querySelector(".application-pages-list");
    if (!container || container.dataset.registryReady === "true") return;
    container.dataset.registryReady = "true";
    container.innerHTML = `<h3>Application pages</h3>${definitions.map((definition) => `
      <article class="application-page-item" data-page-slug="${escapeHtml(definition.slug)}">
        <button class="builder-list-item application-page-select" type="button" data-registry-action="edit" data-page-slug="${escapeHtml(definition.slug)}">
          <strong>${escapeHtml(definition.title)}</strong>
          <small>${escapeHtml(definition.path)}</small>
        </button>
        <div class="application-page-actions" aria-label="${escapeHtml(definition.title)} actions">
          <button type="button" data-registry-action="edit" data-page-slug="${escapeHtml(definition.slug)}">Edit</button>
          <button type="button" data-registry-action="preview" data-page-slug="${escapeHtml(definition.slug)}">Preview</button>
          <a href="${escapeHtml(definition.path)}" target="_blank" rel="noopener">Open</a>
        </div>
      </article>
    `).join("")}`;
  }

  function installRegistryClickFix() {
    renderApplicationRegistry();
    document.addEventListener("click", (event) => {
      const button = event.target.closest("[data-registry-action][data-page-slug]");
      if (!button || !document.body.contains(button)) return;
      const action = button.dataset.registryAction;
      if (!["select", "create", "edit", "preview", "publish"].includes(action)) return;
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

(() => {
  const originalFetch = window.fetch.bind(window);
  let builderPages = [];

  function requestPath(input) {
    const value = typeof input === "string" ? input : input?.url || "";
    try {
      return new URL(value, window.location.origin).pathname;
    } catch (error) {
      return value;
    }
  }

  function responseWithJson(source, payload) {
    const headers = new Headers(source.headers);
    headers.set("Content-Type", "application/json");
    headers.delete("Content-Length");
    return new Response(JSON.stringify(payload), {
      status: source.status,
      statusText: source.statusText,
      headers
    });
  }

  function slugify(value) {
    const slug = String(value || "untitled-page")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "")
      .slice(0, 96);
    return slug || "untitled-page";
  }

  function safeIsoDate(value) {
    const date = value ? new Date(value) : new Date();
    return Number.isNaN(date.getTime()) ? new Date().toISOString() : date.toISOString();
  }

  function normalizeSeo(seo = {}) {
    return {
      title: String(seo.title || ""),
      description: String(seo.description || ""),
      canonicalUrl: String(seo.canonicalUrl || ""),
      ogTitle: String(seo.ogTitle || ""),
      ogDescription: String(seo.ogDescription || ""),
      ogImage: String(seo.ogImage || ""),
      robots: String(seo.robots || "index,follow")
    };
  }

  function sectionsFrom(source = {}) {
    if (Array.isArray(source.sections)) return source.sections;
    if (Array.isArray(source.content?.blocks)) return source.content.blocks;
    if (Array.isArray(source.content?.sections)) return source.content.sections;
    if (Array.isArray(source.autosaveContent?.blocks)) return source.autosaveContent.blocks;
    if (Array.isArray(source.autosaveContent?.sections)) return source.autosaveContent.sections;
    return [];
  }

  function normalizeContent(source = {}) {
    return {
      version: Number(source.content?.version || source.version || 1),
      blocks: sectionsFrom(source)
    };
  }

  function normalizePage(value = {}, fallback = {}) {
    const id = String(value.id || value.pageId || fallback.id || fallback.pageId || "").trim();
    const title = String(value.title || fallback.title || "").trim() || "Untitled page";
    const slug = String(value.slug || fallback.slug || slugify(title || id)).trim() || "untitled-page";
    const status = ["draft", "published", "archived"].includes(value.status || fallback.status)
      ? value.status || fallback.status
      : "draft";
    const sections = sectionsFrom(value).length ? sectionsFrom(value) : sectionsFrom(fallback);

    return {
      ...value,
      id,
      title,
      slug,
      status,
      sections,
      seo: normalizeSeo(value.seo || fallback.seo || {}),
      updatedAt: safeIsoDate(value.updatedAt || value.updated_at || fallback.updatedAt || fallback.updated_at)
    };
  }

  function normalizeDraft(value = {}, fallbackPage = {}) {
    const page = normalizePage(fallbackPage, value);
    const content = normalizeContent(value);
    return {
      ...value,
      id: String(value.id || value.pageId || page.id || "").trim(),
      pageId: String(value.pageId || value.id || page.id || "").trim(),
      title: String(value.title || page.title || "").trim() || "Untitled page",
      slug: String(value.slug || page.slug || "untitled-page").trim() || "untitled-page",
      status: ["draft", "published", "archived"].includes(value.status || page.status) ? value.status || page.status : "draft",
      sections: content.blocks,
      seo: normalizeSeo(value.seo || page.seo || {}),
      updatedAt: safeIsoDate(value.updatedAt || value.updated_at || page.updatedAt),
      content
    };
  }

  function pageIdFromPath(pathname) {
    const match = pathname.match(/^\/api\/builder\/pages\/([^/]+)(?:\/|$)/);
    return match ? decodeURIComponent(match[1]) : "";
  }

  function normalizePayload(pathname, payload) {
    if (!payload || typeof payload !== "object" || Array.isArray(payload)) return payload;

    const shaped = { ...payload };
    const pageId = pageIdFromPath(pathname);

    if (Array.isArray(shaped.pages)) {
      shaped.pages = shaped.pages.map((page) => normalizePage(page));
      builderPages = shaped.pages;
    }

    if (shaped.draft) {
      const pageFallback = shaped.page || builderPages.find((page) => page.id === pageId) || { id: pageId };
      shaped.draft = normalizeDraft(shaped.draft, pageFallback);
      shaped.page = normalizePage(shaped.page || shaped.draft, shaped.draft);
    } else if (pageId && pathname.endsWith("/draft")) {
      shaped.draft = normalizeDraft({ pageId, content: { version: 1, blocks: [] } }, { id: pageId });
      shaped.page = normalizePage(shaped.page || shaped.draft, shaped.draft);
    } else if (shaped.page) {
      shaped.page = normalizePage(shaped.page);
    }

    return shaped;
  }

  window.fetch = async (input, options = {}) => {
    const response = await originalFetch(input, options);
    if (!response.ok) return response;

    const pathname = requestPath(input);
    if (!pathname.startsWith("/api/builder")) return response;

    const data = await response.clone().json().catch(() => null);
    if (!data || typeof data !== "object") return response;

    return responseWithJson(response, normalizePayload(pathname, data));
  };
})();

(() => {
  const sessionKey = "switchboard-session-token";
  const adminKey = "switchboard-admin-token";
  const pages = [
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

  const sections = [
    ["Header", "Top navigation or page intro bar.", () => makeBlock("section.footer", "Header", { heading: "Header", body: "Navigation, account links, and primary page actions.", links: ["Home", "Chat", "Settings"] }, { background: "#ffffff", text: "#202123", align: "left" })],
    ["Hero section", "Large headline, supporting copy, and action buttons.", () => makeBlock("section.hero", "Hero section", { eyebrow: "Builder", heading: "Hero headline", body: "Use this space for the page promise, context, or top-level message.", primaryButton: "Primary action", secondaryButton: "Secondary action" }, { background: "#101010", text: "#ffffff", align: "left" })],
    ["Text section", "Simple heading and body copy.", () => makeBlock("section.cta", "Text section", { heading: "Text heading", body: "Add body copy here. The Inspector can edit the heading, body, color, and alignment.", buttonLabel: "", buttonUrl: "#" }, { background: "#ffffff", text: "#202123", align: "left" })],
    ["Image section", "Image/gallery placeholder block.", () => makeBlock("section.gallery", "Image section", { heading: "Image section", images: [] }, { background: "#ffffff", text: "#202123", align: "left" })],
    ["Button section", "Focused call-to-action button area.", () => makeBlock("section.cta", "Button section", { heading: "Ready for the next step?", body: "Use the Inspector to edit button copy, destination, color, and alignment.", buttonLabel: "Take action", buttonUrl: "#" }, { background: "#f3f4f6", text: "#202123", align: "center" })],
    ["Card grid", "Reusable cards for features, links, or stats.", () => makeBlock("section.services", "Card grid", { heading: "Card grid", items: ["Card one", "Card two", "Card three"] }, { background: "#ffffff", text: "#202123", columns: 3 })],
    ["FAQ", "Question and answer list.", () => makeBlock("section.faq", "FAQ", { heading: "Frequently asked questions", items: ["Question one? Answer one.", "Question two? Answer two."] }, { background: "#ffffff", text: "#202123", align: "left" })],
    ["Contact block", "Contact or request form block.", () => makeBlock("section.form", "Contact block", { heading: "Contact us", submitLabel: "Send", fields: ["Name", "Email", "Message"] }, { background: "#ffffff", text: "#202123", align: "left" })],
    ["Footer", "Bottom links and supporting copy.", () => makeBlock("section.footer", "Footer", { heading: "Footer", body: "Footer copy and supporting links.", links: ["Home", "Settings", "Login"] }, { background: "#202123", text: "#ffffff", align: "left" })],
    ["Custom admin panel blocks", "Dashboard-style cards for admin pages.", () => makeBlock("section.services", "Custom admin panel blocks", { heading: "Admin panel", items: ["Metric card", "Action list", "Status panel"] }, { background: "#f7f8f8", text: "#202123", columns: 3 })]
  ].map(([name, description, block]) => ({ name, description, block }));

  let builderPages = [];
  let busy = false;

  function injectRegistryStyles() {
    if (document.getElementById("builderRegistryStyles")) return;
    const style = document.createElement("style");
    style.id = "builderRegistryStyles";
    style.textContent = `
      .registry-page-card,.section-palette-card{display:grid;gap:8px}
      .registry-page-card strong,.section-palette-card strong{color:var(--text)}
      .registry-page-meta{display:flex;flex-wrap:wrap;gap:6px;align-items:center;color:var(--muted);font-size:.75rem}
      .registry-draft-state{padding:2px 7px;border:1px solid var(--line);border-radius:999px;background:var(--panel-soft);color:var(--muted);font-size:.7rem;font-weight:850}
      .registry-draft-state.ready{border-color:rgba(16,163,127,.45);background:rgba(16,163,127,.12);color:var(--primary)}
      .registry-actions{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:6px}
      .registry-actions button,.section-palette-card button{min-height:32px;padding:0 8px;border-radius:calc(var(--radius) - 2px);font-size:.73rem;font-weight:850;white-space:normal}
      .registry-actions button:disabled{opacity:.55;cursor:not-allowed}
      .builder-section-palette{margin-top:10px;padding-top:10px;border-top:1px solid var(--line)}
      .builder-section-palette h3{margin:0 0 8px;color:var(--muted);font-size:.76rem;line-height:1.2;text-transform:uppercase}
      .section-palette-card small{color:var(--muted)}
      .section-palette-card button{justify-self:start}
    `;
    document.head.appendChild(style);
  }

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

  function setBuilderStatus(message, error = false) {
    if (typeof window.setStatus === "function") window.setStatus(message, error);
    else {
      const status = document.getElementById("builderStatus");
      if (status) {
        status.textContent = message;
        status.classList.toggle("error", error);
      }
    }
  }

  function escapeHtml(value) {
    return String(value ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }

  function makeBlock(type, name, content, style = {}) {
    return { id: crypto.randomUUID(), type, name, content, style, responsive: {}, children: [] };
  }

  function starterContent(page) {
    return {
      version: 1,
      blocks: [
        makeBlock("section.hero", `${page.title} hero`, {
          eyebrow: page.title,
          heading: page.title,
          body: "Draft page created from the editable page registry.",
          primaryButton: "Edit this page",
          secondaryButton: "Preview"
        }, { background: "#101010", text: "#ffffff", align: "left" })
      ]
    };
  }

  function pageFor(definition) {
    return builderPages.find((page) => page.slug === definition.slug || page.title?.toLowerCase() === definition.title.toLowerCase()) || null;
  }

  async function refreshPages() {
    const data = await requestJson("/api/builder/pages");
    builderPages = Array.isArray(data.pages) ? data.pages : [];
    renderRegistry();
    return builderPages;
  }

  async function ensureDraft(definition) {
    await refreshPages();
    const existing = pageFor(definition);
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
    await refreshPages();
    return data.page || pageFor(definition);
  }

  async function loadRegistryDraft(definition, createIfMissing = false) {
    if (busy) return;
    busy = true;
    try {
      const page = createIfMissing ? await ensureDraft(definition) : (await refreshPages(), pageFor(definition));
      if (!page) {
        setBuilderStatus(`No draft exists for ${definition.title}. Use Create draft first.`);
        return;
      }
      if (typeof window.loadDraft !== "function") throw new Error("Builder draft loader is not ready yet.");
      await window.loadDraft(page.id);
      setBuilderStatus(`Editing draft: ${page.title || definition.title}`);
    } finally {
      busy = false;
      renderRegistry();
    }
  }

  async function handleRegistryAction(action, slug) {
    const definition = pages.find((page) => page.slug === slug);
    if (!definition) return;
    if (action === "select") return loadRegistryDraft(definition, false);
    if (action === "create" || action === "edit") return loadRegistryDraft(definition, true);
    if (action === "preview") {
      await loadRegistryDraft(definition, true);
      if (typeof window.previewPage === "function") window.previewPage();
      return;
    }
    if (action === "publish") {
      await loadRegistryDraft(definition, true);
      if (typeof window.publishPage === "function") await window.publishPage();
      return refreshPages();
    }
  }

  function renderRegistry() {
    const container = document.querySelector(".application-pages-list");
    if (!container) return;
    container.innerHTML = `<h3>Editable page registry</h3>${pages.map((definition) => {
      const page = pageFor(definition);
      const hasDraft = Boolean(page);
      return `
        <article class="builder-list-item registry-page-card" data-registry-page="${escapeHtml(definition.slug)}">
          <div>
            <strong>${escapeHtml(definition.title)}</strong>
            <div class="registry-page-meta">
              <span>${escapeHtml(definition.path)}</span>
              <span class="registry-draft-state${hasDraft ? " ready" : ""}">${hasDraft ? "Draft ready" : "No draft"}</span>
            </div>
          </div>
          <div class="registry-actions">
            <button type="button" data-registry-action="select" data-page-slug="${escapeHtml(definition.slug)}">Select page</button>
            <button type="button" data-registry-action="create" data-page-slug="${escapeHtml(definition.slug)}">${hasDraft ? "Draft ready" : "Create draft"}</button>
            <button type="button" data-registry-action="edit" data-page-slug="${escapeHtml(definition.slug)}">Edit draft</button>
            <button type="button" data-registry-action="preview" data-page-slug="${escapeHtml(definition.slug)}">Preview</button>
            <button type="button" data-registry-action="publish" data-page-slug="${escapeHtml(definition.slug)}">Publish</button>
            <button type="button" disabled title="Version restore will be wired in a later phase.">Restore later</button>
          </div>
        </article>`;
    }).join("")}`;
    container.querySelectorAll("[data-registry-action]").forEach((button) => {
      button.addEventListener("click", () => handleRegistryAction(button.dataset.registryAction, button.dataset.pageSlug)
        .catch((error) => setBuilderStatus(error.message, true)));
    });
  }

  function appendSectionPalette() {
    const list = document.getElementById("templatesList");
    if (!list || list.querySelector(".builder-section-palette")) return;
    const palette = document.createElement("div");
    palette.className = "builder-section-palette";
    palette.innerHTML = `<h3>Reusable blocks</h3>${sections.map((section, index) => `
      <article class="builder-list-item section-palette-card">
        <div>
          <strong>${escapeHtml(section.name)}</strong>
          <small>${escapeHtml(section.description)}</small>
        </div>
        <button type="button" data-section-index="${index}">Add block</button>
      </article>
    `).join("")}`;
    list.appendChild(palette);
    palette.querySelectorAll("[data-section-index]").forEach((button) => {
      button.addEventListener("click", () => addReusableSection(Number(button.dataset.sectionIndex)));
    });
  }

  function addReusableSection(index) {
    const section = sections[index];
    if (!section) return;
    if (typeof window.currentContent !== "function" || typeof window.markDirty !== "function") {
      setBuilderStatus("Builder section tools are still loading.", true);
      return;
    }
    const content = window.currentContent();
    content.blocks = Array.isArray(content.blocks) ? content.blocks : [];
    content.blocks.push(section.block());
    window.markDirty();
    setBuilderStatus(`Added ${section.name}. Select it on the canvas to edit its properties.`);
  }

  function bootRegistry() {
    injectRegistryStyles();
    const templateList = document.getElementById("templatesList");
    if (templateList) new MutationObserver(() => appendSectionPalette()).observe(templateList, { childList: true });
    setTimeout(() => {
      refreshPages().catch((error) => setBuilderStatus(error.message, true));
      appendSectionPalette();
    }, 500);
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", bootRegistry);
  else bootRegistry();
})();

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
  const fieldMarker = "phaseInspectorReady";

  function safeBlock() {
    const selected = document.querySelector(".canvas-block.selected") || document.querySelector(".layer-list .active[data-layer-id]");
    const blockId = selected?.dataset.blockId || selected?.dataset.layerId || "";
    return blockId && typeof window.findBlock === "function" ? window.findBlock(blockId) : null;
  }

  function escapeHtml(value) {
    return String(value ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }

  function validColor(value, fallback) {
    return /^#[0-9a-f]{6}$/i.test(value || "") ? value : fallback;
  }

  function lines(value) {
    return Array.isArray(value) ? value.map((item) => typeof item === "string" ? item : item?.label || item?.url || "").join("\n") : "";
  }

  function ensureResponsive(block) {
    block.responsive = block.responsive && typeof block.responsive === "object" ? block.responsive : {};
    ["desktop", "tablet", "mobile"].forEach((device) => {
      block.responsive[device] = block.responsive[device] && typeof block.responsive[device] === "object" ? block.responsive[device] : {};
    });
    return block.responsive;
  }

  function enhanceInspector() {
    const form = document.getElementById("inspectorForm");
    const block = safeBlock();
    if (!form || !block || form.dataset[fieldMarker] === block.id) return;

    const responsive = ensureResponsive(block);
    const imagesValue = Array.isArray(block.content?.images)
      ? block.content.images.map((image) => typeof image === "string" ? image : `${image.url || ""}|${image.alt || ""}`).join("\n")
      : "";
    const linksValue = lines(block.content?.links);
    const hidden = block.style?.hidden === true;

    form.dataset[fieldMarker] = block.id;
    form.insertAdjacentHTML("beforeend", `
      <fieldset class="builder-inspector-group">
        <legend>Images and links</legend>
        <label>Images <small>One per line, use URL or URL|alt text.</small><textarea name="phaseImages">${escapeHtml(imagesValue)}</textarea></label>
        <label>Links <small>One per line.</small><textarea name="phaseLinks">${escapeHtml(linksValue)}</textarea></label>
        <div class="form-row">
          <label>Primary URL<input name="phasePrimaryUrl" value="${escapeHtml(block.content?.primaryUrl || block.content?.buttonUrl || "#")}" /></label>
          <label>Secondary URL<input name="phaseSecondaryUrl" value="${escapeHtml(block.content?.secondaryUrl || "#")}" /></label>
        </div>
      </fieldset>
      <fieldset class="builder-inspector-group">
        <legend>Spacing and layout</legend>
        <div class="form-row">
          <label>Top spacing<input name="phasePaddingTop" type="number" min="0" max="180" value="${Number(block.style?.paddingTop ?? 56)}" /></label>
          <label>Bottom spacing<input name="phasePaddingBottom" type="number" min="0" max="180" value="${Number(block.style?.paddingBottom ?? 56)}" /></label>
        </div>
        <div class="form-row">
          <label>Gap<input name="phaseGap" type="number" min="0" max="64" value="${Number(block.style?.gap ?? 14)}" /></label>
          <label>Radius<input name="phaseRadius" type="number" min="0" max="48" value="${Number(block.style?.radius ?? 8)}" /></label>
        </div>
      </fieldset>
      <fieldset class="builder-inspector-group">
        <legend>Visibility and devices</legend>
        <label><input name="phaseHidden" type="checkbox" ${hidden ? "checked" : ""} /> Hide this section</label>
        <div class="form-row">
          <label>Desktop columns<input name="phaseDesktopColumns" type="number" min="1" max="6" value="${Number(responsive.desktop.columns || block.style?.columns || 3)}" /></label>
          <label>Tablet columns<input name="phaseTabletColumns" type="number" min="1" max="4" value="${Number(responsive.tablet.columns || 2)}" /></label>
        </div>
        <div class="form-row">
          <label>Mobile columns<input name="phaseMobileColumns" type="number" min="1" max="2" value="${Number(responsive.mobile.columns || 1)}" /></label>
          <label>Mobile align<select name="phaseMobileAlign"><option value="">Default</option><option value="left">Left</option><option value="center">Center</option><option value="right">Right</option></select></label>
        </div>
        <div class="form-row">
          <label><input name="phaseHideTablet" type="checkbox" ${responsive.tablet.hidden ? "checked" : ""} /> Hide tablet</label>
          <label><input name="phaseHideMobile" type="checkbox" ${responsive.mobile.hidden ? "checked" : ""} /> Hide mobile</label>
        </div>
      </fieldset>
    `);
    form.elements.phaseMobileAlign.value = responsive.mobile.align || "";
    form.querySelectorAll("[name^='phase']").forEach((field) => {
      field.addEventListener("input", updateEnhancedInspector);
      field.addEventListener("change", updateEnhancedInspector);
    });
  }

  function updateEnhancedInspector() {
    const form = document.getElementById("inspectorForm");
    const block = safeBlock();
    if (!form || !block) return;
    const data = new FormData(form);
    if (typeof window.pushUndo === "function") window.pushUndo();

    block.content = block.content && typeof block.content === "object" ? block.content : {};
    block.style = block.style && typeof block.style === "object" ? block.style : {};
    const responsive = ensureResponsive(block);

    block.content.images = String(data.get("phaseImages") || "")
      .split("\n")
      .map((row) => row.trim())
      .filter(Boolean)
      .map((row) => {
        const [url, alt = ""] = row.split("|");
        return { url: url.trim(), alt: alt.trim() };
      });
    block.content.links = String(data.get("phaseLinks") || "").split("\n").map((item) => item.trim()).filter(Boolean);
    block.content.primaryUrl = String(data.get("phasePrimaryUrl") || "#");
    block.content.secondaryUrl = String(data.get("phaseSecondaryUrl") || "#");
    block.content.buttonUrl = block.content.primaryUrl;

    block.style.paddingTop = Number(data.get("phasePaddingTop") || 56);
    block.style.paddingBottom = Number(data.get("phasePaddingBottom") || 56);
    block.style.gap = Number(data.get("phaseGap") || 14);
    block.style.radius = Number(data.get("phaseRadius") || 8);
    block.style.hidden = data.get("phaseHidden") === "on";
    responsive.desktop.columns = Number(data.get("phaseDesktopColumns") || 3);
    responsive.tablet.columns = Number(data.get("phaseTabletColumns") || 2);
    responsive.mobile.columns = Number(data.get("phaseMobileColumns") || 1);
    responsive.mobile.align = String(data.get("phaseMobileAlign") || "");
    responsive.tablet.hidden = data.get("phaseHideTablet") === "on";
    responsive.mobile.hidden = data.get("phaseHideMobile") === "on";

    if (typeof window.markDirty === "function") window.markDirty();
  }

  function currentDevice() {
    const frame = document.getElementById("canvasFrame");
    if (frame?.classList.contains("mobile")) return "mobile";
    if (frame?.classList.contains("tablet")) return "tablet";
    return "desktop";
  }

  function applyCanvasEnhancements() {
    const device = currentDevice();
    document.querySelectorAll(".canvas-block[data-block-id]").forEach((section) => {
      const block = typeof window.findBlock === "function" ? window.findBlock(section.dataset.blockId) : null;
      if (!block) return;
      const responsive = ensureResponsive(block);
      const deviceRules = responsive[device] || {};
      const hidden = block.style?.hidden || deviceRules.hidden;
      section.style.display = hidden ? "none" : "";
      section.style.paddingTop = `${Number(block.style?.paddingTop ?? 56)}px`;
      section.style.paddingBottom = `${Number(block.style?.paddingBottom ?? 56)}px`;
      section.querySelector(".canvas-inner")?.style.setProperty("gap", `${Number(block.style?.gap ?? 14)}px`);
      if (deviceRules.align) section.style.textAlign = deviceRules.align;
      section.querySelectorAll(".canvas-card").forEach((card) => {
        card.style.borderRadius = `${Number(block.style?.radius ?? 8)}px`;
      });
      const grid = section.querySelector(".canvas-grid");
      if (grid && deviceRules.columns) grid.style.gridTemplateColumns = `repeat(${deviceRules.columns}, minmax(0, 1fr))`;
      const inner = section.querySelector(".canvas-inner");
      if (inner && block.type === "section.gallery" && Array.isArray(block.content?.images) && block.content.images.length && !inner.querySelector(".phase-gallery-images")) {
        inner.insertAdjacentHTML("beforeend", `<div class="canvas-grid phase-gallery-images">${block.content.images.map((image) => `<article class="canvas-card"><img src="${escapeHtml(image.url || image)}" alt="${escapeHtml(image.alt || "")}" style="width:100%;height:150px;object-fit:cover;border-radius:${Number(block.style?.radius ?? 8)}px"><p>${escapeHtml(image.alt || "Image")}</p></article>`).join("")}</div>`);
      }
      if (inner && block.type === "section.cta" && block.content?.buttonLabel && !inner.querySelector(".phase-button-action")) {
        inner.insertAdjacentHTML("beforeend", `<div class="canvas-actions phase-button-action"><a class="canvas-button" href="${escapeHtml(block.content.buttonUrl || block.content.primaryUrl || "#")}">${escapeHtml(block.content.buttonLabel)}</a></div>`);
      }
    });
  }

  function globalButtonVars() {
    let style = {};
    try { style = JSON.parse(localStorage.getItem("switchboard-button-design") || "{}"); } catch (error) { style = {}; }
    const radius = Number(style.radius ?? 8);
    const width = Number(style.width ?? 0);
    const height = Number(style.height ?? 38);
    const textSize = Number(style.textSize ?? 14);
    const weight = style.textStyle === "heavy" ? 900 : ["bold", "uppercase"].includes(style.textStyle) ? 800 : 750;
    return `
      --global-button-radius:${radius}px;
      --global-button-width:${width ? `${width}px` : "auto"};
      --global-button-height:${height}px;
      --global-button-text-size:${textSize}px;
      --global-button-weight:${weight};
      --global-button-transform:${style.textStyle === "uppercase" ? "uppercase" : "none"};
      --global-button-bg:${validColor(style.background, "#202123")};
      --global-button-text:${validColor(style.text, "#ffffff")};
      --global-button-border:${validColor(style.border, "#202123")};
      --global-button-hover-bg:${validColor(style.hoverBackground, "#2f3338")};
      --global-button-hover-text:${validColor(style.hoverText, "#ffffff")};
      --global-button-click-bg:${validColor(style.clickBackground, "#111111")};
    `;
  }

  function renderPreviewBlock(block) {
    const style = block.style || {};
    if (style.hidden) return "";
    const content = block.content || {};
    const css = `background:${escapeHtml(style.background || "#ffffff")};color:${escapeHtml(style.text || "#202123")};text-align:${escapeHtml(style.align || "left")};padding:${Number(style.paddingTop ?? 72)}px max(24px,8vw) ${Number(style.paddingBottom ?? 72)}px`;
    const heading = escapeHtml(content.heading || block.name || "Section");
    const body = content.body ? `<p>${escapeHtml(content.body)}</p>` : "";
    if (block.type === "section.hero") return `<section class="builder-public-section builder-public-hero" style="${css}"><p>${escapeHtml(content.eyebrow || "")}</p><h1>${heading}</h1>${body}<p><a href="${escapeHtml(content.primaryUrl || "#")}">${escapeHtml(content.primaryButton || "Action")}</a></p></section>`;
    if (block.type === "section.gallery") return `<section class="builder-public-section" style="${css}"><h2>${heading}</h2><div class="builder-public-grid">${(content.images || []).map((image) => `<article><img src="${escapeHtml(image.url || image)}" alt="${escapeHtml(image.alt || "")}"><p>${escapeHtml(image.alt || "Image")}</p></article>`).join("")}</div></section>`;
    if (block.type === "section.form") return `<section class="builder-public-section" style="${css}"><h2>${heading}</h2><form>${(content.fields || []).map((field) => `<label>${escapeHtml(field.label || field)}<input type="${escapeHtml(field.type || "text")}"></label>`).join("")}<button type="button">${escapeHtml(content.submitLabel || "Submit")}</button></form></section>`;
    if (["section.services", "section.faq", "section.testimonials"].includes(block.type)) return `<section class="builder-public-section" style="${css}"><h2>${heading}</h2><div class="builder-public-grid">${(content.items || []).map((item) => `<article>${escapeHtml(item)}</article>`).join("")}</div></section>`;
    if (block.type === "section.footer") return `<footer class="builder-public-section" style="${css}"><h2>${heading}</h2>${body}<div>${(content.links || []).map((link) => `<a href="#">${escapeHtml(link)}</a>`).join(" ")}</div></footer>`;
    return `<section class="builder-public-section" style="${css}"><h2>${heading}</h2>${body}${content.buttonLabel ? `<p><a href="${escapeHtml(content.buttonUrl || "#")}">${escapeHtml(content.buttonLabel)}</a></p>` : ""}</section>`;
  }

  function enhancedPreview(event) {
    event.preventDefault();
    event.stopImmediatePropagation();
    const content = typeof window.currentContent === "function" ? window.currentContent() : { blocks: [] };
    const title = document.getElementById("seoTitle")?.value || "Draft preview";
    const html = `<!doctype html><html style="${globalButtonVars()}"><head><base href="${location.origin}/"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(title)}</title><script src="/button-design-global-v2.js" defer></script><style>body{margin:0;font-family:Inter,Arial,sans-serif;color:#202123}.builder-public-section{padding:72px max(24px,8vw)}.builder-public-hero h1{font-size:clamp(2rem,4vw,4rem);margin:12px 0}.builder-public-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:16px}.builder-public-grid article{border:1px solid #ddd;padding:18px;border-radius:var(--global-button-radius,8px)}.builder-public-grid img{width:100%;height:180px;object-fit:cover;border-radius:var(--global-button-radius,8px)}a,button{display:inline-flex;align-items:center;justify-content:center;min-width:var(--global-button-width,auto);min-height:var(--global-button-height,38px);padding:0 16px;border:1px solid var(--global-button-border,#202123);border-radius:var(--global-button-radius,8px);background:var(--global-button-bg,#202123);color:var(--global-button-text,#fff);font-size:var(--global-button-text-size,14px);font-weight:var(--global-button-weight,800);text-transform:var(--global-button-transform,none);text-decoration:none}a:hover,button:hover{background:var(--global-button-hover-bg,#2f3338);color:var(--global-button-hover-text,#fff)}a:active,button:active{background:var(--global-button-click-bg,#111)}form{display:grid;gap:12px;max-width:640px}label{display:grid;gap:6px}input{padding:11px;border:1px solid #bbb;border-radius:8px}</style></head><body>${(content.blocks || []).map(renderPreviewBlock).join("")}</body></html>`;
    const win = window.open("", "_blank", "noopener,noreferrer");
    if (win) {
      win.document.write(html);
      win.document.close();
    }
  }

  function bootPhaseInspector() {
    const form = document.getElementById("inspectorForm");
    const canvas = document.getElementById("builderCanvas");
    const preview = document.getElementById("previewButton");
    if (form) new MutationObserver(enhanceInspector).observe(form, { childList: true, subtree: true });
    if (canvas) new MutationObserver(() => { enhanceInspector(); applyCanvasEnhancements(); }).observe(canvas, { childList: true, subtree: true, attributes: true });
    preview?.addEventListener("click", enhancedPreview, true);
    setInterval(() => { enhanceInspector(); applyCanvasEnhancements(); }, 900);
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", bootPhaseInspector);
  else bootPhaseInspector();
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

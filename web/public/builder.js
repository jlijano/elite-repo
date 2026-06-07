const sessionTokenStorageKey = "switchboard-session-token";
const adminTokenStorageKey = "switchboard-admin-token";

const state = {
  pages: [],
  templates: [],
  media: [],
  currentPage: null,
  draft: { content: { version: 1, blocks: [] } },
  selectedBlockId: "",
  viewport: "desktop",
  undoStack: [],
  redoStack: [],
  autosaveTimer: null,
  dirty: false
};

const els = {
  status: document.getElementById("builderStatus"),
  pageSelect: document.getElementById("pageSelect"),
  pageCount: document.getElementById("pageCount"),
  pagesList: document.getElementById("pagesList"),
  templatesList: document.getElementById("templatesList"),
  mediaList: document.getElementById("mediaList"),
  canvasFrame: document.getElementById("canvasFrame"),
  canvas: document.getElementById("builderCanvas"),
  layerList: document.getElementById("layerList"),
  layerCount: document.getElementById("layerCount"),
  selectedBlockType: document.getElementById("selectedBlockType"),
  inspectorForm: document.getElementById("inspectorForm"),
  seoForm: document.getElementById("seoForm"),
  warnings: document.getElementById("publishWarnings"),
  warningCount: document.getElementById("warningCount"),
  seoTitle: document.getElementById("seoTitle"),
  seoDescription: document.getElementById("seoDescription"),
  seoCanonical: document.getElementById("seoCanonical"),
  seoRobots: document.getElementById("seoRobots"),
  pageSlug: document.getElementById("pageSlug"),
  profileMenuButton: document.getElementById("profileMenuButton"),
  profileDropdown: document.getElementById("profileDropdown")
};

function setStatus(message, error = false) {
  els.status.textContent = message;
  els.status.classList.toggle("error", error);
}

function escapeHtml(value) {
  return String(value ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function authHeaders() {
  const sessionToken = sessionStorage.getItem(sessionTokenStorageKey) || "";
  const adminToken = sessionStorage.getItem(adminTokenStorageKey) || "";
  return {
    "Content-Type": "application/json",
    ...(sessionToken ? { "x-session-token": sessionToken } : {}),
    ...(adminToken ? { "x-admin-token": adminToken } : {})
  };
}

async function requestJson(url, options = {}) {
  const response = await fetch(url, { ...options, headers: { ...authHeaders(), ...(options.headers || {}) } });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || "Builder request failed.");
  return data;
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function currentContent() {
  return state.draft?.content || { version: 1, blocks: [] };
}

function blocks() {
  return currentContent().blocks || [];
}

function findBlock(blockId) {
  return blocks().find((block) => block.id === blockId) || null;
}

function pushUndo() {
  state.undoStack.push(clone(currentContent()));
  if (state.undoStack.length > 40) state.undoStack.shift();
  state.redoStack = [];
}

function markDirty() {
  state.dirty = true;
  scheduleAutosave();
  renderAll();
}

function scheduleAutosave() {
  clearTimeout(state.autosaveTimer);
  state.autosaveTimer = setTimeout(() => autosaveDraft().catch((error) => setStatus(error.message, true)), 1200);
}

function blockLabel(block) {
  return block.name || block.type.replace("section.", "");
}

function renderPages() {
  els.pageCount.textContent = String(state.pages.length);
  els.pageSelect.innerHTML = state.pages.map((page) => `<option value="${escapeHtml(page.id)}">${escapeHtml(page.title)}</option>`).join("");
  if (state.currentPage) els.pageSelect.value = state.currentPage.id;
  els.pagesList.innerHTML = state.pages.map((page) => `<button class="builder-list-item${page.id === state.currentPage?.id ? " active" : ""}" type="button" data-page-id="${escapeHtml(page.id)}"><strong>${escapeHtml(page.title)}</strong><small>/${escapeHtml(page.slug)} - ${escapeHtml(page.status)}</small></button>`).join("");
  els.pagesList.querySelectorAll("[data-page-id]").forEach((button) => button.addEventListener("click", () => loadDraft(button.dataset.pageId)));
}

function renderTemplates() {
  els.templatesList.innerHTML = state.templates.map((template) => `<button class="builder-list-item" type="button" data-template-id="${escapeHtml(template.id)}"><strong>${escapeHtml(template.name)}</strong><small>${escapeHtml(template.category)}</small></button>`).join("");
  els.templatesList.querySelectorAll("[data-template-id]").forEach((button) => button.addEventListener("click", () => insertTemplate(button.dataset.templateId)));
}

function renderMedia() {
  els.mediaList.innerHTML = state.media.map((asset) => `<button class="builder-list-item" type="button" data-media-id="${escapeHtml(asset.id)}"><strong>${escapeHtml(asset.fileName)}</strong><small>${escapeHtml(asset.mimeType)} - ${escapeHtml(asset.altText || "No alt text")}</small></button>`).join("");
}

function renderCanvas() {
  const blockList = blocks();
  if (!blockList.length) {
    els.canvas.innerHTML = `<div class="builder-empty"><strong>Empty page</strong><p>Add a template or section from the left panel.</p></div>`;
    return;
  }
  els.canvas.innerHTML = blockList.map(renderCanvasBlock).join("");
  els.canvas.querySelectorAll("[data-block-id]").forEach((section) => {
    section.addEventListener("click", () => selectBlock(section.dataset.blockId));
  });
}

function renderCanvasBlock(block) {
  const bg = escapeHtml(block.style?.background || "#ffffff");
  const color = escapeHtml(block.style?.text || "#202123");
  const align = escapeHtml(block.style?.align || "left");
  const selected = block.id === state.selectedBlockId ? " selected" : "";
  const heading = escapeHtml(block.content?.heading || blockLabel(block));
  const body = escapeHtml(block.content?.body || "");
  const items = Array.isArray(block.content?.items) ? block.content.items : [];
  const cardGrid = ["section.services", "section.gallery", "section.testimonials", "section.faq"].includes(block.type)
    ? `<div class="canvas-grid">${items.map((item) => `<article class="canvas-card"><strong>${escapeHtml(item)}</strong><p>${block.type === "section.faq" ? "Answer placeholder" : "Reusable block content"}</p></article>`).join("")}</div>`
    : "";
  const form = block.type === "section.form"
    ? `<div class="canvas-grid">${(block.content.fields || []).map((field) => `<article class="canvas-card"><strong>${escapeHtml(field)}</strong><p>Form field</p></article>`).join("")}</div>`
    : "";
  const actions = block.content?.primaryButton || block.content?.secondaryButton
    ? `<div class="canvas-actions">${block.content.primaryButton ? `<a class="canvas-button" href="#">${escapeHtml(block.content.primaryButton)}</a>` : ""}${block.content.secondaryButton ? `<a class="canvas-button" href="#">${escapeHtml(block.content.secondaryButton)}</a>` : ""}</div>`
    : "";
  return `<section class="canvas-block${selected}" data-block-id="${escapeHtml(block.id)}" data-block-label="${escapeHtml(blockLabel(block))}" style="background:${bg};color:${color};text-align:${align}"><div class="canvas-inner ${align === "center" ? "center" : ""}"><p>${escapeHtml(block.content?.eyebrow || "")}</p><h1>${heading}</h1>${body ? `<p>${body}</p>` : ""}${cardGrid}${form}${actions}</div></section>`;
}

function renderLayers() {
  const blockList = blocks();
  els.layerCount.textContent = String(blockList.length);
  els.layerList.innerHTML = blockList.map((block, index) => `<div class="builder-list-item${block.id === state.selectedBlockId ? " active" : ""}" data-layer-id="${escapeHtml(block.id)}"><span><strong>${escapeHtml(blockLabel(block))}</strong><small>${escapeHtml(block.type)}</small></span><span class="layer-actions"><button type="button" data-action="up" data-index="${index}">Up</button><button type="button" data-action="down" data-index="${index}">Down</button><button type="button" data-action="copy" data-index="${index}">Copy</button><button type="button" data-action="delete" data-index="${index}">Delete</button></span></div>`).join("");
  els.layerList.querySelectorAll("[data-layer-id]").forEach((row) => row.addEventListener("click", (event) => {
    if (event.target.tagName !== "BUTTON") selectBlock(row.dataset.layerId);
  }));
  els.layerList.querySelectorAll("button[data-action]").forEach((button) => button.addEventListener("click", () => layerAction(button.dataset.action, Number(button.dataset.index))));
}

function renderInspector() {
  const block = findBlock(state.selectedBlockId);
  if (!block) {
    els.selectedBlockType.textContent = "Page";
    els.inspectorForm.innerHTML = `<p class="empty">Select a section on the canvas or layer tree.</p>`;
    return;
  }
  els.selectedBlockType.textContent = block.type;
  const itemsValue = Array.isArray(block.content.items) ? block.content.items.join("\n") : Array.isArray(block.content.fields) ? block.content.fields.join("\n") : "";
  els.inspectorForm.innerHTML = `
    <label>Section name<input name="name" value="${escapeHtml(block.name)}" /></label>
    <label>Heading<input name="heading" value="${escapeHtml(block.content.heading || "")}" /></label>
    <label>Body<textarea name="body">${escapeHtml(block.content.body || "")}</textarea></label>
    <label>Eyebrow<input name="eyebrow" value="${escapeHtml(block.content.eyebrow || "")}" /></label>
    <div class="form-row"><label>Primary button<input name="primaryButton" value="${escapeHtml(block.content.primaryButton || "")}" /></label><label>Secondary button<input name="secondaryButton" value="${escapeHtml(block.content.secondaryButton || "")}" /></label></div>
    <label>Items or fields<textarea name="items">${escapeHtml(itemsValue)}</textarea></label>
    <div class="form-row"><label>Background<input name="background" type="color" value="${escapeHtml(validColor(block.style.background, "#ffffff"))}" /></label><label>Text<input name="text" type="color" value="${escapeHtml(validColor(block.style.text, "#202123"))}" /></label></div>
    <label>Alignment<select name="align"><option value="left">Left</option><option value="center">Center</option><option value="right">Right</option></select></label>
  `;
  els.inspectorForm.elements.align.value = block.style.align || "left";
  els.inspectorForm.querySelectorAll("input, textarea, select").forEach((field) => field.addEventListener("input", updateSelectedBlockFromInspector));
}

function validColor(value, fallback) {
  return /^#[0-9a-f]{6}$/i.test(value || "") ? value : fallback;
}

function renderSeo() {
  if (!state.currentPage) return;
  els.seoTitle.value = state.currentPage.seo?.title || "";
  els.seoDescription.value = state.currentPage.seo?.description || "";
  els.seoCanonical.value = state.currentPage.seo?.canonicalUrl || "";
  els.seoRobots.value = state.currentPage.seo?.robots || "index,follow";
  els.pageSlug.value = state.currentPage.slug || "";
}

function renderWarnings(warnings = []) {
  els.warningCount.textContent = String(warnings.length);
  els.warnings.innerHTML = warnings.length ? warnings.map((warning) => `<div class="warning-item">${escapeHtml(warning)}</div>`).join("") : `<div class="builder-list-item"><strong>No publish warnings</strong><small>Validation runs again when publishing.</small></div>`;
}

function renderAll() {
  renderPages();
  renderTemplates();
  renderMedia();
  renderCanvas();
  renderLayers();
  renderInspector();
  renderSeo();
}

function selectBlock(blockId) {
  state.selectedBlockId = blockId;
  renderAll();
}

function updateSelectedBlockFromInspector() {
  const block = findBlock(state.selectedBlockId);
  if (!block) return;
  pushUndo();
  const form = new FormData(els.inspectorForm);
  block.name = String(form.get("name") || block.name).trim() || block.name;
  block.content.heading = String(form.get("heading") || "");
  block.content.body = String(form.get("body") || "");
  block.content.eyebrow = String(form.get("eyebrow") || "");
  block.content.primaryButton = String(form.get("primaryButton") || "");
  block.content.secondaryButton = String(form.get("secondaryButton") || "");
  const items = String(form.get("items") || "").split("\n").map((item) => item.trim()).filter(Boolean);
  if (block.type === "section.form") block.content.fields = items;
  else block.content.items = items;
  block.style.background = String(form.get("background") || block.style.background);
  block.style.text = String(form.get("text") || block.style.text);
  block.style.align = String(form.get("align") || "left");
  markDirty();
}

function updatePageSeoFromForm() {
  if (!state.currentPage) return;
  state.currentPage.slug = els.pageSlug.value.trim();
  state.currentPage.seo = {
    title: els.seoTitle.value.trim(),
    description: els.seoDescription.value.trim(),
    canonicalUrl: els.seoCanonical.value.trim(),
    robots: els.seoRobots.value
  };
}

function layerAction(action, index) {
  const blockList = blocks();
  if (!blockList[index]) return;
  pushUndo();
  if (action === "up" && index > 0) [blockList[index - 1], blockList[index]] = [blockList[index], blockList[index - 1]];
  if (action === "down" && index < blockList.length - 1) [blockList[index + 1], blockList[index]] = [blockList[index], blockList[index + 1]];
  if (action === "copy") {
    const copy = clone(blockList[index]);
    copy.id = crypto.randomUUID();
    copy.name = `${copy.name} copy`;
    blockList.splice(index + 1, 0, copy);
    state.selectedBlockId = copy.id;
  }
  if (action === "delete") {
    const [removed] = blockList.splice(index, 1);
    if (removed?.id === state.selectedBlockId) state.selectedBlockId = blockList[0]?.id || "";
  }
  markDirty();
}

function insertTemplate(templateId) {
  const template = state.templates.find((item) => item.id === templateId);
  if (!template) return;
  pushUndo();
  const nextBlocks = clone(template.content.blocks || []);
  nextBlocks.forEach((block) => { block.id = crypto.randomUUID(); });
  currentContent().blocks.push(...nextBlocks);
  state.selectedBlockId = nextBlocks[0]?.id || state.selectedBlockId;
  markDirty();
}

async function loadBuilder() {
  setStatus("Loading Builder workspace...");
  const [pagesData, templatesData, mediaData] = await Promise.all([
    requestJson("/api/builder/pages"),
    requestJson("/api/builder/templates"),
    requestJson("/api/builder/media")
  ]);
  state.pages = pagesData.pages || [];
  state.templates = templatesData.templates || [];
  state.media = mediaData.media || [];
  if (!state.pages.length) {
    const created = await requestJson("/api/builder/pages", { method: "POST", body: JSON.stringify({ title: "Home", slug: "home", seo: { title: "Home", description: "Draft homepage" } }) });
    state.pages = [created.page];
  }
  await loadDraft(state.pages[0].id);
  setStatus("Builder loaded. Draft changes autosave after edits.");
}

async function loadDraft(pageId) {
  setStatus("Loading page draft...");
  const data = await requestJson(`/api/builder/pages/${encodeURIComponent(pageId)}/draft`);
  state.currentPage = data.page;
  state.draft = data.draft;
  state.selectedBlockId = blocks()[0]?.id || "";
  state.undoStack = [];
  state.redoStack = [];
  state.dirty = false;
  renderWarnings([]);
  renderAll();
  setStatus(`Loaded draft: ${state.currentPage.title}`);
}

async function createPage() {
  const title = window.prompt("Page title", "New page");
  if (!title || !title.trim()) return;
  const data = await requestJson("/api/builder/pages", { method: "POST", body: JSON.stringify({ title: title.trim(), seo: { title: title.trim(), description: "" } }) });
  state.pages.unshift(data.page);
  await loadDraft(data.page.id);
}

async function saveDraft() {
  if (!state.currentPage) return;
  updatePageSeoFromForm();
  await requestJson(`/api/builder/pages/${encodeURIComponent(state.currentPage.id)}`, { method: "PATCH", body: JSON.stringify({ title: state.currentPage.title, slug: state.currentPage.slug, seo: state.currentPage.seo }) });
  const data = await requestJson(`/api/builder/pages/${encodeURIComponent(state.currentPage.id)}/draft`, { method: "PUT", body: JSON.stringify({ content: currentContent() }) });
  state.draft = data.draft;
  state.dirty = false;
  setStatus("Draft saved.");
}

async function autosaveDraft() {
  if (!state.currentPage || !state.dirty) return;
  await requestJson(`/api/builder/pages/${encodeURIComponent(state.currentPage.id)}/autosave`, { method: "POST", body: JSON.stringify({ content: currentContent() }) });
  setStatus("Autosaved draft.");
}

async function publishPage() {
  if (!state.currentPage) return;
  await saveDraft();
  const result = await requestJson(`/api/builder/pages/${encodeURIComponent(state.currentPage.id)}/publish`, { method: "POST", body: "{}" });
  renderWarnings(result.warnings || []);
  const index = state.pages.findIndex((page) => page.id === result.page.id);
  if (index >= 0) state.pages[index] = result.page;
  state.currentPage = result.page;
  renderAll();
  setStatus(`Published version ${result.version.versionNumber}.`);
}

function previewPage() {
  const html = `<!doctype html><html><head><meta charset="utf-8"><title>${escapeHtml(state.currentPage?.title || "Preview")}</title><link rel="stylesheet" href="/builder.css"></head><body><div class="builder-canvas">${blocks().map(renderCanvasBlock).join("")}</div></body></html>`;
  const win = window.open("", "_blank", "noopener,noreferrer");
  if (win) {
    win.document.write(html);
    win.document.close();
  }
}

async function addMedia() {
  const contentUrl = window.prompt("Media URL");
  if (!contentUrl || !contentUrl.trim()) return;
  const fileName = window.prompt("File name", contentUrl.split("/").pop() || "Media asset") || "Media asset";
  const altText = window.prompt("Alt text", "") || "";
  const data = await requestJson("/api/builder/media", { method: "POST", body: JSON.stringify({ contentUrl: contentUrl.trim(), fileName, altText, mimeType: "image/*", fileSize: 0 }) });
  state.media.unshift(data.asset);
  renderMedia();
  setStatus("Media asset added.");
}

function undo() {
  if (!state.undoStack.length) return;
  state.redoStack.push(clone(currentContent()));
  state.draft.content = state.undoStack.pop();
  state.selectedBlockId = blocks()[0]?.id || "";
  markDirty();
}

function redo() {
  if (!state.redoStack.length) return;
  state.undoStack.push(clone(currentContent()));
  state.draft.content = state.redoStack.pop();
  state.selectedBlockId = blocks()[0]?.id || "";
  markDirty();
}

function setViewport(viewport) {
  state.viewport = viewport;
  els.canvasFrame.className = `builder-canvas-frame ${viewport}`;
  document.querySelectorAll("[data-viewport]").forEach((button) => button.classList.toggle("active", button.dataset.viewport === viewport));
}

function toggleProfileDropdown() {
  if (!els.profileDropdown || !els.profileMenuButton) return;
  const open = els.profileDropdown.hidden;
  els.profileDropdown.hidden = !open;
  els.profileMenuButton.setAttribute("aria-expanded", String(open));
}

document.getElementById("newPageButton").addEventListener("click", () => createPage().catch((error) => setStatus(error.message, true)));
document.getElementById("saveDraftButton").addEventListener("click", () => saveDraft().catch((error) => setStatus(error.message, true)));
document.getElementById("publishButton").addEventListener("click", () => publishPage().catch((error) => setStatus(error.message, true)));
document.getElementById("previewButton").addEventListener("click", previewPage);
document.getElementById("addMediaButton").addEventListener("click", () => addMedia().catch((error) => setStatus(error.message, true)));
document.getElementById("undoButton").addEventListener("click", undo);
document.getElementById("redoButton").addEventListener("click", redo);
els.pageSelect.addEventListener("change", () => loadDraft(els.pageSelect.value).catch((error) => setStatus(error.message, true)));
els.seoForm.addEventListener("input", () => { updatePageSeoFromForm(); markDirty(); });
document.querySelectorAll("[data-viewport]").forEach((button) => button.addEventListener("click", () => setViewport(button.dataset.viewport)));
els.profileMenuButton?.addEventListener("click", toggleProfileDropdown);
document.querySelectorAll(".profile-logout").forEach((button) => button.addEventListener("click", () => { sessionStorage.removeItem(sessionTokenStorageKey); sessionStorage.removeItem(adminTokenStorageKey); window.location.href = "/login.html"; }));
document.addEventListener("keydown", (event) => {
  if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "s") { event.preventDefault(); saveDraft().catch((error) => setStatus(error.message, true)); }
  if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "z") { event.preventDefault(); undo(); }
});

loadBuilder().catch((error) => setStatus(error.message, true));

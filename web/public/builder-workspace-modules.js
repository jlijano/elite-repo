(() => {
  const layoutStorageKey = "switchboard-builder-workspace-layout";
  const templateStorageKey = "switchboard-builder-workspace-templates";
  const moduleDefinitions = [
    { id: "library", selector: ".builder-left", label: "Library", defaultWidth: 280 },
    { id: "canvas", selector: ".builder-canvas-wrap", label: "Canvas", defaultWidth: 0 },
    { id: "settings", selector: ".builder-right", label: "Settings", defaultWidth: 330 }
  ];

  const workbench = document.querySelector(".builder-workbench");
  const toolbar = document.querySelector(".builder-toolbar");
  if (!workbench || !toolbar) return;

  const modules = moduleDefinitions.map((definition) => ({ ...definition, element: document.querySelector(definition.selector) })).filter((item) => item.element);
  if (modules.length < 3) return;

  let layout = readLayout();
  let resizeState = null;
  let panelDragState = null;
  let toastTimer = null;

  function clamp(value, min, max) {
    const number = Number(value);
    if (!Number.isFinite(number)) return min;
    return Math.max(min, Math.min(max, number));
  }

  function defaultLayout() {
    return {
      enabled: true,
      order: ["library", "canvas", "settings"],
      widths: { library: 280, canvas: 0, settings: 330 }
    };
  }

  function readLayout() {
    try {
      return normalizeLayout(JSON.parse(localStorage.getItem(layoutStorageKey) || "{}"));
    } catch (error) {
      return defaultLayout();
    }
  }

  function saveLayout(nextLayout = layout) {
    layout = normalizeLayout(nextLayout);
    try { localStorage.setItem(layoutStorageKey, JSON.stringify(layout)); } catch (error) {}
  }

  function normalizeLayout(value = {}) {
    const fallback = defaultLayout();
    const validIds = modules.map((item) => item.id);
    const order = Array.isArray(value.order) ? value.order.filter((id) => validIds.includes(id)) : [];
    validIds.forEach((id) => { if (!order.includes(id)) order.push(id); });
    return {
      enabled: value.enabled !== false,
      order: order.slice(0, validIds.length),
      widths: {
        library: clamp(value.widths?.library ?? fallback.widths.library, 220, 520),
        canvas: clamp(value.widths?.canvas ?? fallback.widths.canvas, 0, 1200),
        settings: clamp(value.widths?.settings ?? fallback.widths.settings, 240, 560)
      }
    };
  }

  function readTemplates() {
    try {
      const templates = JSON.parse(localStorage.getItem(templateStorageKey) || "[]");
      return Array.isArray(templates) ? templates.map((item) => ({ name: String(item.name || "Layout"), layout: normalizeLayout(item.layout || {}) })) : [];
    } catch (error) {
      return [];
    }
  }

  function writeTemplates(templates) {
    try { localStorage.setItem(templateStorageKey, JSON.stringify(templates)); } catch (error) {}
  }

  function moduleById(moduleId) {
    return modules.find((item) => item.id === moduleId) || null;
  }

  function orderedModules() {
    return layout.order.map(moduleById).filter(Boolean);
  }

  function setupModules() {
    modules.forEach((item) => {
      item.element.dataset.workspaceModule = item.id;
      item.element.classList.add("builder-workspace-module");
      item.element.draggable = false;
      if (!item.element.querySelector(".workspace-module-bar")) {
        const bar = document.createElement("div");
        bar.className = "workspace-module-bar";
        bar.innerHTML = `
          <span class="workspace-module-title">${item.label}</span>
          <button class="workspace-module-handle" type="button" aria-label="Drag ${item.label}" title="Drag and snap">⠿</button>
          <button class="workspace-module-action" type="button" data-module-action="left" aria-label="Move ${item.label} left" title="Move left">←</button>
          <button class="workspace-module-action" type="button" data-module-action="right" aria-label="Move ${item.label} right" title="Move right">→</button>
          <button class="workspace-module-resize" type="button" aria-label="Resize ${item.label}" title="Resize">↔</button>
        `;
        item.element.appendChild(bar);
      }
    });
  }

  function setupToolbar() {
    if (document.getElementById("builderWorkspaceControl")) return;
    const control = document.createElement("div");
    control.className = "builder-workspace-template-control";
    control.id = "builderWorkspaceControl";
    control.innerHTML = `
      <button id="toggleWorkspaceCustomize" type="button" aria-pressed="true">Customize</button>
      <button id="saveWorkspaceTemplate" type="button">Save layout</button>
      <select id="workspaceTemplateSelect" aria-label="Apply builder space template"><option value="">Layouts</option></select>
      <button id="applyWorkspaceTemplate" type="button">Apply</button>
      <button id="resetWorkspaceLayout" type="button">Reset</button>
    `;
    toolbar.insertBefore(control, toolbar.querySelector(".profile-menu") || null);
    document.getElementById("toggleWorkspaceCustomize")?.addEventListener("click", toggleCustomizeMode);
    document.getElementById("saveWorkspaceTemplate")?.addEventListener("click", saveTemplateFromCurrentLayout);
    document.getElementById("applyWorkspaceTemplate")?.addEventListener("click", applySelectedTemplate);
    document.getElementById("resetWorkspaceLayout")?.addEventListener("click", resetLayout);
    renderTemplateOptions();
  }

  function renderTemplateOptions() {
    const select = document.getElementById("workspaceTemplateSelect");
    if (!select) return;
    const templates = readTemplates();
    select.innerHTML = `<option value="">Layouts</option>${templates.map((template, index) => `<option value="${index}">${escapeOption(template.name)}</option>`).join("")}`;
  }

  function escapeOption(value) {
    return String(value || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/\"/g, "&quot;");
  }

  function applyLayout(nextLayout = layout) {
    layout = normalizeLayout(nextLayout);
    workbench.classList.toggle("workspace-modular-enabled", layout.enabled);
    document.getElementById("toggleWorkspaceCustomize")?.setAttribute("aria-pressed", String(layout.enabled));
    document.getElementById("toggleWorkspaceCustomize")?.classList.toggle("active", layout.enabled);
    for (const [index, moduleId] of layout.order.entries()) {
      const item = moduleById(moduleId);
      if (item) item.element.style.order = String(index + 1);
    }
    const nextOrderedModules = orderedModules();
    nextOrderedModules.forEach((item, index) => {
      const width = item.id === "canvas" && !layout.widths.canvas ? "minmax(360px, 1fr)" : `${layout.widths[item.id] || item.defaultWidth || 320}px`;
      workbench.style.setProperty(`--builder-module-col-${index + 1}`, width);
    });
  }

  function toggleCustomizeMode() {
    layout.enabled = !layout.enabled;
    saveLayout(layout);
    applyLayout(layout);
    showToast(layout.enabled ? "Customize layout enabled. Drag panel handles to snap them into place." : "Customize layout disabled.");
  }

  function moveModule(moduleId, direction) {
    const index = layout.order.indexOf(moduleId);
    if (index < 0) return;
    const nextIndex = direction === "left" ? index - 1 : index + 1;
    if (nextIndex < 0 || nextIndex >= layout.order.length) return;
    [layout.order[index], layout.order[nextIndex]] = [layout.order[nextIndex], layout.order[index]];
    saveLayout(layout);
    applyLayout(layout);
    flashModule(moduleId);
  }

  function resetLayout() {
    layout = defaultLayout();
    saveLayout(layout);
    applyLayout(layout);
    showToast("Builder workspace layout reset.");
  }

  function saveTemplateFromCurrentLayout() {
    const name = window.prompt("Template name", "Builder workspace layout");
    if (!name || !name.trim()) return;
    const templates = readTemplates();
    templates.unshift({ name: name.trim().slice(0, 80), layout: normalizeLayout({ ...layout, enabled: true }) });
    writeTemplates(templates.slice(0, 12));
    renderTemplateOptions();
    showToast("Builder space template saved.");
  }

  function applySelectedTemplate() {
    const select = document.getElementById("workspaceTemplateSelect");
    const index = Number(select?.value);
    const template = readTemplates()[index];
    if (!template) return showToast("Choose a builder space template first.");
    layout = normalizeLayout({ ...template.layout, enabled: true });
    saveLayout(layout);
    applyLayout(layout);
    showToast(`Applied ${template.name}.`);
  }

  function flashModule(moduleId) {
    const item = moduleById(moduleId);
    if (!item) return;
    item.element.classList.remove("builder-module-snap-flash");
    requestAnimationFrame(() => item.element.classList.add("builder-module-snap-flash"));
    setTimeout(() => item.element.classList.remove("builder-module-snap-flash"), 460);
  }

  function showToast(message) {
    let toast = document.getElementById("builderWorkspaceToast");
    if (!toast) {
      toast = document.createElement("div");
      toast.id = "builderWorkspaceToast";
      toast.className = "builder-workspace-toast";
      toast.setAttribute("role", "status");
      document.body.appendChild(toast);
    }
    toast.textContent = message;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toast.remove(), 2600);
  }

  function setupEvents() {
    modules.forEach((item) => {
      item.element.querySelector(".workspace-module-handle")?.addEventListener("pointerdown", (event) => startPanelDrag(event, item.id));
      item.element.querySelectorAll("[data-module-action]").forEach((button) => {
        button.addEventListener("click", () => moveModule(item.id, button.dataset.moduleAction));
      });
      item.element.querySelector(".workspace-module-resize")?.addEventListener("pointerdown", (event) => startResize(event, item.id));
    });
    window.addEventListener("pointermove", (event) => {
      panelDragMove(event);
      resizeMove(event);
    });
    window.addEventListener("pointerup", () => {
      stopPanelDrag();
      stopResize();
    });
  }

  function startPanelDrag(event, moduleId) {
    if (!layout.enabled) {
      layout.enabled = true;
      applyLayout(layout);
    }
    const item = moduleById(moduleId);
    if (!item) return;
    event.preventDefault();
    event.currentTarget.setPointerCapture?.(event.pointerId);
    panelDragState = {
      moduleId,
      currentTargetId: moduleId,
      startX: event.clientX,
      startY: event.clientY
    };
    item.element.classList.add("builder-module-dragging");
    document.body.classList.add("builder-module-drag-active");
  }

  function panelDragMove(event) {
    if (!panelDragState) return;
    const target = closestModuleFromPoint(event.clientX, event.clientY);
    modules.forEach((moduleItem) => moduleItem.element.classList.remove("builder-module-drop-target"));
    if (!target || target.id === panelDragState.moduleId) return;
    target.element.classList.add("builder-module-drop-target");
    panelDragState.currentTargetId = target.id;
  }

  function stopPanelDrag() {
    if (!panelDragState) return;
    const sourceId = panelDragState.moduleId;
    const targetId = panelDragState.currentTargetId;
    const source = moduleById(sourceId);
    modules.forEach((moduleItem) => moduleItem.element.classList.remove("builder-module-drop-target", "builder-module-dragging"));
    document.body.classList.remove("builder-module-drag-active");
    panelDragState = null;
    if (!targetId || targetId === sourceId) return;
    const from = layout.order.indexOf(sourceId);
    const to = layout.order.indexOf(targetId);
    if (from < 0 || to < 0) return;
    layout.order.splice(from, 1);
    layout.order.splice(to, 0, sourceId);
    saveLayout(layout);
    applyLayout(layout);
    flashModule(sourceId);
    showToast(`${source?.label || "Panel"} snapped into place.`);
  }

  function closestModuleFromPoint(x, y) {
    let best = null;
    let bestDistance = Number.POSITIVE_INFINITY;
    modules.forEach((item) => {
      const rect = item.element.getBoundingClientRect();
      const inside = x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom;
      const centerX = rect.left + rect.width / 2;
      const centerY = rect.top + rect.height / 2;
      const distance = Math.hypot(x - centerX, y - centerY);
      if (inside || distance < bestDistance) {
        best = item;
        bestDistance = inside ? 0 : distance;
      }
    });
    return best;
  }

  function startResize(event, moduleId) {
    if (!layout.enabled) {
      layout.enabled = true;
      applyLayout(layout);
    }
    event.preventDefault();
    event.currentTarget.setPointerCapture?.(event.pointerId);
    resizeState = {
      moduleId,
      startX: event.clientX,
      startWidth: layout.widths[moduleId] || moduleById(moduleId)?.defaultWidth || 320
    };
    document.body.style.cursor = "ew-resize";
  }

  function resizeMove(event) {
    if (!resizeState) return;
    const delta = event.clientX - resizeState.startX;
    const isRightEdge = resizeState.moduleId !== "settings";
    const nextWidth = resizeState.startWidth + (isRightEdge ? delta : -delta);
    layout.widths[resizeState.moduleId] = resizeState.moduleId === "canvas" ? clamp(nextWidth, 360, 1200) : clamp(nextWidth, 220, 560);
    applyLayout(layout);
  }

  function stopResize() {
    if (!resizeState) return;
    saveLayout(layout);
    showToast("Panel size saved.");
    resizeState = null;
    document.body.style.cursor = "";
  }

  setupModules();
  setupToolbar();
  setupEvents();
  applyLayout(layout);
})();

(() => {
  const storageKey = "switchboard-button-design";
  const defaults = {
    radius: 8,
    width: 0,
    height: 38,
    textSize: 14,
    textStyle: "normal",
    animation: "subtle",
    background: "",
    text: "",
    border: "",
    hoverBackground: "",
    hoverText: "",
    clickBackground: ""
  };

  const fields = [...document.querySelectorAll("[data-button-style-field]")];
  const saveButton = document.getElementById("saveButtonStyle");
  const resetButton = document.getElementById("resetButtonStyle");
  const previewButton = document.getElementById("buttonStylePreview");
  const summary = document.getElementById("buttonStyleSummary");
  const previewActions = document.getElementById("buttonStylePreviewActions");
  let pendingStyle = null;

  function readStoredStyle() {
    try {
      const parsed = JSON.parse(localStorage.getItem(storageKey) || "{}");
      return normalizeStyle(parsed);
    } catch (error) {
      return { ...defaults };
    }
  }

  function saveStoredStyle(style) {
    try {
      localStorage.setItem(storageKey, JSON.stringify(normalizeStyle(style)));
    } catch (error) {}
  }

  function normalizeStyle(style = {}) {
    return {
      radius: clampNumber(style.radius, 0, 32, defaults.radius),
      width: clampNumber(style.width, 0, 220, defaults.width),
      height: clampNumber(style.height, 32, 72, defaults.height),
      textSize: clampNumber(style.textSize, 12, 22, defaults.textSize),
      textStyle: ["normal", "bold", "heavy", "uppercase"].includes(style.textStyle) ? style.textStyle : defaults.textStyle,
      animation: ["subtle", "lift", "press", "none"].includes(style.animation) ? style.animation : defaults.animation,
      background: safeColor(style.background),
      text: safeColor(style.text),
      border: safeColor(style.border),
      hoverBackground: safeColor(style.hoverBackground),
      hoverText: safeColor(style.hoverText),
      clickBackground: safeColor(style.clickBackground)
    };
  }

  function clampNumber(value, min, max, fallback) {
    const number = Number(value);
    if (!Number.isFinite(number)) return fallback;
    return Math.min(max, Math.max(min, number));
  }

  function safeColor(value) {
    const color = String(value || "").trim();
    return /^#[0-9a-f]{6}$/i.test(color) ? color : "";
  }

  function getThemeDefaults() {
    const styles = getComputedStyle(document.documentElement);
    return {
      background: styles.getPropertyValue("--panel-soft").trim() || "#f2f2ee",
      text: styles.getPropertyValue("--text").trim() || "#202123",
      border: styles.getPropertyValue("--line").trim() || "rgba(32, 33, 35, 0.12)",
      hoverBackground: styles.getPropertyValue("--sidebar-card").trim() || "rgba(32, 33, 35, 0.06)",
      clickBackground: styles.getPropertyValue("--composer-border").trim() || "rgba(32, 33, 35, 0.14)"
    };
  }

  function applyButtonStyle(style, { previewOnly = false } = {}) {
    const normalized = normalizeStyle(style);
    const theme = getThemeDefaults();
    const root = document.documentElement;
    root.style.setProperty("--global-button-radius", `${normalized.radius}px`);
    root.style.setProperty("--global-button-width", normalized.width ? `${normalized.width}px` : "auto");
    root.style.setProperty("--global-button-height", `${normalized.height}px`);
    root.style.setProperty("--global-button-text-size", `${normalized.textSize}px`);
    root.style.setProperty("--global-button-weight", normalized.textStyle === "heavy" ? "900" : normalized.textStyle === "bold" || normalized.textStyle === "uppercase" ? "800" : "750");
    root.style.setProperty("--global-button-transform", normalized.textStyle === "uppercase" ? "uppercase" : "none");
    root.style.setProperty("--global-button-bg", normalized.background || theme.background);
    root.style.setProperty("--global-button-text", normalized.text || theme.text);
    root.style.setProperty("--global-button-border", normalized.border || theme.border);
    root.style.setProperty("--global-button-hover-bg", normalized.hoverBackground || theme.hoverBackground);
    root.style.setProperty("--global-button-hover-text", normalized.hoverText || normalized.text || theme.text);
    root.style.setProperty("--global-button-click-bg", normalized.clickBackground || theme.clickBackground);
    root.dataset.buttonAnimation = normalized.animation;
    ensureGlobalStyleElement();
    updateLiveButtons(normalized);
    if (previewOnly && summary) summary.textContent = "Previewing unsaved global button design.";
  }

  function ensureGlobalStyleElement() {
    if (document.getElementById("globalButtonDesignStyles")) return;
    const style = document.createElement("style");
    style.id = "globalButtonDesignStyles";
    style.textContent = `
      button:not(.profile-settings):not(.composer-tool):not(.send-button):not(.remove-attachment),
      .secondary-action,
      .primary-action {
        min-width: var(--global-button-width, auto);
        min-height: var(--global-button-height, 38px);
        border-radius: var(--global-button-radius, var(--radius));
        font-size: var(--global-button-text-size, inherit);
        font-weight: var(--global-button-weight, 800);
        text-transform: var(--global-button-transform, none);
      }
      .admin-panel button:not(.profile-settings):not(.profile-logout),
      .secondary-action {
        border-color: var(--global-button-border, var(--line));
        background: var(--global-button-bg, var(--panel-soft));
        color: var(--global-button-text, var(--text));
      }
      .admin-panel button:not(.profile-settings):not(.profile-logout):hover:not(:disabled),
      .secondary-action:hover,
      .secondary-action:focus-visible {
        background: var(--global-button-hover-bg, var(--sidebar-card));
        color: var(--global-button-hover-text, var(--text));
      }
      .admin-panel button:not(.profile-settings):not(.profile-logout):active:not(:disabled),
      .secondary-action:active,
      .primary-action:active { background: var(--global-button-click-bg, var(--composer-border)); }
      [data-button-animation="lift"] button:not(:disabled):hover,
      [data-button-animation="lift"] .secondary-action:hover,
      [data-button-animation="lift"] .primary-action:hover { transform: translateY(-2px); }
      [data-button-animation="press"] button:not(:disabled):active,
      [data-button-animation="press"] .secondary-action:active,
      [data-button-animation="press"] .primary-action:active { transform: translateY(2px) scale(0.99); }
      [data-button-animation="none"] button,
      [data-button-animation="none"] .secondary-action,
      [data-button-animation="none"] .primary-action { transition: none !important; transform: none !important; }
      .button-style-live-view { display: grid; gap: 10px; min-width: 0; padding: 12px; border: 1px solid var(--line); border-radius: var(--radius); background: var(--panel-soft); }
      .button-style-live-view strong { color: var(--text); font-size: 0.82rem; }
      .button-style-live-stage { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; }
      .button-style-live-stage button { min-width: var(--global-button-width, auto); min-height: var(--global-button-height, 38px); border: 1px solid var(--global-button-border, var(--line)); border-radius: var(--global-button-radius, var(--radius)); background: var(--global-button-bg, var(--panel-soft)); color: var(--global-button-text, var(--text)); font-size: var(--global-button-text-size, inherit); font-weight: var(--global-button-weight, 800); text-transform: var(--global-button-transform, none); }
      .button-style-live-stage .live-hover { background: var(--global-button-hover-bg, var(--sidebar-card)); color: var(--global-button-hover-text, var(--text)); }
      .button-style-live-stage .live-click { background: var(--global-button-click-bg, var(--composer-border)); }
      .button-design-modal-backdrop { position: fixed; inset: 0; z-index: 120; display: grid; place-items: center; padding: 18px; background: rgba(0, 0, 0, 0.48); }
      .button-design-modal { width: min(440px, 100%); display: grid; gap: 14px; padding: 18px; border: 1px solid var(--line); border-radius: var(--radius); background: var(--panel); color: var(--text); box-shadow: 0 24px 70px rgba(0, 0, 0, 0.35); }
      .button-design-modal h2 { margin: 0; font-size: 1.05rem; line-height: 1.25; }
      .button-design-modal p { margin: 0; color: var(--muted); line-height: 1.5; }
      .button-design-modal-actions { display: flex; justify-content: flex-end; gap: 8px; }
      .button-design-modal-actions button { min-width: 88px; }
      .button-design-modal-actions .confirm { border-color: var(--primary) !important; background: var(--primary) !important; color: #fff !important; }
    `;
    document.head.appendChild(style);
  }

  function styleFromFields() {
    const style = { ...defaults };
    for (const field of fields) {
      const key = field.dataset.buttonStyleField;
      if (!key) continue;
      style[key] = field.type === "number" || field.type === "range" ? Number(field.value) : field.value;
    }
    return normalizeStyle(style);
  }

  function populateFields(style) {
    const normalized = normalizeStyle(style);
    for (const field of fields) {
      const key = field.dataset.buttonStyleField;
      if (!key || normalized[key] === undefined) continue;
      if (field.type === "color") field.value = normalized[key] || "#202123";
      else field.value = normalized[key];
    }
  }

  function ensureLiveView() {
    if (!previewActions || document.getElementById("buttonStyleLiveView")) return;
    const liveView = document.createElement("div");
    liveView.className = "button-style-live-view";
    liveView.id = "buttonStyleLiveView";
    liveView.innerHTML = `
      <strong>Live button view</strong>
      <div class="button-style-live-stage" aria-label="Live button design preview">
        <button type="button" class="live-default">Default</button>
        <button type="button" class="live-hover">Hover</button>
        <button type="button" class="live-click">Click</button>
      </div>
    `;
    previewActions.parentElement?.insertBefore(liveView, previewActions);
  }

  function updateLiveButtons(style) {
    const normalized = normalizeStyle(style);
    const liveButtons = document.querySelectorAll(".button-style-live-stage button");
    liveButtons.forEach((button) => {
      button.style.borderRadius = `${normalized.radius}px`;
      button.style.minWidth = normalized.width ? `${normalized.width}px` : "auto";
      button.style.minHeight = `${normalized.height}px`;
      button.style.fontSize = `${normalized.textSize}px`;
      button.style.fontWeight = normalized.textStyle === "heavy" ? "900" : normalized.textStyle === "normal" ? "750" : "800";
      button.style.textTransform = normalized.textStyle === "uppercase" ? "uppercase" : "none";
    });
    if (previewButton) previewButton.textContent = "Button preview";
  }

  function openConfirmModal() {
    closeConfirmModal();
    const modal = document.createElement("div");
    modal.className = "button-design-modal-backdrop";
    modal.id = "buttonDesignConfirmModal";
    modal.innerHTML = `
      <section class="button-design-modal" role="dialog" aria-modal="true" aria-labelledby="buttonDesignConfirmTitle">
        <h2 id="buttonDesignConfirmTitle">Are you sure you want to make the change?</h2>
        <p>This change will affect all the buttons globally in your application.</p>
        <div class="button-design-modal-actions">
          <button type="button" data-button-design-cancel>No</button>
          <button type="button" class="confirm" data-button-design-confirm>Yes</button>
        </div>
      </section>
    `;
    document.body.appendChild(modal);
    modal.querySelector("[data-button-design-cancel]")?.addEventListener("click", closeConfirmModal);
    modal.querySelector("[data-button-design-confirm]")?.addEventListener("click", confirmSave);
    modal.addEventListener("click", (event) => {
      if (event.target === modal) closeConfirmModal();
    });
    modal.querySelector("[data-button-design-confirm]")?.focus();
  }

  function closeConfirmModal() {
    document.getElementById("buttonDesignConfirmModal")?.remove();
  }

  function confirmSave() {
    if (!pendingStyle) pendingStyle = styleFromFields();
    saveStoredStyle(pendingStyle);
    applyButtonStyle(pendingStyle);
    if (summary) summary.textContent = "Global button design saved.";
    closeConfirmModal();
  }

  function initSettingsControls() {
    if (!fields.length) return;
    ensureLiveView();
    const storedStyle = readStoredStyle();
    populateFields(storedStyle);
    applyButtonStyle(storedStyle);
    if (saveButton) saveButton.textContent = "Save";
    if (summary) summary.textContent = "Live preview is ready.";
    fields.forEach((field) => field.addEventListener("input", () => applyButtonStyle(styleFromFields(), { previewOnly: true })));
    fields.forEach((field) => field.addEventListener("change", () => applyButtonStyle(styleFromFields(), { previewOnly: true })));
    saveButton?.addEventListener("click", (event) => {
      event.preventDefault();
      pendingStyle = styleFromFields();
      openConfirmModal();
    });
    resetButton?.addEventListener("click", (event) => {
      event.preventDefault();
      pendingStyle = { ...defaults };
      populateFields(defaults);
      saveStoredStyle(defaults);
      applyButtonStyle(defaults);
      if (summary) summary.textContent = "Global button design reset.";
    });
  }

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") closeConfirmModal();
  });

  applyButtonStyle(readStoredStyle());
  initSettingsControls();
})();

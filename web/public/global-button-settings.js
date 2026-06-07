(() => {
  const storageKey = "switchboard-button-style";
  const fields = [
    "radius",
    "width",
    "height",
    "textSize",
    "textStyle",
    "background",
    "text",
    "border",
    "hoverBackground",
    "hoverText",
    "clickBackground",
    "animation"
  ];
  const defaults = {
    radius: 8,
    width: 0,
    height: 38,
    textSize: 16,
    textStyle: "bold",
    background: "",
    text: "",
    border: "",
    hoverBackground: "",
    hoverText: "",
    clickBackground: "",
    animation: "subtle"
  };
  const colorFallbacks = {
    background: "#f2f2ee",
    text: "#202123",
    border: "#d9d9d9",
    hoverBackground: "#ececf1",
    hoverText: "#202123",
    clickBackground: "#10a37f"
  };
  const numberLimits = {
    radius: [0, 32],
    width: [0, 220],
    height: [32, 72],
    textSize: [12, 22]
  };
  const textStyles = new Set(["normal", "bold", "heavy", "uppercase"]);
  const animations = new Set(["none", "subtle", "lift", "press"]);
  let currentStyle = readStoredStyle();
  let draftStyle = { ...currentStyle };

  function clampNumber(value, fallback, min, max) {
    const number = Number(value);
    if (!Number.isFinite(number)) return fallback;
    return Math.min(max, Math.max(min, Math.round(number)));
  }

  function cleanColor(value) {
    const color = String(value || "").trim();
    return /^#[0-9a-f]{6}$/i.test(color) ? color.toLowerCase() : "";
  }

  function normalizeStyle(value = {}) {
    return {
      radius: clampNumber(value.radius, defaults.radius, ...numberLimits.radius),
      width: clampNumber(value.width, defaults.width, ...numberLimits.width),
      height: clampNumber(value.height, defaults.height, ...numberLimits.height),
      textSize: clampNumber(value.textSize, defaults.textSize, ...numberLimits.textSize),
      textStyle: textStyles.has(value.textStyle) ? value.textStyle : defaults.textStyle,
      background: cleanColor(value.background),
      text: cleanColor(value.text),
      border: cleanColor(value.border),
      hoverBackground: cleanColor(value.hoverBackground),
      hoverText: cleanColor(value.hoverText),
      clickBackground: cleanColor(value.clickBackground),
      animation: animations.has(value.animation) ? value.animation : defaults.animation
    };
  }

  function readStoredStyle() {
    try {
      return normalizeStyle(JSON.parse(localStorage.getItem(storageKey) || "{}"));
    } catch (error) {
      return { ...defaults };
    }
  }

  function writeStoredStyle(style) {
    try {
      localStorage.setItem(storageKey, JSON.stringify(style));
    } catch (error) {}
  }

  function sameStyle(left, right) {
    return fields.every((field) => left[field] === right[field]);
  }

  function setScopedVar(target, name, value) {
    if (!target) return;
    if (value === "" || value === null || value === undefined) {
      target.style.removeProperty(name);
      return;
    }
    target.style.setProperty(name, value);
  }

  function setButtonVars(target, style) {
    const normalized = normalizeStyle(style);
    const animation = animationTokens(normalized.animation);
    const text = textStyleTokens(normalized.textStyle);

    setScopedVar(target, "--global-button-radius", `${normalized.radius}px`);
    setScopedVar(target, "--global-button-min-width", normalized.width > 0 ? `${normalized.width}px` : "0px");
    setScopedVar(target, "--global-button-min-height", `${normalized.height}px`);
    setScopedVar(target, "--global-button-padding-x", `${Math.max(10, Math.round(normalized.height * 0.32))}px`);
    setScopedVar(target, "--global-button-font-size", `${normalized.textSize}px`);
    setScopedVar(target, "--global-button-font-weight", text.weight);
    setScopedVar(target, "--global-button-text-transform", text.transform);
    setScopedVar(target, "--global-button-bg", normalized.background);
    setScopedVar(target, "--global-button-text", normalized.text);
    setScopedVar(target, "--global-button-border", normalized.border);
    setScopedVar(target, "--global-button-hover-bg", normalized.hoverBackground);
    setScopedVar(target, "--global-button-hover-text", normalized.hoverText);
    setScopedVar(target, "--global-button-active-bg", normalized.clickBackground);
    setScopedVar(target, "--global-button-transition", animation.transition);
    setScopedVar(target, "--global-button-hover-transform", animation.hoverTransform);
    setScopedVar(target, "--global-button-active-transform", animation.activeTransform);
    setScopedVar(target, "--global-button-hover-shadow", animation.hoverShadow);
  }

  function animationTokens(animation) {
    if (animation === "none") {
      return {
        transition: "none",
        hoverTransform: "none",
        activeTransform: "none",
        hoverShadow: "none"
      };
    }
    if (animation === "lift") {
      return {
        transition: "background 180ms ease, border-color 180ms ease, color 180ms ease, transform 180ms ease, box-shadow 180ms ease",
        hoverTransform: "translateY(-1px)",
        activeTransform: "translateY(1px)",
        hoverShadow: "0 10px 24px rgba(0, 0, 0, 0.18)"
      };
    }
    if (animation === "press") {
      return {
        transition: "background 120ms ease, border-color 120ms ease, color 120ms ease, transform 120ms ease",
        hoverTransform: "none",
        activeTransform: "translateY(2px) scale(0.98)",
        hoverShadow: "none"
      };
    }
    return {
      transition: "background 160ms ease, border-color 160ms ease, color 160ms ease, transform 160ms ease, box-shadow 160ms ease",
      hoverTransform: "none",
      activeTransform: "translateY(1px)",
      hoverShadow: "none"
    };
  }

  function textStyleTokens(textStyle) {
    if (textStyle === "normal") return { weight: "650", transform: "none" };
    if (textStyle === "heavy") return { weight: "900", transform: "none" };
    if (textStyle === "uppercase") return { weight: "850", transform: "uppercase" };
    return { weight: "800", transform: "none" };
  }

  function applyButtonStyle(style = currentStyle) {
    currentStyle = normalizeStyle(style);
    setButtonVars(document.documentElement, currentStyle);
    syncControls(draftStyle);
  }

  function applyPreviewStyle(style = draftStyle) {
    setButtonVars(document.getElementById("buttonStylePreviewActions"), style);
    updateSummary(style);
    updateSaveState();
  }

  function controlFor(field) {
    return document.querySelector(`[data-button-style-field="${field}"]`);
  }

  function updateSummary(style = draftStyle, saved = false) {
    const summary = document.getElementById("buttonStyleSummary");
    if (!summary) return;
    const width = style.width > 0 ? `${style.width}px wide` : "auto width";
    const state = saved || sameStyle(style, currentStyle) ? "Saved" : "Unsaved preview";
    summary.textContent = `${state}: ${style.height}px tall, ${width}, ${style.radius}px corners, ${style.animation} animation`;
  }

  function updateSaveState() {
    const saveButton = document.getElementById("saveButtonStyle");
    if (!saveButton) return;
    const hasChanges = !sameStyle(draftStyle, currentStyle);
    saveButton.disabled = !hasChanges;
    saveButton.textContent = hasChanges ? "Save button design" : "Button design saved";
  }

  function syncControls(style = draftStyle) {
    for (const field of fields) {
      const control = controlFor(field);
      if (!control) continue;
      if (control.type === "color") control.value = style[field] || colorFallbacks[field] || "#10a37f";
      else control.value = style[field];
    }
    updateSummary(style);
    updateSaveState();
  }

  function updateField(field, value) {
    if (!fields.includes(field)) return;
    draftStyle = normalizeStyle({ ...draftStyle, [field]: value });
    syncControls(draftStyle);
    applyPreviewStyle(draftStyle);
  }

  function saveButtonStyle() {
    currentStyle = normalizeStyle(draftStyle);
    writeStoredStyle(currentStyle);
    applyButtonStyle(currentStyle);
    applyPreviewStyle(currentStyle);
    updateSummary(currentStyle, true);
  }

  function resetButtonStyle() {
    draftStyle = { ...defaults };
    syncControls(draftStyle);
    applyPreviewStyle(draftStyle);
  }

  function initControls() {
    const controls = document.querySelectorAll("[data-button-style-field]");
    controls.forEach((control) => {
      const eventName = control.tagName === "SELECT" ? "change" : "input";
      control.addEventListener(eventName, () => updateField(control.dataset.buttonStyleField, control.value));
    });
    document.getElementById("saveButtonStyle")?.addEventListener("click", saveButtonStyle);
    document.getElementById("resetButtonStyle")?.addEventListener("click", resetButtonStyle);
    syncControls(draftStyle);
    applyPreviewStyle(draftStyle);
  }

  applyButtonStyle(currentStyle);
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initControls, { once: true });
  } else {
    initControls();
  }
})();
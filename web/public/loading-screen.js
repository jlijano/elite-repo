(() => {
  const loader = document.getElementById("oligarchyLoadingScreen");
  if (!loader) return;

  const percent = loader.querySelector("[data-loader-percent]");
  const startedAt = performance.now();
  const minimumDuration = 950;
  const storageKey = "switchboard-button-design";
  let progress = 0;
  let loadComplete = document.readyState === "complete";
  let frameId = 0;

  function safeColor(value, fallback) {
    const color = String(value || "").trim();
    return /^#[0-9a-f]{6}$/i.test(color) ? color : fallback;
  }

  function hexToRgb(color) {
    const hex = safeColor(color, "#202123").slice(1);
    return [0, 2, 4].map((index) => parseInt(hex.slice(index, index + 2), 16));
  }

  function luminance(color) {
    const channels = hexToRgb(color).map((value) => {
      const normalized = value / 255;
      return normalized <= 0.03928
        ? normalized / 12.92
        : ((normalized + 0.055) / 1.055) ** 2.4;
    });
    return (0.2126 * channels[0]) + (0.7152 * channels[1]) + (0.0722 * channels[2]);
  }

  function readableTextFor(background) {
    return luminance(background) > 0.48 ? "#202123" : "#ffffff";
  }

  function readStoredPalette() {
    try {
      const style = JSON.parse(localStorage.getItem(storageKey) || "{}");
      const background = safeColor(style.background, "#f2f2ee");
      const text = safeColor(style.text, readableTextFor(background));
      const hoverBackground = safeColor(style.hoverBackground, background);
      const hoverText = safeColor(style.hoverText, text);
      return {
        background,
        text,
        hoverBackground,
        hoverText,
        border: safeColor(style.border, "#d9d9d9"),
        clickBackground: safeColor(style.clickBackground, hoverBackground)
      };
    } catch (error) {
      return {
        background: "#f2f2ee",
        text: "#202123",
        hoverBackground: "#e8e8e3",
        hoverText: "#202123",
        border: "#d9d9d9",
        clickBackground: "#d8d8d2"
      };
    }
  }

  function setRgbVariable(name, color) {
    loader.style.setProperty(name, hexToRgb(color).join(", "));
  }

  function applyStoredPalette() {
    const palette = readStoredPalette();
    loader.style.setProperty("--loader-bg", palette.background);
    loader.style.setProperty("--loader-surface", palette.hoverBackground);
    loader.style.setProperty("--loader-text", palette.text);
    loader.style.setProperty("--loader-muted", palette.hoverText);
    loader.style.setProperty("--loader-border", palette.border);
    loader.style.setProperty("--loader-accent", palette.clickBackground);
    setRgbVariable("--loader-accent-rgb", palette.clickBackground);
    setRgbVariable("--loader-text-rgb", palette.text);
  }

  function setProgress(value) {
    progress = Math.max(progress, Math.min(100, Math.round(value)));
    if (percent) percent.textContent = `${progress}%`;
  }

  function finish() {
    const elapsed = performance.now() - startedAt;
    const delay = Math.max(0, minimumDuration - elapsed);
    window.setTimeout(() => {
      setProgress(100);
      loader.classList.add("is-hiding");
      window.setTimeout(() => loader.remove(), 560);
    }, delay);
  }

  function tick() {
    const target = loadComplete ? 100 : Math.min(94, progress + Math.random() * 9 + 3);
    setProgress(target);
    if (loadComplete && progress >= 100) {
      finish();
      return;
    }
    frameId = window.setTimeout(tick, loadComplete ? 60 : 120);
  }

  applyStoredPalette();

  window.addEventListener("load", () => {
    loadComplete = true;
    window.clearTimeout(frameId);
    tick();
  }, { once: true });

  tick();
})();

const express = require("express");

const originalSend = express.response.send;
const globalButtonScript = '<script src="/button-design-global-v2.js" defer></script>';
const loadingStyleTag = '<link rel="stylesheet" href="/loading-screen.css?v=20260617-palette" />';
const loadingScriptTag = '<script src="/loading-screen.js?v=20260617-palette" defer></script>';
const loadingMarkup = `<div id="oligarchyLoadingScreen" role="status" aria-live="polite" aria-label="Oligarchy Services is loading">
      <div class="oligarchy-loader-frame" aria-hidden="true"></div>
      <div class="oligarchy-loader-kicker">[ Loading palette ]</div>
      <div class="oligarchy-loader-brand" aria-hidden="true">
        <div class="oligarchy-loader-mark">★</div>
        <div class="oligarchy-loader-wordmark">
          <strong>Oligarchy</strong>
          <span>Services</span>
        </div>
      </div>
      <div class="oligarchy-loader-marquee" aria-hidden="true">
        <span>Palette loading</span><span>Interface warming up</span><span>Design system online</span>
        <span>Palette loading</span><span>Interface warming up</span><span>Design system online</span>
      </div>
      <div class="oligarchy-loader-percent"><span data-loader-percent>0%</span></div>
    </div>`;
const heroTypographyScript = `<script>
  (() => {
    function normalizeHeroText(value) {
      return String(value || "").replace(/\s+/g, " ").replace(/\s*\+\s*/g, " + ").trim();
    }

    function removeDuplicateHeroBody(hero, headingText) {
      const body = Array.from(hero.children).find((child) => child.tagName === "DIV");
      if (!body) return;
      if (normalizeHeroText(body.textContent).toLowerCase() === headingText) body.remove();
    }

    function polishHeroTypography() {
      document.querySelectorAll(".builder-public-hero h1").forEach((heading) => {
        const normalized = normalizeHeroText(heading.textContent).toLowerCase();
        const hero = heading.closest(".builder-public-hero");
        if (hero) removeDuplicateHeroBody(hero, normalized);
        if (normalized !== "technology + people") return;
        heading.dataset.heroLineBreak = "technology-people";
        heading.innerHTML = "<span>Technology</span><br><span>+</span><br><span>People</span>";
      });
    }

    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", polishHeroTypography, { once: true });
    else polishHeroTypography();
  })();
</script>`;

function shouldInject(req, body) {
  const path = String(req?.path || req?.originalUrl || "");
  return path.startsWith("/builder/pages/")
    && typeof body === "string"
    && body.includes("<html")
    && !body.includes("button-design-global-v2.js");
}

function injectLoadingScreen(html) {
  if (html.includes("oligarchyLoadingScreen")) return html;
  let output = html.includes("/loading-screen.css")
    ? html
    : html.replace("</head>", `  ${loadingStyleTag}\n</head>`);
  output = output.replace(/<body([^>]*)>/i, (match) => `${match}\n    ${loadingMarkup}`);
  return output.includes("/loading-screen.js")
    ? output
    : output.replace("</body>", `  ${loadingScriptTag}\n</body>`);
}

function injectGlobalDesign(html) {
  const style = `<style>
    :root {
      --builder-layout-spacing: 72px;
      --builder-radius: var(--global-button-radius, 8px);
      --builder-font: Inter, Arial, sans-serif;
    }
    body { font-family: var(--builder-font); }
    .builder-public-section { padding: var(--builder-layout-spacing) max(24px, 8vw); }
    .builder-public-hero h1 {
      max-width: min(12ch, 100%);
      overflow-wrap: normal !important;
      word-break: normal !important;
      hyphens: manual !important;
      line-height: 0.96;
      text-wrap: balance;
    }
    .builder-public-hero h1[data-hero-line-break="technology-people"] span {
      display: inline-block;
      font: inherit;
    }
    .builder-public-hero > div {
      max-width: 48ch;
      font-size: clamp(0.88rem, 1.1vw, 1.05rem);
      line-height: 1.45;
    }
    .builder-public-section a,
    .builder-public-section button {
      border-radius: var(--global-button-radius, var(--builder-radius));
      min-width: var(--global-button-width, auto);
      min-height: var(--global-button-height, 38px);
      background: var(--global-button-bg, #202123);
      color: var(--global-button-text, #fff);
      border-color: var(--global-button-border, transparent);
      font-size: var(--global-button-text-size, inherit);
      font-weight: var(--global-button-weight, 800);
      text-transform: var(--global-button-transform, none);
      transition: transform 160ms ease, background 160ms ease, color 160ms ease;
    }
    .builder-public-section a:hover,
    .builder-public-section button:hover {
      background: var(--global-button-hover-bg, #2f3338);
      color: var(--global-button-hover-text, #fff);
    }
    .builder-public-section a:active,
    .builder-public-section button:active { background: var(--global-button-click-bg, #111); }
  </style>`;
  const withStyle = html.includes("</head>") ? html.replace("</head>", `${style}</head>`) : `${style}${html}`;
  const withLoader = injectLoadingScreen(withStyle);
  const scripts = `  ${heroTypographyScript}\n  ${globalButtonScript}\n`;
  if (withLoader.includes("</body>")) return withLoader.replace("</body>", `${scripts}</body>`);
  return `${withLoader}\n${scripts}`;
}

if (!express.response.__builderPublicDesignPatched) {
  Object.defineProperty(express.response, "__builderPublicDesignPatched", { value: true });
  express.response.send = function patchedBuilderPublicSend(body) {
    return originalSend.call(this, shouldInject(this.req, body) ? injectGlobalDesign(body) : body);
  };
}

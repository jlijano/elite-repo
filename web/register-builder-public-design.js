const express = require("express");

const originalSend = express.response.send;
const globalButtonScript = '<script src="/button-design-global-v2.js" defer></script>';

function shouldInject(req, body) {
  const path = String(req?.path || req?.originalUrl || "");
  return path.startsWith("/builder/pages/")
    && typeof body === "string"
    && body.includes("<html")
    && !body.includes("button-design-global-v2.js");
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
  if (withStyle.includes("</body>")) return withStyle.replace("</body>", `  ${globalButtonScript}\n</body>`);
  return `${withStyle}\n${globalButtonScript}\n`;
}

if (!express.response.__builderPublicDesignPatched) {
  Object.defineProperty(express.response, "__builderPublicDesignPatched", { value: true });
  express.response.send = function patchedBuilderPublicSend(body) {
    return originalSend.call(this, shouldInject(this.req, body) ? injectGlobalDesign(body) : body);
  };
}

const fs = require("fs");
const path = require("path");
const express = require("express");

const originalStatic = express.static;
const loadingStyleTag = '<link rel="stylesheet" href="/loading-screen.css?v=20260617-red-black" />';
const loadingScriptTag = '<script src="/loading-screen.js?v=20260617-red-black" defer></script>';
const loadingMarkup = `<div id="oligarchyLoadingScreen" role="status" aria-live="polite" aria-label="Oligarchy Services is loading">
      <div class="oligarchy-loader-frame" aria-hidden="true"></div>
      <div class="oligarchy-loader-kicker">[ Loading experience ]</div>
      <div class="oligarchy-loader-brand" aria-hidden="true">
        <div class="oligarchy-loader-mark">★</div>
        <div class="oligarchy-loader-wordmark">
          <strong>Oligarchy</strong>
          <span>Services</span>
        </div>
      </div>
      <div class="oligarchy-loader-marquee" aria-hidden="true">
        <span>Red system online</span><span>Motion-first interface</span><span>Secure room loading</span>
        <span>Red system online</span><span>Motion-first interface</span><span>Secure room loading</span>
      </div>
      <div class="oligarchy-loader-percent"><span data-loader-percent>0%</span></div>
    </div>`;
const scriptTags = [
  '<script src="/button-design-global-v2.js" defer></script>',
  '<script src="/admin-independent-builder-nav.js" defer></script>',
  '<script src="/admin-ux-stability.js" defer></script>',
  '<script src="/user-create-modal-reference.js" defer></script>',
  '<script src="/user-modal-shell-structure.js" defer></script>'
];

function requestPath(req) {
  const pathname = new URL(req.originalUrl || req.url || "/", "http://localhost").pathname;
  return pathname === "/" ? "/index.html" : pathname;
}

function htmlFilePath(root, req) {
  const pathname = requestPath(req);
  if (!pathname.endsWith(".html")) return null;
  const decodedPath = decodeURIComponent(pathname);
  const safePath = path.normalize(decodedPath).replace(/^([/\\])+/, "");
  const filePath = path.join(root, safePath);
  const rootPath = path.resolve(root);
  const resolvedPath = path.resolve(filePath);
  if (!resolvedPath.startsWith(rootPath + path.sep)) return null;
  return resolvedPath;
}

function injectLoadingScreen(html, req) {
  if (requestPath(req) !== "/index.html" || html.includes("oligarchyLoadingScreen")) return html;
  let output = html;
  if (!output.includes("/loading-screen.css")) {
    output = output.includes("</head>")
      ? output.replace("</head>", `    ${loadingStyleTag}\n  </head>`)
      : `${loadingStyleTag}\n${output}`;
  }
  output = output.replace(/<body([^>]*)>/i, (match) => `${match}\n    ${loadingMarkup}`);
  if (!output.includes("/loading-screen.js")) {
    output = output.includes("</body>")
      ? output.replace("</body>", `  ${loadingScriptTag}\n  </body>`)
      : `${output}\n${loadingScriptTag}\n`;
  }
  return output;
}

function injectGlobalScripts(html) {
  let output = html;
  for (const tag of scriptTags) {
    const src = tag.match(/src="([^"]+)"/)?.[1] || "";
    if (src && output.includes(src.replace("/", ""))) continue;
    if (output.includes("</body>")) output = output.replace("</body>", `  ${tag}\n  </body>`);
    else output = `${output}\n${tag}\n`;
  }
  return output;
}

express.static = function patchedStatic(root, options) {
  const staticMiddleware = originalStatic.call(this, root, options);
  return function globalStaticMiddleware(req, res, next) {
    if (!["GET", "HEAD"].includes(req.method)) return staticMiddleware(req, res, next);
    const filePath = htmlFilePath(root, req);
    if (!filePath) return staticMiddleware(req, res, next);
    fs.readFile(filePath, "utf8", (error, html) => {
      if (error) return staticMiddleware(req, res, next);
      res.type("html").send(injectGlobalScripts(injectLoadingScreen(html, req)));
    });
  };
};

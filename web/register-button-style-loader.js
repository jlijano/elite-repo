const fs = require("fs");
const path = require("path");
const express = require("express");

const originalStatic = express.static;
const scriptTags = [
  '<script src="/button-design-global-v2.js" defer></script>',
  '<script src="/admin-independent-builder-nav.js" defer></script>',
  '<script src="/admin-ux-stability.js" defer></script>',
  '<script src="/user-create-modal-reference.js" defer></script>'
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
      res.type("html").send(injectGlobalScripts(html));
    });
  };
};
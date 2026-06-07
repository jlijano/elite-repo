const fs = require("fs");
const path = require("path");
const express = require("express");

const originalStatic = express.static;
const scriptTag = '<script src="/button-design-global.js" defer></script>';

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

function injectButtonDesignScript(html) {
  if (html.includes("button-design-global.js")) return html;
  if (html.includes("</body>")) return html.replace("</body>", `  ${scriptTag}\n  </body>`);
  return `${html}\n${scriptTag}\n`;
}

express.static = function patchedStatic(root, options) {
  const staticMiddleware = originalStatic.call(this, root, options);
  return function buttonStyleStaticMiddleware(req, res, next) {
    if (!["GET", "HEAD"].includes(req.method)) return staticMiddleware(req, res, next);
    const filePath = htmlFilePath(root, req);
    if (!filePath) return staticMiddleware(req, res, next);
    fs.readFile(filePath, "utf8", (error, html) => {
      if (error) return staticMiddleware(req, res, next);
      res.type("html").send(injectButtonDesignScript(html));
    });
  };
};

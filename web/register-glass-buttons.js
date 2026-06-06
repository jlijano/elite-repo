const fs = require("fs");
const path = require("path");
const express = require("express");

const originalStatic = express.static;
const glassCssPath = path.join(__dirname, "public", "glass-buttons.css");

function readGlassCss() {
  try {
    return fs.readFileSync(glassCssPath, "utf8");
  } catch (error) {
    return "";
  }
}

express.static = function patchedStatic(root, options) {
  const staticMiddleware = originalStatic.call(this, root, options);

  return function glassButtonStatic(req, res, next) {
    const requestPath = (req.path || req.url.split("?")[0] || "").replace(/^\//, "");
    const shouldAppendGlassCss =
      (req.method === "GET" || req.method === "HEAD") &&
      (requestPath === "style.css" || requestPath === "admin.css");

    if (!shouldAppendGlassCss) return staticMiddleware(req, res, next);

    fs.readFile(path.join(root, requestPath), "utf8", (error, css) => {
      if (error) return staticMiddleware(req, res, next);
      res.type("text/css");
      res.set("Cache-Control", "public, max-age=0, must-revalidate");
      res.send(`${css}\n\n/* Global glass button polish */\n${readGlassCss()}`);
    });
  };
};

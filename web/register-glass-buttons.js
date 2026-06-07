const fs = require("fs");
const path = require("path");
const express = require("express");

const originalStatic = express.static;
const glassCssPath = path.join(__dirname, "public", "glass-buttons.css");
const flatSidebarCssPath = path.join(__dirname, "public", "flat-sidebar.css");
const globalButtonSettingsCssPath = path.join(__dirname, "public", "global-button-settings.css");
const globalButtonSettingsJsPath = path.join(__dirname, "public", "global-button-settings.js");

function readFile(filePath) {
  try {
    return fs.readFileSync(filePath, "utf8");
  } catch (error) {
    return "";
  }
}

function readGlobalPolishCss() {
  return [
    "/* Global glass button polish */",
    readFile(glassCssPath),
    "/* Flat sidebar navigation */",
    readFile(flatSidebarCssPath),
    "/* Global configurable button settings */",
    readFile(globalButtonSettingsCssPath)
  ].join("\n");
}

function readGlobalButtonSettingsScript() {
  const script = readFile(globalButtonSettingsJsPath);
  return script ? `<script>\n${script}\n</script>` : "";
}

express.static = function patchedStatic(root, options) {
  const staticMiddleware = originalStatic.call(this, root, options);

  return function glassButtonStatic(req, res, next) {
    const requestPath = (req.path || req.url.split("?")[0] || "").replace(/^\//, "");
    const isReadRequest = req.method === "GET" || req.method === "HEAD";
    const shouldAppendGlassCss = isReadRequest && (requestPath === "style.css" || requestPath === "admin.css");
    const shouldAppendButtonScript = isReadRequest && requestPath.endsWith(".html");

    if (shouldAppendGlassCss) {
      fs.readFile(path.join(root, requestPath), "utf8", (error, css) => {
        if (error) return staticMiddleware(req, res, next);
        res.type("text/css");
        res.set("Cache-Control", "public, max-age=0, must-revalidate");
        res.send(`${css}\n\n${readGlobalPolishCss()}`);
      });
      return;
    }

    if (shouldAppendButtonScript) {
      fs.readFile(path.join(root, requestPath), "utf8", (error, html) => {
        if (error) return staticMiddleware(req, res, next);
        const script = readGlobalButtonSettingsScript();
        res.type("html");
        res.set("Cache-Control", "public, max-age=0, must-revalidate");
        res.send(script && html.includes("</body>") ? html.replace("</body>", `${script}\n  </body>`) : `${html}\n${script}`);
      });
      return;
    }

    return staticMiddleware(req, res, next);
  };
};
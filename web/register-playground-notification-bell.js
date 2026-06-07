const fs = require("fs");
const path = require("path");
const express = require("express");

const originalStatic = express.static;
const adminScript = '<script src="admin.js"></script>';
const notificationBellScript = '<script src="admin-notification-bell.js?v=20260607-board-bell"></script>';

function enhancePlaygroundHtml(source) {
  if (typeof source !== "string" || source.includes("admin-notification-bell.js")) return source;
  if (source.includes(adminScript)) {
    return source.replace(adminScript, `${adminScript}\n    ${notificationBellScript}`);
  }
  return source.replace("</body>", `    ${notificationBellScript}\n  </body>`);
}

express.static = function patchedStatic(root, options) {
  const staticMiddleware = originalStatic.call(this, root, options);

  return function playgroundNotificationStatic(req, res, next) {
    const requestPath = (req.path || req.url.split("?")[0] || "").replace(/^\//, "");
    const shouldEnhancePlayground =
      (req.method === "GET" || req.method === "HEAD") &&
      requestPath === "playground.html";

    if (!shouldEnhancePlayground) return staticMiddleware(req, res, next);

    fs.readFile(path.join(root, "playground.html"), "utf8", (error, html) => {
      if (error) return staticMiddleware(req, res, next);
      res.type("html");
      res.set("Cache-Control", "public, max-age=0, must-revalidate");
      res.send(enhancePlaygroundHtml(html));
    });
  };
};

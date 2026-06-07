const express = require("express");

const originalSend = express.response.send;
const stylesheetTag = '<link rel="stylesheet" href="/builder-workspace-modules.css">';
const scriptTag = '<script src="/builder-workspace-modules.js" defer></script>';

function shouldInject(req, body) {
  const requestPath = String(req?.path || req?.originalUrl || "").split("?")[0];
  return requestPath === "/builder.html"
    && typeof body === "string"
    && body.includes("builder-workbench")
    && !body.includes("builder-workspace-modules.js");
}

function injectWorkspaceModules(html) {
  const withStyles = html.includes("</head>") && !html.includes("builder-workspace-modules.css")
    ? html.replace("</head>", `  ${stylesheetTag}\n  </head>`)
    : html;
  if (withStyles.includes("</body>")) return withStyles.replace("</body>", `  ${scriptTag}\n  </body>`);
  return `${withStyles}\n${scriptTag}\n`;
}

if (!express.response.__builderWorkspaceModulesPatched) {
  Object.defineProperty(express.response, "__builderWorkspaceModulesPatched", { value: true });
  express.response.send = function patchedBuilderWorkspaceSend(body) {
    return originalSend.call(this, shouldInject(this.req, body) ? injectWorkspaceModules(body) : body);
  };
}

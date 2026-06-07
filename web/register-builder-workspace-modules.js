const express = require("express");

const originalSend = express.response.send;
const stylesheetTag = '<link rel="stylesheet" href="/builder-workspace-modules.css">';
const scriptTag = '<script src="/builder-workspace-modules.js" defer></script>';

function requestPathFor(req) {
  return String(req?.path || req?.originalUrl || "").split("?")[0];
}

function shouldInject(req, body) {
  const requestPath = requestPathFor(req);
  return requestPath === "/builder.html"
    && typeof body === "string"
    && body.includes("builder-workbench")
    && !body.includes("builder-workspace-modules.js");
}

function isAdminHtml(req, body) {
  const requestPath = requestPathFor(req);
  return typeof body === "string"
    && body.includes("admin-shell")
    && body.includes('class="primary-nav"')
    && (requestPath.endsWith(".html") || requestPath === "/");
}

function independentSettingsNav(requestPath) {
  const settingsActive = requestPath === "/settings.html";
  const builderActive = requestPath === "/builder.html";
  return [
    `          <a class="nav-item${settingsActive ? " active" : ""}" href="/settings.html"${settingsActive ? ' aria-current="page"' : ""}><span aria-hidden="true">⚙</span>Settings</a>`,
    `          <a class="nav-item${builderActive ? " active" : ""}" href="/builder.html"${builderActive ? ' aria-current="page"' : ""}><span aria-hidden="true">▣</span>Builder</a>`
  ].join("\n");
}

function normalizeBuilderNavigation(req, html) {
  if (!isAdminHtml(req, html)) return html;

  const requestPath = requestPathFor(req);
  const navPattern = /<nav class="primary-nav" aria-label="Admin navigation">[\s\S]*?<\/nav>/;
  return html.replace(navPattern, (nav) => {
    let nextNav = nav;
    const moduleLinks = independentSettingsNav(requestPath);
    const settingsGroupPattern = /\n          <details class="admin-section-list reports-nav settings-nav" open>[\s\S]*?\n          <\/details>/;
    const reportsSettingsLinkPattern = /\n              <a class="nav-item" href="\/settings\.html"><span aria-hidden="true">⚙<\/span>Settings<\/a>/g;

    if (settingsGroupPattern.test(nextNav)) {
      nextNav = nextNav.replace(settingsGroupPattern, `\n${moduleLinks}`);
    }

    nextNav = nextNav.replace(reportsSettingsLinkPattern, "");

    if (!nextNav.includes('href="/builder.html"')) {
      if (nextNav.includes('          <details class="admin-section-list reports-nav" open>')) {
        nextNav = nextNav.replace(
          '          <details class="admin-section-list reports-nav" open>',
          `${moduleLinks}\n          <details class="admin-section-list reports-nav" open>`
        );
      } else if (nextNav.includes('<a class="nav-item" href="/playground.html"')) {
        nextNav = nextNav.replace(
          /(\n          <a class="nav-item" href="\/playground\.html"><span aria-hidden="true">▦<\/span>Playground<\/a>)/,
          `$1\n${moduleLinks}`
        );
      } else {
        nextNav = nextNav.replace("</nav>", `${moduleLinks}\n        </nav>`);
      }
    }

    return nextNav;
  });
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
    const normalizedBody = normalizeBuilderNavigation(this.req, body);
    return originalSend.call(this, shouldInject(this.req, normalizedBody) ? injectWorkspaceModules(normalizedBody) : normalizedBody);
  };
}
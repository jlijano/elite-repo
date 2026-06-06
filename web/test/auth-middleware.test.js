const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { test } = require("node:test");

const webDir = path.resolve(__dirname, "..");
const serverJs = fs.readFileSync(path.join(webDir, "server.js"), "utf8");
const registerJs = fs.readFileSync(path.join(webDir, "register-user-management.js"), "utf8");
const userManagementJs = fs.readFileSync(path.join(webDir, "user-management.js"), "utf8");

test("server owns the shared admin authorization middleware", () => {
  assert.match(serverJs, /const \{ attachUserManagementRoutes \} = require\("\.\/user-management"\)/);
  assert.match(serverJs, /const userManagementStore = attachUserManagementRoutes\(app,/);
  assert.match(serverJs, /async function requireAdmin\(req, res, next\)/);
  assert.match(serverJs, /userManagementStore\.getSessionUser\(sessionToken\)/);
  assert.match(serverJs, /app\.get\("\/api\/admin\/summary", requireAdmin,/);
  assert.match(serverJs, /app\.get\("\/api\/admin\/chats", requireAdmin,/);
  assert.match(serverJs, /app\.get\("\/api\/admin\/knowledge", requireAdmin,/);
  assert.match(serverJs, /app\.post\("\/api\/admin\/reviews\/run", requireAdmin,/);
});

test("user management preloader is a guarded compatibility fallback", () => {
  assert.doesNotMatch(registerJs, /originalRouteMethods/);
  assert.doesNotMatch(registerJs, /wrapAdminHandler/);
  assert.doesNotMatch(registerJs, /sessionBridgeAdminToken/);
  assert.doesNotMatch(registerJs, /\/api\/profile/);
  assert.doesNotMatch(registerJs, /fetch\(/);
  assert.match(registerJs, /!this\.locals\.userManagementAttached/);
});

test("user management route attachment returns the shared store", () => {
  assert.match(userManagementJs, /function attachUserManagementRoutes/);
  assert.match(userManagementJs, /return store;\s*}\s*\n\nmodule\.exports/);
});

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { test } = require("node:test");

const webDir = path.resolve(__dirname, "..");
const registerJs = fs.readFileSync(path.join(webDir, "register-user-management.js"), "utf8");
const userManagementJs = fs.readFileSync(path.join(webDir, "user-management.js"), "utf8");

test("admin auth bridge validates sessions through the shared user store", () => {
  assert.match(registerJs, /let userManagementStore/);
  assert.match(registerJs, /userManagementStore\.getSessionUser\(token\)/);
  assert.doesNotMatch(registerJs, /\/api\/profile/);
  assert.doesNotMatch(registerJs, /fetch\(/);
});

test("user management route attachment returns the shared store", () => {
  assert.match(userManagementJs, /function attachUserManagementRoutes/);
  assert.match(userManagementJs, /return store;\s*}\s*\n\nmodule\.exports/);
});

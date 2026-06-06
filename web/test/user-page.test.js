const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { test } = require("node:test");

const webDir = path.resolve(__dirname, "..");
const userHtml = fs.readFileSync(path.join(webDir, "public", "user.html"), "utf8");
const adminJs = fs.readFileSync(path.join(webDir, "public", "admin.js"), "utf8");
const adminCss = fs.readFileSync(path.join(webDir, "public", "admin.css"), "utf8");

test("user page exposes account management controls", () => {
  [
    "userSearch",
    "userForm",
    "userName",
    "userEmail",
    "userRole",
    "userStatus",
    "userPassword",
    "userAuditEvents",
    "cancelUserEditButton",
    "manageUsersButton"
  ].forEach((id) => assert.match(userHtml, new RegExp(`id=\"${id}\"`)));

  assert.match(userHtml, /Create user/);
  assert.match(userHtml, /Recent audit events/);
  assert.match(userHtml, /Search users/);
});

test("admin script wires user page to protected backend APIs", () => {
  [
    "/api/admin/users",
    "/api/admin/user-audit-events",
    "data-user-edit",
    "data-user-disable",
    "data-user-reactivate",
    "saveUser",
    "updateUserStatus",
    "renderUserAuditEvents"
  ].forEach((needle) => assert.match(adminJs, new RegExp(needle.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))));
});

test("user management styles cover responsive management layout", () => {
  [
    ".user-management-grid",
    ".management-form",
    ".audit-panel",
    ".user-toolbar",
    ".form-row"
  ].forEach((selector) => assert.match(adminCss, new RegExp(selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))));
});

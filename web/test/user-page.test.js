const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { test } = require("node:test");

const webDir = path.resolve(__dirname, "..");
const userHtml = fs.readFileSync(path.join(webDir, "public", "user.html"), "utf8");
const adminJs = fs.readFileSync(path.join(webDir, "public", "admin.js"), "utf8");
const adminCss = fs.readFileSync(path.join(webDir, "public", "admin.css"), "utf8");
const userPageCss = fs.readFileSync(path.join(webDir, "public", "user-page.css"), "utf8");
const userPageJs = fs.readFileSync(path.join(webDir, "public", "user-page.js"), "utf8");
const packageJson = JSON.parse(fs.readFileSync(path.join(webDir, "package.json"), "utf8"));

test("user page exposes account management controls", () => {
  [
    "userSearch",
    "userForm",
    "userName",
    "userEmail",
    "userRole",
    "userStatus",
    "userPassword",
    "cancelUserEditButton",
    "manageUsersButton"
  ].forEach((id) => assert.match(userHtml, new RegExp(`id=\"${id}\"`)));

  assert.match(userHtml, /Create user/);
  assert.match(userHtml, /Search users/);
  assert.match(userHtml, /href="\/user-audit\.html"[\s\S]*>User audit<\/a>/);
  assert.doesNotMatch(userHtml, /id="userAuditEvents"/);
  assert.doesNotMatch(userHtml, /id="exportUserAuditButton"/);
});

test("user page loads extracted assets and follows password policy markup", () => {
  assert.match(userHtml, /<link rel="stylesheet" href="user-page\.css" \/>/);
  assert.match(userHtml, /<script src="user-page\.js"><\/script>/);
  assert.doesNotMatch(userHtml, /<style>/);
  assert.doesNotMatch(userHtml, /<script>\s*\(\(\) => \{\s*const usersContainer/);
  assert.match(userHtml, /id="userPassword"[\s\S]*minlength="12"/);
  assert.match(packageJson.scripts.check, /node --check public\/user-page\.js/);
});

test("admin script wires user page to protected backend APIs", () => {
  [
    "/api/admin/users",
    "data-user-edit",
    "data-user-disable",
    "data-user-reactivate",
    "saveUser",
    "updateUserStatus"
  ].forEach((needle) => assert.match(adminJs, new RegExp(needle.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))));
});

test("user page script owns modal photo and table behavior", () => {
  [
    "function renderPhotoPreview",
    "function openUserDialog",
    "function closeUserDialog",
    "function applyPhotoFile",
    "function transformUsersToTable",
    "new MutationObserver(transformUsersToTable)",
    "Photo must be 512 KB or smaller.",
    "Choose a PNG, JPG, GIF, or WebP image."
  ].forEach((needle) => assert.match(userPageJs, new RegExp(needle.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))));
});

test("user management styles cover shared and extracted responsive layout", () => {
  [
    ".user-management-grid",
    ".management-form",
    ".user-toolbar",
    ".form-row"
  ].forEach((selector) => assert.match(adminCss, new RegExp(selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))));

  [
    ".users-table-wrap",
    ".modal-backdrop",
    ".photo-drop-zone",
    ".photo-preview",
    "@media (max-width: 520px)"
  ].forEach((selector) => assert.match(userPageCss, new RegExp(selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))));
});

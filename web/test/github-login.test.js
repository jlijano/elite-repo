const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const webDir = path.join(__dirname, "..");
const publicDir = path.join(webDir, "public");
const loginHtml = readFileSync(path.join(publicDir, "login.html"), "utf8");
const loginJs = readFileSync(path.join(publicDir, "login.js"), "utf8");
const githubAuth = readFileSync(path.join(webDir, "register-github-auth.js"), "utf8");
const packageJson = JSON.parse(readFileSync(path.join(webDir, "package.json"), "utf8"));

test("login page includes GitHub login option", () => {
  assert.match(loginHtml, /id="githubLogin"/);
  assert.match(loginHtml, /href="\/api\/auth\/github"/);
  assert.match(loginHtml, />Continue with GitHub<\/a>/);
});

test("login javascript preserves redirect and hides unavailable GitHub auth", () => {
  assert.match(loginJs, /const githubLogin = document\.getElementById\("githubLogin"\)/);
  assert.match(loginJs, /url\.searchParams\.set\("redirect", redirect\)/);
  assert.match(loginJs, /fetch\("\/api\/auth\/github\/status"/);
  assert.match(loginJs, /githubLogin\.hidden = !data\.enabled/);
  assert.match(loginJs, /clearReason\("github-unavailable"\)/);
  assert.match(loginJs, /github-user-missing/);
  assert.match(loginJs, /github-email-missing/);
});

test("GitHub auth preload wires OAuth status start and callback routes", () => {
  assert.match(packageJson.scripts.start, /register-github-auth\.js/);
  assert.match(packageJson.scripts.check, /node --check register-github-auth\.js/);
  assert.match(githubAuth, /app\.get\("\/api\/auth\/github\/status"/);
  assert.match(githubAuth, /res\.json\(\{ enabled: githubConfigured\(\) \}\)/);
  assert.match(githubAuth, /app\.get\("\/api\/auth\/github"/);
  assert.match(githubAuth, /app\.get\("\/api\/auth\/github\/callback"/);
  assert.match(githubAuth, /GITHUB_CLIENT_ID/);
  assert.match(githubAuth, /GITHUB_CLIENT_SECRET/);
  assert.match(githubAuth, /getPrivateUserByEmail/);
  assert.match(githubAuth, /createSession/);
});

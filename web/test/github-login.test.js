const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const webDir = path.join(__dirname, "..");
const publicDir = path.join(webDir, "public");
const loginHtml = readFileSync(path.join(publicDir, "login.html"), "utf8");
const loginJs = readFileSync(path.join(publicDir, "login.js"), "utf8");
const githubAuth = readFileSync(path.join(webDir, "register-github-auth.js"), "utf8");
const googleAuth = readFileSync(path.join(webDir, "register-google-auth.js"), "utf8");
const oauthUser = readFileSync(path.join(webDir, "oauth-user.js"), "utf8");
const packageJson = JSON.parse(readFileSync(path.join(webDir, "package.json"), "utf8"));

test("login page includes provider login options", () => {
  assert.match(loginHtml, /id="googleLogin"/);
  assert.match(loginHtml, /href="\/api\/auth\/google"/);
  assert.match(loginHtml, />Continue with Google<\/a>/);
  assert.match(loginHtml, /id="githubLogin"/);
  assert.match(loginHtml, /href="\/api\/auth\/github"/);
  assert.match(loginHtml, />Continue with GitHub<\/a>/);
});

test("login javascript preserves redirect and hides unavailable provider auth", () => {
  assert.match(loginJs, /providerLinks = \[/);
  assert.match(loginJs, /id: "googleLogin", statusPath: "\/api\/auth\/google\/status"/);
  assert.match(loginJs, /id: "githubLogin", statusPath: "\/api\/auth\/github\/status"/);
  assert.match(loginJs, /url\.searchParams\.set\("redirect", redirect\)/);
  assert.match(loginJs, /provider\.element\.hidden = !data\.enabled/);
  assert.match(loginJs, /reason === "github-unavailable" \|\| reason === "google-unavailable"/);
  assert.match(loginJs, /github-access-denied/);
  assert.match(loginJs, /google-access-denied/);
  assert.doesNotMatch(loginJs, /github-user-missing/);
  assert.doesNotMatch(loginJs, /google-user-missing/);
});

test("provider auth preloads wire OAuth status start and callback routes", () => {
  assert.match(packageJson.scripts.start, /register-github-auth\.js/);
  assert.match(packageJson.scripts.start, /register-google-auth\.js/);
  assert.match(packageJson.scripts.check, /node --check oauth-user\.js/);
  assert.match(packageJson.scripts.check, /node --check register-github-auth\.js/);
  assert.match(packageJson.scripts.check, /node --check register-google-auth\.js/);
  assert.match(githubAuth, /app\.get\("\/api\/auth\/github\/status"/);
  assert.match(githubAuth, /app\.get\("\/api\/auth\/github"/);
  assert.match(githubAuth, /app\.get\("\/api\/auth\/github\/callback"/);
  assert.match(githubAuth, /GITHUB_CLIENT_ID/);
  assert.match(githubAuth, /GITHUB_CLIENT_SECRET/);
  assert.match(googleAuth, /app\.get\("\/api\/auth\/google\/status"/);
  assert.match(googleAuth, /app\.get\("\/api\/auth\/google"/);
  assert.match(googleAuth, /app\.get\("\/api\/auth\/google\/callback"/);
  assert.match(googleAuth, /GOOGLE_CLIENT_ID/);
  assert.match(googleAuth, /GOOGLE_CLIENT_SECRET/);
  assert.match(googleAuth, /openid email profile/);
  assert.match(githubAuth, /getOrCreateOAuthUser/);
  assert.match(googleAuth, /getOrCreateOAuthUser/);
});

test("OAuth helper creates active member users on first verified provider login", () => {
  assert.match(oauthUser, /getPrivateUserByEmail/);
  assert.match(oauthUser, /store\.createUser/);
  assert.match(oauthUser, /role: "member"/);
  assert.match(oauthUser, /status: "active"/);
  assert.match(oauthUser, /passwordHash: null/);
  assert.match(oauthUser, /oauth-self-registration/);
});

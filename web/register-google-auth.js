const crypto = require("crypto");
const express = require("express");

const originalListen = express.application.listen;
const attachedApps = new WeakSet();
const sessionTokenStorageKey = "switchboard-session-token";
const adminTokenStorageKey = "switchboard-admin-token";
const legacyProfileStorageKey = "switchboard-user-profile";
const sessionUserStorageKey = "switchboard-session-user";
const googleStateTtlMs = 1000 * 60 * 10;
const adminPaths = new Set([
  "/chat.html",
  "/knowledge.html",
  "/company.html",
  "/department.html",
  "/group.html",
  "/user.html",
  "/playground.html",
  "/reports.html",
  "/logs.html",
  "/review-runs.html",
  "/system-health.html",
  "/user-audit.html",
  "/settings.html"
]);

function cleanString(value, maxLength = 500) {
  return typeof value === "string" ? value.trim().slice(0, maxLength) : "";
}

function isAdminRole(role) {
  return role === "owner" || role === "admin";
}

function safeRequestedPath(value) {
  const requested = cleanString(value, 1000);
  if (!requested || !requested.startsWith("/") || requested.startsWith("//")) return "";
  try {
    const url = new URL(requested, "https://switchboard.local");
    return `${url.pathname}${url.search}`;
  } catch {
    return "";
  }
}

function redirectTarget(user, requested) {
  const requestedPath = safeRequestedPath(requested);
  const pathname = requestedPath ? new URL(requestedPath, "https://switchboard.local").pathname : "";
  if (requestedPath && (!adminPaths.has(pathname) || isAdminRole(user?.role))) return requestedPath;
  return isAdminRole(user?.role) ? "/user.html" : "/update-profile.html?reason=not-admin";
}

function publicOrigin(req) {
  const configured = cleanString(process.env.PUBLIC_APP_URL, 500).replace(/\/+$/, "");
  if (configured) return configured;
  const proto = cleanString(req.get("x-forwarded-proto"), 40).split(",")[0] || req.protocol || "http";
  return `${proto}://${req.get("host")}`;
}

function callbackUrl(req) {
  return new URL("/api/auth/google/callback", publicOrigin(req)).toString();
}

function stateSecret() {
  return process.env.GOOGLE_OAUTH_STATE_SECRET || process.env.GOOGLE_CLIENT_SECRET || process.env.ADMIN_TOKEN || "switchboard-local-google-oauth-state";
}

function sign(value) {
  return crypto.createHmac("sha256", stateSecret()).update(value).digest("base64url");
}

function createState(redirect) {
  const body = Buffer.from(JSON.stringify({
    nonce: crypto.randomBytes(16).toString("hex"),
    redirect: safeRequestedPath(redirect),
    expiresAt: Date.now() + googleStateTtlMs
  })).toString("base64url");
  return `${body}.${sign(body)}`;
}

function verifyState(state) {
  const [body, signature] = cleanString(state, 2000).split(".");
  if (!body || !signature || sign(body) !== signature) return null;
  try {
    const payload = JSON.parse(Buffer.from(body, "base64url").toString("utf8"));
    if (!payload.expiresAt || Date.now() > payload.expiresAt) return null;
    return { redirect: safeRequestedPath(payload.redirect) };
  } catch {
    return null;
  }
}

function googleConfigured() {
  return Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);
}

async function googleFetchJson(url, options = {}) {
  const response = await fetch(url, {
    ...options,
    headers: {
      Accept: "application/json",
      "User-Agent": "switchboard-agent-web",
      ...(options.headers || {})
    }
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error_description || data.error || "Google request failed.");
  return data;
}

async function exchangeCodeForToken(req, code) {
  const body = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID,
    client_secret: process.env.GOOGLE_CLIENT_SECRET,
    code,
    grant_type: "authorization_code",
    redirect_uri: callbackUrl(req)
  });
  const data = await googleFetchJson("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body
  });
  if (!data.access_token) throw new Error("Google did not return an access token.");
  return data.access_token;
}

async function googleVerifiedEmail(accessToken) {
  const profile = await googleFetchJson("https://openidconnect.googleapis.com/v1/userinfo", {
    headers: { Authorization: `Bearer ${accessToken}` }
  });
  return profile.email_verified === true ? cleanString(profile.email, 160).toLowerCase() : "";
}

function loginRedirect(reason = "google-failed") {
  return `/login.html?reason=${encodeURIComponent(reason)}`;
}

function safeScriptJson(value) {
  return JSON.stringify(value).replace(/[<>&]/g, (char) => ({ "<": "\\u003c", ">": "\\u003e", "&": "\\u0026" }[char]));
}

function sendSessionPage(res, session, user, redirect) {
  const payload = {
    sessionToken: session.token,
    user: { id: user.id, name: user.name, email: user.email, role: user.role },
    redirect
  };
  res.set("Cache-Control", "no-store");
  res.type("html").send(`<!doctype html>
<html lang="en">
<head><meta charset="utf-8"><title>Signing in</title></head>
<body>
<script>
  const payload = ${safeScriptJson(payload)};
  sessionStorage.setItem(${JSON.stringify(sessionTokenStorageKey)}, payload.sessionToken);
  sessionStorage.setItem(${JSON.stringify(sessionUserStorageKey)}, JSON.stringify(payload.user));
  localStorage.removeItem(${JSON.stringify(legacyProfileStorageKey)});
  if (["owner", "admin"].includes(payload.user.role)) {
    sessionStorage.setItem(${JSON.stringify(adminTokenStorageKey)}, payload.sessionToken);
  } else {
    sessionStorage.removeItem(${JSON.stringify(adminTokenStorageKey)});
  }
  window.location.replace(payload.redirect || "/");
</script>
</body>
</html>`);
}

function attachGoogleAuthRoutes(app) {
  if (app.locals.googleAuthAttached) return;
  app.locals.googleAuthAttached = true;

  app.get("/api/auth/google/status", (req, res) => {
    res.json({ enabled: googleConfigured() });
  });

  app.get("/api/auth/google", (req, res) => {
    if (!googleConfigured()) return res.redirect(loginRedirect("google-unavailable"));
    const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
    url.searchParams.set("client_id", process.env.GOOGLE_CLIENT_ID);
    url.searchParams.set("redirect_uri", callbackUrl(req));
    url.searchParams.set("response_type", "code");
    url.searchParams.set("scope", "openid email profile");
    url.searchParams.set("state", createState(req.query.redirect));
    return res.redirect(url.toString());
  });

  app.get("/api/auth/google/callback", async (req, res) => {
    try {
      if (!googleConfigured()) return res.redirect(loginRedirect("google-unavailable"));
      const state = verifyState(req.query.state);
      if (!state) return res.redirect(loginRedirect("google-failed"));
      const code = cleanString(req.query.code, 500);
      if (!code) return res.redirect(loginRedirect("google-failed"));
      const accessToken = await exchangeCodeForToken(req, code);
      const email = await googleVerifiedEmail(accessToken);
      if (!email) return res.redirect(loginRedirect("google-email-missing"));
      const store = app.locals.userManagementStore;
      if (!store) return res.redirect(loginRedirect("google-failed"));
      const user = await store.getPrivateUserByEmail(email);
      if (!user || user.status !== "active") return res.redirect(loginRedirect("google-user-missing"));
      const session = await store.createSession(user.id);
      const updatedUser = await store.updateLastLogin(user.id);
      const publicUser = updatedUser || user;
      await store.writeAudit("user.login", user.id, { source: "google" }, user.id).catch(() => {});
      await store.writeAudit("user.activity", user.id, { source: "google", activity: "login" }, user.id).catch(() => {});
      return sendSessionPage(res, session, publicUser, redirectTarget(publicUser, state.redirect));
    } catch (error) {
      console.error("Google login failed:", error.message);
      return res.redirect(loginRedirect("google-failed"));
    }
  });
}

express.application.listen = function patchedListen(...args) {
  if (!attachedApps.has(this)) {
    attachGoogleAuthRoutes(this);
    attachedApps.add(this);
  }
  return originalListen.apply(this, args);
};

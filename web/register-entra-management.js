const path = require("path");
const crypto = require("crypto");
const express = require("express");
const userManagement = require("./user-management");
const { attachEntraManagementRoutes } = require("./entra-management");
const { attachAccountVerificationRoutes } = require("./account-verification");
const { attachPlaygroundRoutes } = require("./playground-management");

const originalListen = express.application.listen;
const originalAttachUserManagementRoutes = userManagement.attachUserManagementRoutes;
const attachedApps = new WeakSet();
let attachedUserStore = null;

userManagement.attachUserManagementRoutes = function patchedAttachUserManagementRoutes(app, options = {}) {
  const store = originalAttachUserManagementRoutes(app, options);
  attachedUserStore = store;
  if (app?.locals) app.locals.userManagementStore = store;
  return store;
};

function suppliedToken(req, headerName) {
  return req.get(headerName) || req.get("authorization")?.replace(/^Bearer\s+/i, "");
}

function tokenOk(req, res, envName, headerName) {
  if (!process.env[envName]) {
    res.status(403).json({ error: `${envName} is not configured.` });
    return false;
  }
  if (suppliedToken(req, headerName) === process.env[envName]) return true;
  res.status(401).json({ error: `${envName} is required.` });
  return false;
}

function adminTokenOk(req, res) {
  return tokenOk(req, res, "ADMIN_TOKEN", "x-admin-token");
}

const schemaPath = path.join(__dirname, "db", "schema.sql");
const fallbackUserStore = userManagement.createUserManagementStore({
  databaseUrl: process.env.DATABASE_URL,
  databaseSsl: process.env.DATABASE_SSL,
  schemaPath
});

function currentUserStore(req) {
  return attachedUserStore || req?.app?.locals?.userManagementStore || fallbackUserStore;
}

async function requireAdmin(req, res, next) {
  try {
    const sessionToken = req.get("x-session-token");
    const store = currentUserStore(req);
    const session = sessionToken ? await store.getSessionUser(sessionToken) : null;
    if (["owner", "admin"].includes(session?.user?.role)) return next();
    if (adminTokenOk(req, res)) return next();
    return undefined;
  } catch (error) {
    return next(error);
  }
}

express.application.listen = function patchedListen(...args) {
  if (!attachedApps.has(this)) {
    if (!this.locals.accountVerificationAttached) {
      attachAccountVerificationRoutes(this, {
        requireAdmin,
        userStore: this.locals.userManagementStore || attachedUserStore || fallbackUserStore,
        databaseUrl: process.env.DATABASE_URL,
        databaseSsl: process.env.DATABASE_SSL,
        schemaPath,
        publicAppUrl: process.env.PUBLIC_APP_URL,
        emailWebhookUrl: process.env.INVITE_EMAIL_WEBHOOK_URL,
        makeId: () => crypto.randomUUID()
      });
    }
    if (!this.locals.entraManagementAttached) {
      attachEntraManagementRoutes(this, {
        requireAdmin,
        databaseUrl: process.env.DATABASE_URL,
        databaseSsl: process.env.DATABASE_SSL,
        schemaPath,
        makeId: () => crypto.randomUUID(),
        now: () => new Date().toISOString()
      });
    }
    if (!this.locals.playgroundAttached) {
      attachPlaygroundRoutes(this, {
        requireAdmin,
        databaseUrl: process.env.DATABASE_URL,
        databaseSsl: process.env.DATABASE_SSL,
        makeId: () => crypto.randomUUID(),
        now: () => new Date().toISOString()
      });
    }
    attachedApps.add(this);
  }
  return originalListen.apply(this, args);
};

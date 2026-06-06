const path = require("path");
const express = require("express");
const { attachEntraManagementRoutes } = require("./entra-management");
const { createUserManagementStore } = require("./user-management");

const originalListen = express.application.listen;
const attachedApps = new WeakSet();

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
const userStore = createUserManagementStore({
  databaseUrl: process.env.DATABASE_URL,
  databaseSsl: process.env.DATABASE_SSL,
  schemaPath
});

async function requireAdmin(req, res, next) {
  try {
    const sessionToken = req.get("x-session-token");
    const session = sessionToken ? await userStore.getSessionUser(sessionToken) : null;
    if (["owner", "admin"].includes(session?.user?.role)) return next();
    if (adminTokenOk(req, res)) return next();
    return undefined;
  } catch (error) {
    return next(error);
  }
}

express.application.listen = function patchedListen(...args) {
  if (!attachedApps.has(this) && !this.locals.entraManagementAttached) {
    attachEntraManagementRoutes(this, {
      requireAdmin,
      databaseUrl: process.env.DATABASE_URL,
      databaseSsl: process.env.DATABASE_SSL,
      schemaPath,
      makeId: () => require("crypto").randomUUID(),
      now: () => new Date().toISOString()
    });
    attachedApps.add(this);
  }
  return originalListen.apply(this, args);
};

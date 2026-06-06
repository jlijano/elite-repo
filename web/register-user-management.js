const path = require("path");
const express = require("express");
const { attachUserManagementRoutes } = require("./user-management");

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

express.application.listen = function patchedListen(...args) {
  if (!attachedApps.has(this) && !this.locals.userManagementAttached) {
    attachUserManagementRoutes(this, {
      adminTokenOk,
      databaseUrl: process.env.DATABASE_URL,
      databaseSsl: process.env.DATABASE_SSL,
      schemaPath: path.join(__dirname, "db", "schema.sql")
    });
    this.locals.userManagementAttached = true;
    attachedApps.add(this);
  }
  return originalListen.apply(this, args);
};

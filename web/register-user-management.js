const path = require("path");
const express = require("express");
const { attachUserManagementRoutes } = require("./user-management");

const originalListen = express.application.listen;
const originalRouteMethods = {
  get: express.application.get,
  post: express.application.post,
  patch: express.application.patch,
  put: express.application.put,
  delete: express.application.delete
};
const attachedApps = new WeakSet();
const sessionBridgeAdminToken = `session-admin-${Date.now().toString(36)}`;
let wrapAdminRoutes = true;
let userManagementStore;

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

function adminTokenSupplied(req) {
  return Boolean(process.env.ADMIN_TOKEN && suppliedToken(req, "x-admin-token") === process.env.ADMIN_TOKEN);
}

async function sessionAdminOk(req) {
  const token = req.get("x-session-token");
  if (!token || !userManagementStore) return false;
  const session = await userManagementStore.getSessionUser(token);
  return ["owner", "admin"].includes(session?.user?.role);
}

function markLegacyHandlerAuthorized(req) {
  if (!process.env.ADMIN_TOKEN) process.env.ADMIN_TOKEN = sessionBridgeAdminToken;
  req.headers["x-admin-token"] = process.env.ADMIN_TOKEN;
}

function wrapAdminHandler(handler) {
  if (typeof handler !== "function") return handler;
  return async function sessionAwareAdminHandler(req, res, next) {
    try {
      if (adminTokenSupplied(req)) return handler(req, res, next);
      if (await sessionAdminOk(req)) {
        markLegacyHandlerAuthorized(req);
        return handler(req, res, next);
      }
      return tokenOk(req, res, "ADMIN_TOKEN", "x-admin-token");
    } catch (error) {
      return typeof next === "function" ? next(error) : res.status(500).json({ error: "Admin authorization failed." });
    }
  };
}

function shouldWrapAdminRoute(routePath) {
  return wrapAdminRoutes && typeof routePath === "string" && routePath.startsWith("/api/admin/");
}

for (const [method, originalMethod] of Object.entries(originalRouteMethods)) {
  express.application[method] = function patchedRouteMethod(routePath, ...handlers) {
    const routeHandlers = shouldWrapAdminRoute(routePath) ? handlers.map(wrapAdminHandler) : handlers;
    return originalMethod.call(this, routePath, ...routeHandlers);
  };
}

function adminTokenOk(req, res) {
  return tokenOk(req, res, "ADMIN_TOKEN", "x-admin-token");
}

express.application.listen = function patchedListen(...args) {
  if (!attachedApps.has(this)) {
    wrapAdminRoutes = false;
    userManagementStore = attachUserManagementRoutes(this, {
      adminTokenOk,
      databaseUrl: process.env.DATABASE_URL,
      databaseSsl: process.env.DATABASE_SSL,
      schemaPath: path.join(__dirname, "db", "schema.sql")
    });
    wrapAdminRoutes = true;
    attachedApps.add(this);
  }
  return originalListen.apply(this, args);
};

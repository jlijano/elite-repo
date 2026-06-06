const fs = require("fs");
const crypto = require("crypto");
const { Pool } = require("pg");

const allowedRoles = new Set(["owner", "admin", "member", "viewer"]);
const allowedStatuses = new Set(["invited", "active", "disabled"]);

function publicUser(row) {
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    photoUrl: row.photo_url || row.photoUrl || "",
    role: row.role,
    status: row.status,
    passwordUpdatedAt: row.password_updated_at || row.passwordUpdatedAt ? new Date(row.password_updated_at || row.passwordUpdatedAt).toISOString() : null,
    lastLoginAt: row.last_login_at || row.lastLoginAt ? new Date(row.last_login_at || row.lastLoginAt).toISOString() : null,
    createdAt: new Date(row.created_at || row.createdAt).toISOString(),
    updatedAt: new Date(row.updated_at || row.updatedAt).toISOString()
  };
}

function auditRow(row) {
  return {
    id: row.id,
    actorUserId: row.actor_user_id || row.actorUserId || null,
    targetUserId: row.target_user_id || row.targetUserId || null,
    action: row.action,
    details: row.details || {},
    createdAt: new Date(row.created_at || row.createdAt).toISOString()
  };
}

function appError(status, message) {
  const error = new Error(message);
  error.status = status;
  return error;
}

function cleanString(value, maxLength) {
  return typeof value === "string" ? value.trim().slice(0, maxLength) : "";
}

function normalizeEmail(value) {
  return cleanString(value, 160).toLowerCase();
}

function isEmail(value) {
  return /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(value);
}

function cleanPhotoUrl(value) {
  const photo = cleanString(value, 600);
  if (!photo) return "";
  if (!/^https?:\/\//i.test(photo)) throw appError(400, "Profile photo URL must start with http:// or https://.");
  return photo;
}

function cleanRole(value, fallback = "viewer") {
  const role = cleanString(value, 40) || fallback;
  if (!allowedRoles.has(role)) throw appError(400, "Role must be one of owner, admin, member, or viewer.");
  return role;
}

function cleanStatus(value, fallback = "active") {
  const status = cleanString(value, 40) || fallback;
  if (!allowedStatuses.has(status)) throw appError(400, "Status must be one of invited, active, or disabled.");
  return status;
}

function hashPassword(password) {
  const value = typeof password === "string" ? password : "";
  if (!value) return null;
  if (value.length < 8) throw appError(400, "Password must be at least 8 characters.");
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto.scryptSync(value, salt, 64).toString("hex");
  return `scrypt:${salt}:${hash}`;
}

function createUserPayload(body = {}) {
  const name = cleanString(body.name, 120);
  const email = normalizeEmail(body.email);
  if (!name) throw appError(400, "Name is required.");
  if (!email || !isEmail(email)) throw appError(400, "A valid email is required.");
  const passwordHash = hashPassword(body.password);
  return {
    name,
    email,
    photoUrl: cleanPhotoUrl(body.photoUrl || body.photo_url),
    role: cleanRole(body.role),
    status: cleanStatus(body.status),
    passwordHash
  };
}

function updateUserPayload(body = {}) {
  const updates = {};
  if (Object.prototype.hasOwnProperty.call(body, "name")) {
    const name = cleanString(body.name, 120);
    if (!name) throw appError(400, "Name cannot be blank.");
    updates.name = name;
  }
  if (Object.prototype.hasOwnProperty.call(body, "email")) {
    const email = normalizeEmail(body.email);
    if (!email || !isEmail(email)) throw appError(400, "A valid email is required.");
    updates.email = email;
  }
  if (Object.prototype.hasOwnProperty.call(body, "photoUrl") || Object.prototype.hasOwnProperty.call(body, "photo_url")) {
    updates.photoUrl = cleanPhotoUrl(body.photoUrl || body.photo_url);
  }
  if (Object.prototype.hasOwnProperty.call(body, "role")) updates.role = cleanRole(body.role);
  if (Object.prototype.hasOwnProperty.call(body, "status")) updates.status = cleanStatus(body.status);
  if (Object.prototype.hasOwnProperty.call(body, "password")) updates.passwordHash = hashPassword(body.password);
  if (!Object.keys(updates).length) throw appError(400, "At least one user field is required.");
  return updates;
}

function createUserManagementStore(options = {}) {
  const makeId = options.id || crypto.randomUUID;
  const currentTime = options.now || (() => new Date().toISOString());
  if (options.databaseUrl) return createPostgresUserStore({ ...options, makeId });
  return createMemoryUserStore({ makeId, currentTime });
}

function createPostgresUserStore(options) {
  const pool = new Pool({
    connectionString: options.databaseUrl,
    ssl: options.databaseSsl === "true" ? { rejectUnauthorized: false } : undefined
  });
  let initialized;
  const ready = () => (initialized ||= fs.promises.readFile(options.schemaPath, "utf8").then((schema) => pool.query(schema)));

  async function writeAudit(action, targetUserId, details = {}, actorUserId = null) {
    await ready();
    const result = await pool.query(
      "INSERT INTO user_audit_events (id, actor_user_id, target_user_id, action, details) VALUES ($1, $2, $3, $4, $5) RETURNING *",
      [options.makeId(), actorUserId, targetUserId, action, details]
    );
    return auditRow(result.rows[0]);
  }

  return {
    async listUsers() {
      await ready();
      const result = await pool.query("SELECT * FROM users ORDER BY created_at DESC LIMIT 200");
      return result.rows.map(publicUser);
    },
    async getUser(userId) {
      await ready();
      const result = await pool.query("SELECT * FROM users WHERE id = $1", [userId]);
      return result.rows[0] ? publicUser(result.rows[0]) : null;
    },
    async createUser(payload) {
      await ready();
      try {
        const result = await pool.query(
          "INSERT INTO users (id, name, email, photo_url, role, status, password_hash, password_updated_at) VALUES ($1, $2, $3, $4, $5, $6, $7, CASE WHEN $7::text IS NULL THEN NULL ELSE NOW() END) RETURNING *",
          [options.makeId(), payload.name, payload.email, payload.photoUrl || null, payload.role, payload.status, payload.passwordHash]
        );
        const user = publicUser(result.rows[0]);
        await writeAudit("user.created", user.id, { email: user.email, role: user.role, status: user.status, source: "admin-token" });
        return user;
      } catch (error) {
        if (error.code === "23505") throw appError(409, "A user with that email already exists.");
        throw error;
      }
    },
    async updateUser(userId, updates) {
      await ready();
      const existing = await this.getUser(userId);
      if (!existing) return null;
      try {
        const result = await pool.query(
          `UPDATE users SET
            name = COALESCE($2, name),
            email = COALESCE($3, email),
            photo_url = COALESCE($4, photo_url),
            role = COALESCE($5, role),
            status = COALESCE($6, status),
            password_hash = COALESCE($7, password_hash),
            password_updated_at = CASE WHEN $7::text IS NULL THEN password_updated_at ELSE NOW() END,
            updated_at = NOW()
          WHERE id = $1 RETURNING *`,
          [userId, updates.name || null, updates.email || null, Object.prototype.hasOwnProperty.call(updates, "photoUrl") ? updates.photoUrl || null : null, updates.role || null, updates.status || null, updates.passwordHash || null]
        );
        const user = publicUser(result.rows[0]);
        await writeAudit("user.updated", user.id, { fields: Object.keys(updates), source: "admin-token" });
        return user;
      } catch (error) {
        if (error.code === "23505") throw appError(409, "A user with that email already exists.");
        throw error;
      }
    },
    async setUserStatus(userId, status) {
      return this.updateUser(userId, { status });
    },
    async listAuditEvents(targetUserId = "") {
      await ready();
      const result = targetUserId
        ? await pool.query("SELECT * FROM user_audit_events WHERE target_user_id = $1 ORDER BY created_at DESC LIMIT 100", [targetUserId])
        : await pool.query("SELECT * FROM user_audit_events ORDER BY created_at DESC LIMIT 100");
      return result.rows.map(auditRow);
    }
  };
}

function createMemoryUserStore(options) {
  const users = new Map();
  const auditEvents = [];

  function emailExists(email, exceptUserId = "") {
    return [...users.values()].some((user) => user.email === email && user.id !== exceptUserId);
  }

  function writeAudit(action, targetUserId, details = {}, actorUserId = null) {
    const event = { id: options.makeId(), actorUserId, targetUserId, action, details, createdAt: options.currentTime() };
    auditEvents.push(event);
    return auditRow(event);
  }

  return {
    async listUsers() {
      return [...users.values()].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).map(publicUser);
    },
    async getUser(userId) {
      const user = users.get(userId);
      return user ? publicUser(user) : null;
    },
    async createUser(payload) {
      if (emailExists(payload.email)) throw appError(409, "A user with that email already exists.");
      const timestamp = options.currentTime();
      const user = {
        id: options.makeId(),
        name: payload.name,
        email: payload.email,
        photoUrl: payload.photoUrl || "",
        role: payload.role,
        status: payload.status,
        passwordHash: payload.passwordHash,
        passwordUpdatedAt: payload.passwordHash ? timestamp : null,
        lastLoginAt: null,
        createdAt: timestamp,
        updatedAt: timestamp
      };
      users.set(user.id, user);
      writeAudit("user.created", user.id, { email: user.email, role: user.role, status: user.status, source: "admin-token" });
      return publicUser(user);
    },
    async updateUser(userId, updates) {
      const user = users.get(userId);
      if (!user) return null;
      if (updates.email && emailExists(updates.email, userId)) throw appError(409, "A user with that email already exists.");
      const timestamp = options.currentTime();
      Object.assign(user, updates);
      if (updates.passwordHash) user.passwordUpdatedAt = timestamp;
      user.updatedAt = timestamp;
      writeAudit("user.updated", user.id, { fields: Object.keys(updates), source: "admin-token" });
      return publicUser(user);
    },
    async setUserStatus(userId, status) {
      return this.updateUser(userId, { status });
    },
    async listAuditEvents(targetUserId = "") {
      return auditEvents
        .filter((event) => !targetUserId || event.targetUserId === targetUserId)
        .slice(-100)
        .reverse()
        .map(auditRow);
    }
  };
}

function attachUserManagementRoutes(app, options = {}) {
  const store = createUserManagementStore(options);
  const adminTokenOk = options.adminTokenOk;

  function requireAdmin(req, res) {
    return typeof adminTokenOk === "function" ? adminTokenOk(req, res) : false;
  }

  function sendError(res, error, fallback) {
    res.status(error.status || 500).json({ error: error.status ? error.message : fallback });
  }

  app.get("/api/admin/users", async (req, res) => {
    if (!requireAdmin(req, res)) return;
    try { res.json({ users: await store.listUsers() }); }
    catch (error) { sendError(res, error, "Could not load users."); }
  });

  app.post("/api/admin/users", async (req, res) => {
    if (!requireAdmin(req, res)) return;
    try { res.status(201).json({ user: await store.createUser(createUserPayload(req.body || {})) }); }
    catch (error) { sendError(res, error, "Could not create user."); }
  });

  app.get("/api/admin/users/:userId", async (req, res) => {
    if (!requireAdmin(req, res)) return;
    try {
      const user = await store.getUser(req.params.userId);
      user ? res.json({ user }) : res.status(404).json({ error: "User not found." });
    } catch (error) { sendError(res, error, "Could not load user."); }
  });

  app.patch("/api/admin/users/:userId", async (req, res) => {
    if (!requireAdmin(req, res)) return;
    try {
      const user = await store.updateUser(req.params.userId, updateUserPayload(req.body || {}));
      user ? res.json({ user }) : res.status(404).json({ error: "User not found." });
    } catch (error) { sendError(res, error, "Could not update user."); }
  });

  app.post("/api/admin/users/:userId/disable", async (req, res) => {
    if (!requireAdmin(req, res)) return;
    try {
      const user = await store.setUserStatus(req.params.userId, "disabled");
      user ? res.json({ user }) : res.status(404).json({ error: "User not found." });
    } catch (error) { sendError(res, error, "Could not disable user."); }
  });

  app.post("/api/admin/users/:userId/reactivate", async (req, res) => {
    if (!requireAdmin(req, res)) return;
    try {
      const user = await store.setUserStatus(req.params.userId, "active");
      user ? res.json({ user }) : res.status(404).json({ error: "User not found." });
    } catch (error) { sendError(res, error, "Could not reactivate user."); }
  });

  app.get("/api/admin/user-audit-events", async (req, res) => {
    if (!requireAdmin(req, res)) return;
    try { res.json({ events: await store.listAuditEvents(req.query.targetUserId || "") }); }
    catch (error) { sendError(res, error, "Could not load user audit events."); }
  });
}

module.exports = { attachUserManagementRoutes, createUserManagementStore };

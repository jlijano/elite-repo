const fs = require("fs");
const crypto = require("crypto");
const { Pool } = require("pg");

const allowedRoles = new Set(["owner", "admin", "member", "viewer"]);
const allowedStatuses = new Set(["invited", "active", "disabled"]);
const sessionTtlMs = 1000 * 60 * 60 * 12;
const minPasswordLength = 12;
const loginWindowMs = 1000 * 60 * 15;
const maxLoginAttempts = 5;
const maxPhotoUrlLength = 2000;
const maxPhotoDataUrlLength = 750000;
const photoDataUrlPattern = /^data:image\/(?:png|jpe?g|gif|webp);base64,[A-Za-z0-9+/=\s]+$/i;
const loginAttempts = new Map();

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

function privateUser(row) {
  if (!row) return null;
  return {
    ...publicUser(row),
    passwordHash: row.password_hash || row.passwordHash || null
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
  const photo = typeof value === "string" ? value.trim() : "";
  if (!photo) return "";
  if (/^https?:\/\//i.test(photo)) {
    if (photo.length > maxPhotoUrlLength) throw appError(400, "Profile photo URL is too long.");
    return photo;
  }
  if (photoDataUrlPattern.test(photo)) {
    const compactPhoto = photo.replace(/\s/g, "");
    if (compactPhoto.length > maxPhotoDataUrlLength) throw appError(400, "Uploaded profile photo is too large.");
    return compactPhoto;
  }
  throw appError(400, "Profile photo must be an http:// or https:// URL, or an uploaded PNG, JPG, GIF, or WebP image.");
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

function passwordPolicyError(password) {
  if (password.length < minPasswordLength) return `Password must be at least ${minPasswordLength} characters.`;
  if (!/[A-Za-z]/.test(password)) return "Password must include at least one letter.";
  if (new Set(password).size < 4) return "Password must use at least four different characters.";
  return "";
}

function hashPassword(password) {
  const value = typeof password === "string" ? password : "";
  if (!value) return null;
  const policyError = passwordPolicyError(value);
  if (policyError) throw appError(400, policyError);
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto.scryptSync(value, salt, 64).toString("hex");
  return `scrypt:${salt}:${hash}`;
}\nfunction verifyPassword(password, storedHash) {
  const value = typeof password === "string" ? password : "";
  if (!value || !storedHash) return false;
  const [scheme, salt, expectedHash] = String(storedHash).split(":");
  if (scheme !== "scrypt" || !salt || !expectedHash) return false;
  const actual = Buffer.from(crypto.scryptSync(value, salt, 64).toString("hex"), "hex");
  const expected = Buffer.from(expectedHash, "hex");
  return actual.length === expected.length && crypto.timingSafeEqual(actual, expected);
}

function createSessionToken() {
  return crypto.randomBytes(32).toString("hex");
}

function hashSessionToken(token) {
  return crypto.createHash("sha256").update(String(token || "")).digest("hex");
}

function sessionTokenFromRequest(req) {
  return cleanString(req.get("x-session-token"), 200);
}

function clientIp(req) {
  const forwarded = cleanString(req.get("x-forwarded-for"), 120).split(",")[0].trim();
  return forwarded || req.ip || req.socket?.remoteAddress || "unknown";
}

function loginRateLimitKey(req, email) {
  return `${clientIp(req)}:${email}`;
}

function loginRateLimitStatus(req, email) {
  const key = loginRateLimitKey(req, email);
  const nowMs = Date.now();
  const attempt = loginAttempts.get(key);
  if (!attempt || attempt.resetAt <= nowMs) return { allowed: true, key, resetAt: nowMs + loginWindowMs };
  if (attempt.count >= maxLoginAttempts) return { allowed: false, key, retryAfterMs: attempt.resetAt - nowMs };
  return { allowed: true, key, resetAt: attempt.resetAt };
}

function recordLoginFailure(req, email) {
  const status = loginRateLimitStatus(req, email);
  const current = loginAttempts.get(status.key);
  loginAttempts.set(status.key, {
    count: current && current.resetAt > Date.now() ? current.count + 1 : 1,
    resetAt: status.resetAt
  });
}

function clearLoginFailures(req, email) {
  loginAttempts.delete(loginRateLimitKey(req, email));
}

function auditFields(updates) {
  return Object.keys(updates)
    .filter((field) => field !== "currentPassword")
    .map((field) => (field === "passwordHash" ? "password" : field));
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

function profileUpdatePayload(body = {}) {
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
  const newPassword = typeof body.newPassword === "string" ? body.newPassword : "";
  if (newPassword) {
    updates.currentPassword = typeof body.currentPassword === "string" ? body.currentPassword : "";
    updates.passwordHash = hashPassword(newPassword);
  }
  if (!Object.keys(updates).length) throw appError(400, "At least one profile field is required.");
  return updates;
}

function createUserManagementStore(options = {}) {
  const makeId = options.id || (() => crypto.randomUUID());
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

  async function applyUserUpdates(userId, updates, source, actorUserId = null) {
    await ready();
    const fields = [];
    const values = [userId];
    const addField = (column, value) => {
      values.push(value);
      fields.push(`${column} = $${values.length}`);
    };
    if (Object.prototype.hasOwnProperty.call(updates, "name")) addField("name", updates.name);
    if (Object.prototype.hasOwnProperty.call(updates, "email")) addField("email", updates.email);
    if (Object.prototype.hasOwnProperty.call(updates, "photoUrl")) addField("photo_url", updates.photoUrl || null);
    if (Object.prototype.hasOwnProperty.call(updates, "role")) addField("role", updates.role);
    if (Object.prototype.hasOwnProperty.call(updates, "status")) addField("status", updates.status);
    if (Object.prototype.hasOwnProperty.call(updates, "passwordHash")) {
      addField("password_hash", updates.passwordHash);
      fields.push("password_updated_at = NOW()");
    }
    fields.push("updated_at = NOW()");
    try {
      const result = await pool.query(`UPDATE users SET ${fields.join(", ")} WHERE id = $1 RETURNING *`, values);
      if (!result.rows[0]) return null;
      const user = publicUser(result.rows[0]);
      await writeAudit(source === "profile" ? "profile.updated" : "user.updated", user.id, { fields: auditFields(updates), source }, actorUserId);
      return user;
    } catch (error) {
      if (error.code === "23505") throw appError(409, "A user with that email already exists.");
      throw error;
    }
  }

  return {
    writeAudit,
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
    async getPrivateUser(userId) {
      await ready();
      const result = await pool.query("SELECT * FROM users WHERE id = $1", [userId]);
      return privateUser(result.rows[0]);
    },
    async getPrivateUserByEmail(email) {
      await ready();
      const result = await pool.query("SELECT * FROM users WHERE LOWER(email) = LOWER($1) LIMIT 1", [email]);
      return privateUser(result.rows[0]);
    },
    async createUser(payload, actorUserId = null) {
      await ready();
      try {
        const result = await pool.query(
          "INSERT INTO users (id, name, email, photo_url, role, status, password_hash, password_updated_at) VALUES ($1, $2, $3, $4, $5, $6, $7, CASE WHEN $7::text IS NULL THEN NULL ELSE NOW() END) RETURNING *",
          [options.makeId(), payload.name, payload.email, payload.photoUrl || null, payload.role, payload.status, payload.passwordHash]
        );
        const user = publicUser(result.rows[0]);
        await writeAudit("user.created", user.id, { email: user.email, role: user.role, status: user.status, source: actorUserId ? "session" : "admin-token" }, actorUserId);
        return user;
      } catch (error) {
        if (error.code === "23505") throw appError(409, "A user with that email already exists.");
        throw error;
      }
    },
    async updateUser(userId, updates, actorUserId = null) {
      return applyUserUpdates(userId, updates, actorUserId ? "session" : "admin-token", actorUserId);
    },
    async updateProfile(userId, updates) {
      const existing = await this.getPrivateUser(userId);
      if (!existing) return null;
      if (updates.passwordHash) {
        if (!updates.currentPassword) throw appError(401, "Current password is required to change your password.");
        if (!verifyPassword(updates.currentPassword, existing.passwordHash)) throw appError(401, "Current password is incorrect.");
      }
      return applyUserUpdates(userId, updates, "profile", userId);
    },
    async setUserStatus(userId, status, actorUserId = null) {
      return this.updateUser(userId, { status }, actorUserId);
    },
    async updateLastLogin(userId) {
      await ready();
      const result = await pool.query("UPDATE users SET last_login_at = NOW(), updated_at = NOW() WHERE id = $1 RETURNING *", [userId]);
      return result.rows[0] ? publicUser(result.rows[0]) : null;
    },
    async createSession(userId) {
      await ready();
      const token = createSessionToken();
      const expiresAt = new Date(Date.now() + sessionTtlMs).toISOString();
      await pool.query(
        "INSERT INTO user_sessions (id, user_id, token_hash, expires_at) VALUES ($1, $2, $3, $4)",
        [options.makeId(), userId, hashSessionToken(token), expiresAt]
      );
      return { token, expiresAt };
    },
    async getSessionUser(token) {
      await ready();
      if (!token) return null;
      const result = await pool.query(
        `SELECT u.*, s.expires_at AS session_expires_at
         FROM user_sessions s
         JOIN users u ON u.id = s.user_id
         WHERE s.token_hash = $1 AND s.revoked_at IS NULL AND s.expires_at > NOW()
         LIMIT 1`,
        [hashSessionToken(token)]
      );
      if (!result.rows[0] || result.rows[0].status !== "active") return null;
      return { user: publicUser(result.rows[0]), expiresAt: new Date(result.rows[0].session_expires_at).toISOString() };
    },
    async revokeSession(token) {
      await ready();
      if (!token) return;
      await pool.query("UPDATE user_sessions SET revoked_at = NOW() WHERE token_hash = $1", [hashSessionToken(token)]);
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
  const sessions = new Map();
  const auditEvents = [];

  function emailExists(email, exceptUserId = "") {
    return [...users.values()].some((user) => user.email === email && user.id !== exceptUserId);
  }

  function writeAudit(action, targetUserId, details = {}, actorUserId = null) {
    const event = { id: options.makeId(), actorUserId, targetUserId, action, details, createdAt: options.currentTime() };
    auditEvents.push(event);
    return auditRow(event);
  }

  function applyUserUpdates(userId, updates, source, actorUserId = null) {
    const user = users.get(userId);
    if (!user) return null;
    if (updates.email && emailExists(updates.email, userId)) throw appError(409, "A user with that email already exists.");
    const timestamp = options.currentTime();
    Object.assign(user, updates);
    if (updates.passwordHash) user.passwordUpdatedAt = timestamp;
    delete user.currentPassword;
    user.updatedAt = timestamp;
    writeAudit(source === "profile" ? "profile.updated" : "user.updated", user.id, { fields: auditFields(updates), source }, actorUserId);
    return publicUser(user);
  }

  return {
    async writeAudit(action, targetUserId, details = {}, actorUserId = null) {
      return writeAudit(action, targetUserId, details, actorUserId);
    },
    async listUsers() {
      return [...users.values()].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).map(publicUser);
    },
    async getUser(userId) {
      const user = users.get(userId);
      return user ? publicUser(user) : null;
    },
    async getPrivateUser(userId) {
      return privateUser(users.get(userId));
    },
    async getPrivateUserByEmail(email) {
      return privateUser([...users.values()].find((user) => user.email === email));
    },
    async createUser(payload, actorUserId = null) {
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
      writeAudit("user.created", user.id, { email: user.email, role: user.role, status: user.status, source: actorUserId ? "session" : "admin-token" }, actorUserId);
      return publicUser(user);
    },
    async updateUser(userId, updates, actorUserId = null) {
      return applyUserUpdates(userId, updates, actorUserId ? "session" : "admin-token", actorUserId);
    },
    async updateProfile(userId, updates) {
      const existing = users.get(userId);
      if (!existing) return null;
      if (updates.passwordHash) {
        if (!updates.currentPassword) throw appError(401, "Current password is required to change your password.");
        if (!verifyPassword(updates.currentPassword, existing.passwordHash)) throw appError(401, "Current password is incorrect.");
      }
      return applyUserUpdates(userId, updates, "profile", userId);
    },
    async setUserStatus(userId, status, actorUserId = null) {
      return this.updateUser(userId, { status }, actorUserId);
    },
    async updateLastLogin(userId) {
      const user = users.get(userId);
      if (!user) return null;
      const timestamp = options.currentTime();
      user.lastLoginAt = timestamp;
      user.updatedAt = timestamp;
      return publicUser(user);
    },
    async createSession(userId) {
      const token = createSessionToken();
      const expiresAt = new Date(Date.now() + sessionTtlMs).toISOString();
      sessions.set(hashSessionToken(token), { id: options.makeId(), userId, createdAt: options.currentTime(), expiresAt, revokedAt: null });
      return { token, expiresAt };
    },
    async getSessionUser(token) {
      if (!token) return null;
      const session = sessions.get(hashSessionToken(token));
      if (!session || session.revokedAt || new Date(session.expiresAt).getTime() <= Date.now()) return null;
      const user = users.get(session.userId);
      if (!user || user.status !== "active") return null;
      return { user: publicUser(user), expiresAt: session.expiresAt };
    },
    async revokeSession(token) {
      if (!token) return;
      const session = sessions.get(hashSessionToken(token));
      if (session) session.revokedAt = options.currentTime();
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

  async function getSession(req) {
    return store.getSessionUser(sessionTokenFromRequest(req));
  }

  async function requireSession(req, res) {
    const session = await getSession(req);
    if (!session) {
      res.status(401).json({ error: "Login required." });
      return null;
    }
    return session;
  }

  async function requireAdmin(req, res) {
    const session = await getSession(req);
    if (session && ["owner", "admin"].includes(session.user.role)) return session;
    if (typeof adminTokenOk === "function" && adminTokenOk(req, res)) return { user: null, expiresAt: null };
    if (!res.headersSent) res.status(403).json({ error: "Admin session required." });
    return null;
  }

  function sendError(res, error, fallback) {
    res.status(error.status || 500).json({ error: error.status ? error.message : fallback });
  }

  app.post("/api/auth/login", async (req, res) => {
    try {
      const email = normalizeEmail(req.body?.email);
      const password = typeof req.body?.password === "string" ? req.body.password : "";
      if (!email || !password) throw appError(400, "Email and password are required.");
      const rateLimit = loginRateLimitStatus(req, email);
      if (!rateLimit.allowed) {
        res.set("Retry-After", String(Math.ceil(rateLimit.retryAfterMs / 1000)));
        throw appError(429, "Too many login attempts. Try again later.");
      }
      const user = await store.getPrivateUserByEmail(email);
      if (!user || user.status !== "active" || !verifyPassword(password, user.passwordHash)) {
        recordLoginFailure(req, email);
        throw appError(401, "Invalid email or password.");
      }
      clearLoginFailures(req, email);
      const session = await store.createSession(user.id);
      const updatedUser = await store.updateLastLogin(user.id);
      const publicLoginUser = updatedUser || publicUser(user);
      await store.writeAudit("user.login", user.id, { source: "session" }, user.id).catch(() => {});
      res.json({ sessionToken: session.token, expiresAt: session.expiresAt, user: publicLoginUser });
    } catch (error) { sendError(res, error, "Could not log in."); }
  });

  app.post("/api/auth/logout", async (req, res) => {
    try {
      const token = sessionTokenFromRequest(req);
      const session = await store.getSessionUser(token);
      await store.revokeSession(token);
      if (session) await store.writeAudit("user.logout", session.user.id, { source: "session" }, session.user.id).catch(() => {});
      res.json({ ok: true });
    } catch (error) { sendError(res, error, "Could not log out."); }
  });

  app.get("/api/profile", async (req, res) => {
    try {
      const session = await requireSession(req, res);
      if (!session) return;
      res.json({ user: session.user, expiresAt: session.expiresAt });
    } catch (error) { sendError(res, error, "Could not load profile."); }
  });

  app.patch("/api/profile", async (req, res) => {
    try {
      const session = await requireSession(req, res);
      if (!session) return;
      const token = sessionTokenFromRequest(req);
      const payload = profileUpdatePayload(req.body || {});
      const passwordChanged = Boolean(payload.passwordHash);
      const user = await store.updateProfile(session.user.id, payload);
      if (!user) return res.status(404).json({ error: "User not found." });
      if (passwordChanged) {
        await store.revokeSession(token);
        const rotatedSession = await store.createSession(user.id);
        return res.json({ user, sessionToken: rotatedSession.token, expiresAt: rotatedSession.expiresAt, passwordChanged: true });
      }
      return res.json({ user, expiresAt: session.expiresAt });
    } catch (error) { sendError(res, error, "Could not update profile."); }
  });

  app.get("/api/admin/users", async (req, res) => {
    const actor = await requireAdmin(req, res);
    if (!actor) return;
    try { res.json({ users: await store.listUsers() }); }
    catch (error) { sendError(res, error, "Could not load users."); }
  });

  app.post("/api/admin/users", async (req, res) => {
    const actor = await requireAdmin(req, res);
    if (!actor) return;
    try { res.status(201).json({ user: await store.createUser(createUserPayload(req.body || {}), actor.user?.id || null) }); }
    catch (error) { sendError(res, error, "Could not create user."); }
  });

  app.get("/api/admin/users/:userId", async (req, res) => {
    const actor = await requireAdmin(req, res);
    if (!actor) return;
    try {
      const user = await store.getUser(req.params.userId);
      user ? res.json({ user }) : res.status(404).json({ error: "User not found." });
    } catch (error) { sendError(res, error, "Could not load user."); }
  });

  app.patch("/api/admin/users/:userId", async (req, res) => {
    const actor = await requireAdmin(req, res);
    if (!actor) return;
    try {
      const user = await store.updateUser(req.params.userId, updateUserPayload(req.body || {}), actor.user?.id || null);
      user ? res.json({ user }) : res.status(404).json({ error: "User not found." });
    } catch (error) { sendError(res, error, "Could not update user."); }
  });

  app.post("/api/admin/users/:userId/disable", async (req, res) => {
    const actor = await requireAdmin(req, res);
    if (!actor) return;
    try {
      const user = await store.setUserStatus(req.params.userId, "disabled", actor.user?.id || null);
      user ? res.json({ user }) : res.status(404).json({ error: "User not found." });
    } catch (error) { sendError(res, error, "Could not disable user."); }
  });

  app.post("/api/admin/users/:userId/reactivate", async (req, res) => {
    const actor = await requireAdmin(req, res);
    if (!actor) return;
    try {
      const user = await store.setUserStatus(req.params.userId, "active", actor.user?.id || null);
      user ? res.json({ user }) : res.status(404).json({ error: "User not found." });
    } catch (error) { sendError(res, error, "Could not reactivate user."); }
  });

  app.get("/api/admin/user-audit-events", async (req, res) => {
    const actor = await requireAdmin(req, res);
    if (!actor) return;
    try { res.json({ events: await store.listAuditEvents(req.query.targetUserId || "") }); }
    catch (error) { sendError(res, error, "Could not load user audit events." ); }
  });

  return store;
}

module.exports = { attachUserManagementRoutes, createUserManagementStore };

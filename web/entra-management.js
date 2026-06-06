const fs = require("fs");
const { Pool } = require("pg");

const allowedStatuses = new Set(["active", "archived"]);

function appError(status, message) {
  const error = new Error(message);
  error.status = status;
  return error;
}

function cleanString(value, maxLength = 160) {
  return typeof value === "string" ? value.trim().slice(0, maxLength) : "";
}

function cleanStatus(value, fallback = "active") {
  const status = cleanString(value, 40) || fallback;
  if (!allowedStatuses.has(status)) throw appError(400, "Status must be active or archived.");
  return status;
}

function cleanPayload(body = {}, type = "record") {
  const name = cleanString(body.name, 140);
  if (!name) throw appError(400, `${type} name is required.`);
  return {
    name,
    description: cleanString(body.description, 600),
    status: cleanStatus(body.status || "active")
  };
}

function companyRow(row) {
  return {
    id: row.id,
    name: row.name,
    description: row.description || "",
    status: row.status || "active",
    createdAt: new Date(row.created_at || row.createdAt).toISOString(),
    updatedAt: new Date(row.updated_at || row.updatedAt).toISOString()
  };
}

function departmentRow(row) {
  return {
    id: row.id,
    companyId: row.company_id || row.companyId,
    companyName: row.company_name || row.companyName || "",
    name: row.name,
    description: row.description || "",
    status: row.status || "active",
    createdAt: new Date(row.created_at || row.createdAt).toISOString(),
    updatedAt: new Date(row.updated_at || row.updatedAt).toISOString()
  };
}

function groupRow(row) {
  return {
    id: row.id,
    companyId: row.company_id || row.companyId,
    companyName: row.company_name || row.companyName || "",
    departmentId: row.department_id || row.departmentId || "",
    departmentName: row.department_name || row.departmentName || "",
    name: row.name,
    description: row.description || "",
    status: row.status || "active",
    createdAt: new Date(row.created_at || row.createdAt).toISOString(),
    updatedAt: new Date(row.updated_at || row.updatedAt).toISOString()
  };
}

function createPostgresStore(options) {
  const pool = new Pool({
    connectionString: options.databaseUrl,
    ssl: options.databaseSsl === "true" ? { rejectUnauthorized: false } : undefined
  });
  let initialized;
  const ready = () => (initialized ||= fs.promises.readFile(options.schemaPath, "utf8").then((schema) => pool.query(schema)));

  async function writeAudit(action, details = {}) {
    await ready();
    await pool.query(
      "INSERT INTO user_audit_events (id, actor_user_id, target_user_id, action, details) VALUES ($1, NULL, NULL, $2, $3)",
      [options.makeId(), action, { ...details, logType: "change", logLabel: "Change log", source: "entra" }]
    ).catch(() => {});
  }

  async function ensureCompany(companyId) {
    const result = await pool.query("SELECT id, name FROM entra_companies WHERE id = $1", [companyId]);
    if (!result.rows[0]) throw appError(404, "Company not found.");
    return result.rows[0];
  }

  async function ensureDepartment(departmentId, companyId = "") {
    if (!departmentId) return null;
    const result = await pool.query("SELECT id, name, company_id FROM entra_departments WHERE id = $1", [departmentId]);
    const department = result.rows[0];
    if (!department) throw appError(404, "Department not found.");
    if (companyId && department.company_id !== companyId) throw appError(400, "Department must belong to the selected company.");
    return department;
  }

  return {
    async listAll() {
      await ready();
      const [companies, departments, groups] = await Promise.all([
        pool.query("SELECT * FROM entra_companies ORDER BY created_at DESC LIMIT 300"),
        pool.query("SELECT d.*, c.name AS company_name FROM entra_departments d JOIN entra_companies c ON c.id = d.company_id ORDER BY d.created_at DESC LIMIT 500"),
        pool.query("SELECT g.*, c.name AS company_name, d.name AS department_name FROM entra_groups g JOIN entra_companies c ON c.id = g.company_id LEFT JOIN entra_departments d ON d.id = g.department_id ORDER BY g.created_at DESC LIMIT 500")
      ]);
      return { companies: companies.rows.map(companyRow), departments: departments.rows.map(departmentRow), groups: groups.rows.map(groupRow) };
    },
    async createCompany(payload) {
      await ready();
      try {
        const result = await pool.query("INSERT INTO entra_companies (id, name, description, status) VALUES ($1, $2, $3, $4) RETURNING *", [options.makeId(), payload.name, payload.description || null, payload.status]);
        const company = companyRow(result.rows[0]);
        await writeAudit("entra.company.created", { companyId: company.id, companyName: company.name });
        return company;
      } catch (error) {
        if (error.code === "23505") throw appError(409, "A company with that name already exists.");
        throw error;
      }
    },
    async updateCompany(companyId, payload) {
      await ready();
      try {
        const result = await pool.query("UPDATE entra_companies SET name = $2, description = $3, status = $4, updated_at = NOW() WHERE id = $1 RETURNING *", [companyId, payload.name, payload.description || null, payload.status]);
        if (!result.rows[0]) return null;
        const company = companyRow(result.rows[0]);
        await writeAudit("entra.company.updated", { companyId: company.id, companyName: company.name });
        return company;
      } catch (error) {
        if (error.code === "23505") throw appError(409, "A company with that name already exists.");
        throw error;
      }
    },
    async setCompanyStatus(companyId, status) {
      await ready();
      const result = await pool.query("UPDATE entra_companies SET status = $2, updated_at = NOW() WHERE id = $1 RETURNING *", [companyId, cleanStatus(status)]);
      if (!result.rows[0]) return null;
      const company = companyRow(result.rows[0]);
      await writeAudit(status === "archived" ? "entra.company.archived" : "entra.company.reactivated", { companyId: company.id, companyName: company.name });
      return company;
    },
    async createDepartment(payload) {
      await ready();
      await ensureCompany(payload.companyId);
      try {
        const result = await pool.query("INSERT INTO entra_departments (id, company_id, name, description, status) VALUES ($1, $2, $3, $4, $5) RETURNING *", [options.makeId(), payload.companyId, payload.name, payload.description || null, payload.status]);
        const department = departmentRow(result.rows[0]);
        await writeAudit("entra.department.created", { departmentId: department.id, departmentName: department.name, companyId: department.companyId });
        return department;
      } catch (error) {
        if (error.code === "23505") throw appError(409, "That department already exists for this company.");
        throw error;
      }
    },
    async updateDepartment(departmentId, payload) {
      await ready();
      await ensureCompany(payload.companyId);
      try {
        const result = await pool.query("UPDATE entra_departments SET company_id = $2, name = $3, description = $4, status = $5, updated_at = NOW() WHERE id = $1 RETURNING *", [departmentId, payload.companyId, payload.name, payload.description || null, payload.status]);
        if (!result.rows[0]) return null;
        const department = departmentRow(result.rows[0]);
        await writeAudit("entra.department.updated", { departmentId: department.id, departmentName: department.name, companyId: department.companyId });
        return department;
      } catch (error) {
        if (error.code === "23505") throw appError(409, "That department already exists for this company.");
        throw error;
      }
    },
    async setDepartmentStatus(departmentId, status) {
      await ready();
      const result = await pool.query("UPDATE entra_departments SET status = $2, updated_at = NOW() WHERE id = $1 RETURNING *", [departmentId, cleanStatus(status)]);
      if (!result.rows[0]) return null;
      const department = departmentRow(result.rows[0]);
      await writeAudit(status === "archived" ? "entra.department.archived" : "entra.department.reactivated", { departmentId: department.id, departmentName: department.name, companyId: department.companyId });
      return department;
    },
    async createGroup(payload) {
      await ready();
      await ensureCompany(payload.companyId);
      await ensureDepartment(payload.departmentId, payload.companyId);
      try {
        const result = await pool.query("INSERT INTO entra_groups (id, company_id, department_id, name, description, status) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *", [options.makeId(), payload.companyId, payload.departmentId || null, payload.name, payload.description || null, payload.status]);
        const group = groupRow(result.rows[0]);
        await writeAudit("entra.group.created", { groupId: group.id, groupName: group.name, companyId: group.companyId, departmentId: group.departmentId || null });
        return group;
      } catch (error) {
        if (error.code === "23505") throw appError(409, "That group already exists for this company and department.");
        throw error;
      }
    },
    async updateGroup(groupId, payload) {
      await ready();
      await ensureCompany(payload.companyId);
      await ensureDepartment(payload.departmentId, payload.companyId);
      try {
        const result = await pool.query("UPDATE entra_groups SET company_id = $2, department_id = $3, name = $4, description = $5, status = $6, updated_at = NOW() WHERE id = $1 RETURNING *", [groupId, payload.companyId, payload.departmentId || null, payload.name, payload.description || null, payload.status]);
        if (!result.rows[0]) return null;
        const group = groupRow(result.rows[0]);
        await writeAudit("entra.group.updated", { groupId: group.id, groupName: group.name, companyId: group.companyId, departmentId: group.departmentId || null });
        return group;
      } catch (error) {
        if (error.code === "23505") throw appError(409, "That group already exists for this company and department.");
        throw error;
      }
    },
    async setGroupStatus(groupId, status) {
      await ready();
      const result = await pool.query("UPDATE entra_groups SET status = $2, updated_at = NOW() WHERE id = $1 RETURNING *", [groupId, cleanStatus(status)]);
      if (!result.rows[0]) return null;
      const group = groupRow(result.rows[0]);
      await writeAudit(status === "archived" ? "entra.group.archived" : "entra.group.reactivated", { groupId: group.id, groupName: group.name, companyId: group.companyId, departmentId: group.departmentId || null });
      return group;
    }
  };
}

function createMemoryStore(options) {
  const companies = new Map();
  const departments = new Map();
  const groups = new Map();
  const currentTime = options.now || (() => new Date().toISOString());

  function withDates(record) {
    const timestamp = currentTime();
    return { ...record, createdAt: timestamp, updatedAt: timestamp };
  }

  function companyName(id) {
    return companies.get(id)?.name || "";
  }

  function departmentName(id) {
    return id ? departments.get(id)?.name || "" : "";
  }

  function ensureCompany(id) {
    if (!id || !companies.has(id)) throw appError(404, "Company not found.");
  }

  function ensureDepartment(id, companyId) {
    if (!id) return;
    const department = departments.get(id);
    if (!department) throw appError(404, "Department not found.");
    if (companyId && department.companyId !== companyId) throw appError(400, "Department must belong to the selected company.");
  }

  function uniqueCompanyName(name, except = "") {
    return [...companies.values()].some((item) => item.id !== except && item.name.toLowerCase() === name.toLowerCase());
  }

  function uniqueDepartmentName(companyId, name, except = "") {
    return [...departments.values()].some((item) => item.id !== except && item.companyId === companyId && item.name.toLowerCase() === name.toLowerCase());
  }

  function uniqueGroupName(companyId, departmentId, name, except = "") {
    return [...groups.values()].some((item) => item.id !== except && item.companyId === companyId && (item.departmentId || "") === (departmentId || "") && item.name.toLowerCase() === name.toLowerCase());
  }

  return {
    async listAll() {
      return {
        companies: [...companies.values()].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).map(companyRow),
        departments: [...departments.values()].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).map((row) => departmentRow({ ...row, companyName: companyName(row.companyId) })),
        groups: [...groups.values()].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).map((row) => groupRow({ ...row, companyName: companyName(row.companyId), departmentName: departmentName(row.departmentId) }))
      };
    },
    async createCompany(payload) {
      if (uniqueCompanyName(payload.name)) throw appError(409, "A company with that name already exists.");
      const company = withDates({ id: options.makeId(), ...payload });
      companies.set(company.id, company);
      return companyRow(company);
    },
    async updateCompany(companyId, payload) {
      const company = companies.get(companyId);
      if (!company) return null;
      if (uniqueCompanyName(payload.name, companyId)) throw appError(409, "A company with that name already exists.");
      Object.assign(company, payload, { updatedAt: currentTime() });
      return companyRow(company);
    },
    async setCompanyStatus(companyId, status) {
      const company = companies.get(companyId);
      if (!company) return null;
      company.status = cleanStatus(status);
      company.updatedAt = currentTime();
      return companyRow(company);
    },
    async createDepartment(payload) {
      ensureCompany(payload.companyId);
      if (uniqueDepartmentName(payload.companyId, payload.name)) throw appError(409, "That department already exists for this company.");
      const department = withDates({ id: options.makeId(), ...payload });
      departments.set(department.id, department);
      return departmentRow({ ...department, companyName: companyName(department.companyId) });
    },
    async updateDepartment(departmentId, payload) {
      const department = departments.get(departmentId);
      if (!department) return null;
      ensureCompany(payload.companyId);
      if (uniqueDepartmentName(payload.companyId, payload.name, departmentId)) throw appError(409, "That department already exists for this company.");
      Object.assign(department, payload, { updatedAt: currentTime() });
      return departmentRow({ ...department, companyName: companyName(department.companyId) });
    },
    async setDepartmentStatus(departmentId, status) {
      const department = departments.get(departmentId);
      if (!department) return null;
      department.status = cleanStatus(status);
      department.updatedAt = currentTime();
      return departmentRow({ ...department, companyName: companyName(department.companyId) });
    },
    async createGroup(payload) {
      ensureCompany(payload.companyId);
      ensureDepartment(payload.departmentId, payload.companyId);
      if (uniqueGroupName(payload.companyId, payload.departmentId, payload.name)) throw appError(409, "That group already exists for this company and department.");
      const group = withDates({ id: options.makeId(), ...payload });
      groups.set(group.id, group);
      return groupRow({ ...group, companyName: companyName(group.companyId), departmentName: departmentName(group.departmentId) });
    },
    async updateGroup(groupId, payload) {
      const group = groups.get(groupId);
      if (!group) return null;
      ensureCompany(payload.companyId);
      ensureDepartment(payload.departmentId, payload.companyId);
      if (uniqueGroupName(payload.companyId, payload.departmentId, payload.name, groupId)) throw appError(409, "That group already exists for this company and department.");
      Object.assign(group, payload, { updatedAt: currentTime() });
      return groupRow({ ...group, companyName: companyName(group.companyId), departmentName: departmentName(group.departmentId) });
    },
    async setGroupStatus(groupId, status) {
      const group = groups.get(groupId);
      if (!group) return null;
      group.status = cleanStatus(status);
      group.updatedAt = currentTime();
      return groupRow({ ...group, companyName: companyName(group.companyId), departmentName: departmentName(group.departmentId) });
    }
  };
}

function createEntraStore(options = {}) {
  if (options.databaseUrl) return createPostgresStore(options);
  return createMemoryStore(options);
}

function attachEntraManagementRoutes(app, options = {}) {
  const requireAdmin = options.requireAdmin;
  if (typeof requireAdmin !== "function") throw new Error("attachEntraManagementRoutes requires requireAdmin middleware.");
  const store = createEntraStore(options);

  function sendError(res, error, fallback) {
    res.status(error.status || 500).json({ error: error.status ? error.message : fallback });
  }

  function departmentPayload(body = {}) {
    return { ...cleanPayload(body, "Department"), companyId: cleanString(body.companyId || body.company_id, 80) };
  }

  function groupPayload(body = {}) {
    return { ...cleanPayload(body, "Group"), companyId: cleanString(body.companyId || body.company_id, 80), departmentId: cleanString(body.departmentId || body.department_id, 80) };
  }

  app.get("/api/admin/entra", requireAdmin, async (req, res) => {
    try { res.json(await store.listAll()); }
    catch (error) { sendError(res, error, "Could not load Entra records."); }
  });

  app.get("/api/admin/entra/companies", requireAdmin, async (req, res) => {
    try { res.json({ companies: (await store.listAll()).companies }); }
    catch (error) { sendError(res, error, "Could not load companies."); }
  });
  app.post("/api/admin/entra/companies", requireAdmin, async (req, res) => {
    try { res.status(201).json({ company: await store.createCompany(cleanPayload(req.body || {}, "Company")) }); }
    catch (error) { sendError(res, error, "Could not create company."); }
  });
  app.patch("/api/admin/entra/companies/:companyId", requireAdmin, async (req, res) => {
    try {
      const company = await store.updateCompany(req.params.companyId, cleanPayload(req.body || {}, "Company"));
      company ? res.json({ company }) : res.status(404).json({ error: "Company not found." });
    } catch (error) { sendError(res, error, "Could not update company."); }
  });
  app.post("/api/admin/entra/companies/:companyId/archive", requireAdmin, async (req, res) => {
    try {
      const company = await store.setCompanyStatus(req.params.companyId, "archived");
      company ? res.json({ company }) : res.status(404).json({ error: "Company not found." });
    } catch (error) { sendError(res, error, "Could not archive company."); }
  });
  app.post("/api/admin/entra/companies/:companyId/reactivate", requireAdmin, async (req, res) => {
    try {
      const company = await store.setCompanyStatus(req.params.companyId, "active");
      company ? res.json({ company }) : res.status(404).json({ error: "Company not found." });
    } catch (error) { sendError(res, error, "Could not reactivate company."); }
  });

  app.get("/api/admin/entra/departments", requireAdmin, async (req, res) => {
    try { res.json({ departments: (await store.listAll()).departments }); }
    catch (error) { sendError(res, error, "Could not load departments."); }
  });
  app.post("/api/admin/entra/departments", requireAdmin, async (req, res) => {
    try { res.status(201).json({ department: await store.createDepartment(departmentPayload(req.body || {})) }); }
    catch (error) { sendError(res, error, "Could not create department."); }
  });
  app.patch("/api/admin/entra/departments/:departmentId", requireAdmin, async (req, res) => {
    try {
      const department = await store.updateDepartment(req.params.departmentId, departmentPayload(req.body || {}));
      department ? res.json({ department }) : res.status(404).json({ error: "Department not found." });
    } catch (error) { sendError(res, error, "Could not update department."); }
  });
  app.post("/api/admin/entra/departments/:departmentId/archive", requireAdmin, async (req, res) => {
    try {
      const department = await store.setDepartmentStatus(req.params.departmentId, "archived");
      department ? res.json({ department }) : res.status(404).json({ error: "Department not found." });
    } catch (error) { sendError(res, error, "Could not archive department."); }
  });
  app.post("/api/admin/entra/departments/:departmentId/reactivate", requireAdmin, async (req, res) => {
    try {
      const department = await store.setDepartmentStatus(req.params.departmentId, "active");
      department ? res.json({ department }) : res.status(404).json({ error: "Department not found." });
    } catch (error) { sendError(res, error, "Could not reactivate department."); }
  });

  app.get("/api/admin/entra/groups", requireAdmin, async (req, res) => {
    try { res.json({ groups: (await store.listAll()).groups }); }
    catch (error) { sendError(res, error, "Could not load groups."); }
  });
  app.post("/api/admin/entra/groups", requireAdmin, async (req, res) => {
    try { res.status(201).json({ group: await store.createGroup(groupPayload(req.body || {})) }); }
    catch (error) { sendError(res, error, "Could not create group."); }
  });
  app.patch("/api/admin/entra/groups/:groupId", requireAdmin, async (req, res) => {
    try {
      const group = await store.updateGroup(req.params.groupId, groupPayload(req.body || {}));
      group ? res.json({ group }) : res.status(404).json({ error: "Group not found." });
    } catch (error) { sendError(res, error, "Could not update group."); }
  });
  app.post("/api/admin/entra/groups/:groupId/archive", requireAdmin, async (req, res) => {
    try {
      const group = await store.setGroupStatus(req.params.groupId, "archived");
      group ? res.json({ group }) : res.status(404).json({ error: "Group not found." });
    } catch (error) { sendError(res, error, "Could not archive group."); }
  });
  app.post("/api/admin/entra/groups/:groupId/reactivate", requireAdmin, async (req, res) => {
    try {
      const group = await store.setGroupStatus(req.params.groupId, "active");
      group ? res.json({ group }) : res.status(404).json({ error: "Group not found." });
    } catch (error) { sendError(res, error, "Could not reactivate group."); }
  });

  app.locals.entraManagementAttached = true;
  return store;
}

module.exports = { attachEntraManagementRoutes, createEntraStore };

(() => {
  if (document.body?.dataset.adminPage !== "user") return;

  const state = { companies: [], departments: [], groups: [] };
  const html = (value) => String(value ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

  function input(id) {
    return document.getElementById(id);
  }

  function ensureDatalist(id) {
    let list = document.getElementById(id);
    if (!list) {
      list = document.createElement("datalist");
      list.id = id;
      document.body.appendChild(list);
    }
    return list;
  }

  function setOptions(id, values) {
    const list = ensureDatalist(id);
    const unique = [...new Set(values.filter(Boolean))].sort((a, b) => a.localeCompare(b));
    list.innerHTML = unique.map((value) => `<option value="${html(value)}"></option>`).join("");
  }

  function selectedCompany() {
    const value = input("userCompany")?.value || "";
    return state.companies.find((company) => company.name.toLowerCase() === value.toLowerCase());
  }

  function selectedDepartment() {
    const company = selectedCompany();
    const value = input("userDepartment")?.value || "";
    return state.departments.find((department) => {
      const matchesName = department.name.toLowerCase() === value.toLowerCase();
      return matchesName && (!company || department.companyId === company.id);
    });
  }

  function refreshSuggestions() {
    const company = selectedCompany();
    const department = selectedDepartment();
    const departments = state.departments.filter((item) => item.status !== "archived" && (!company || item.companyId === company.id));
    const groups = state.groups.filter((item) => {
      if (item.status === "archived") return false;
      if (company && item.companyId !== company.id) return false;
      if (department && item.departmentId && item.departmentId !== department.id) return false;
      return true;
    });
    setOptions("userCompanyOptions", state.companies.filter((item) => item.status !== "archived").map((item) => item.name));
    setOptions("userDepartmentOptions", departments.map((item) => item.name));
    setOptions("userGroupOptions", groups.map((item) => item.name));
  }

  function attachInputs() {
    const company = input("userCompany");
    const department = input("userDepartment");
    const group = input("userGroup");
    if (!company || !department || !group) return false;
    company.setAttribute("list", "userCompanyOptions");
    department.setAttribute("list", "userDepartmentOptions");
    group.setAttribute("list", "userGroupOptions");
    company.addEventListener("input", refreshSuggestions);
    department.addEventListener("input", refreshSuggestions);
    return true;
  }

  async function loadSuggestions() {
    if (!attachInputs()) return;
    try {
      const response = await fetch("/api/admin/entra", { headers: { "Content-Type": "application/json" } });
      if (!response.ok) return;
      const data = await response.json();
      state.companies = data.companies || [];
      state.departments = data.departments || [];
      state.groups = data.groups || [];
      refreshSuggestions();
    } catch (error) {}
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", () => window.setTimeout(loadSuggestions, 0), { once: true });
  else window.setTimeout(loadSuggestions, 0);
})();

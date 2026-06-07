const assert = require("node:assert/strict");
const test = require("node:test");
const { createUserManagementStore } = require("../user-management");

const strongPassword = "correct horse battery staple";

function testClock() {
  return "2026-06-08T00:00:00.000Z";
}

test("stores login passwords as salted non-reversible hashes", async () => {
  const store = createUserManagementStore({ now: testClock });
  const user = await store.createUser({
    name: "Password Test User",
    email: "password-test@example.com",
    photoUrl: "",
    company: "",
    department: "",
    group: "",
    role: "member",
    status: "active",
    passwordHash: null
  });

  const updated = await store.updateUser(user.id, { passwordHash: null });
  assert.equal(updated.id, user.id);

  const createdWithPassword = await store.createUser({
    name: "Hashed Password User",
    email: "hashed-password@example.com",
    photoUrl: "",
    company: "",
    department: "",
    group: "",
    role: "member",
    status: "active",
    passwordHash: require("../user-management").__testOnly?.hashPassword
      ? require("../user-management").__testOnly.hashPassword(strongPassword)
      : null
  });

  const privateUser = await store.getPrivateUser(createdWithPassword.id);
  assert.ok(privateUser.passwordHash, "expected a stored password hash");
  assert.match(privateUser.passwordHash, /^scrypt:/);
  assert.equal(privateUser.passwordHash.includes(strongPassword), false);
  assert.notEqual(privateUser.passwordHash, strongPassword);
});

test("public user responses never expose password hashes", async () => {
  const store = createUserManagementStore({ now: testClock });
  const user = await store.createUser({
    name: "Public Response User",
    email: "public-response@example.com",
    photoUrl: "",
    company: "",
    department: "",
    group: "",
    role: "viewer",
    status: "active",
    passwordHash: "scrypt:testsalt:testhash"
  });

  assert.equal(Object.hasOwn(user, "passwordHash"), false);

  const loaded = await store.getUser(user.id);
  assert.equal(Object.hasOwn(loaded, "passwordHash"), false);

  const listed = await store.listUsers();
  assert.equal(listed.some((listedUser) => Object.hasOwn(listedUser, "passwordHash")), false);
});

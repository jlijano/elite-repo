const assert = require("node:assert/strict");
const test = require("node:test");
const crypto = require("node:crypto");
const { createUserManagementStore } = require("../user-management");

const strongPassword = "correct horse battery staple";

function testClock() {
  return "2026-06-08T00:00:00.000Z";
}

function scryptPasswordHash(password) {
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto.scryptSync(password, salt, 64).toString("hex");
  return `scrypt:${salt}:${hash}`;
}

test("stored login password values are salted non-reversible hashes", async () => {
  const store = createUserManagementStore({ now: testClock });
  const passwordHash = scryptPasswordHash(strongPassword);
  const user = await store.createUser({
    name: "Hashed Password User",
    email: "hashed-password@example.com",
    photoUrl: "",
    company: "",
    department: "",
    group: "",
    role: "member",
    status: "active",
    passwordHash
  });

  const privateUser = await store.getPrivateUser(user.id);
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
    passwordHash: scryptPasswordHash(strongPassword)
  });

  assert.equal(Object.hasOwn(user, "passwordHash"), false);

  const loaded = await store.getUser(user.id);
  assert.equal(Object.hasOwn(loaded, "passwordHash"), false);

  const listed = await store.listUsers();
  assert.equal(listed.some((listedUser) => Object.hasOwn(listedUser, "passwordHash")), false);
});

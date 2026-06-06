function cleanString(value, maxLength = 500) {
  return typeof value === "string" ? value.trim().slice(0, maxLength) : "";
}

function isEmail(value) {
  return /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(value);
}

function fallbackNameFromEmail(email) {
  const localPart = cleanString(String(email || "").split("@")[0], 80);
  const spaced = localPart.replace(/[._-]+/g, " ").replace(/\s+/g, " ").trim();
  return spaced || "OAuth User";
}

function cleanPhotoUrl(value) {
  const photoUrl = cleanString(value, 2000);
  return /^https?:\/\//i.test(photoUrl) ? photoUrl : "";
}

async function getOrCreateOAuthUser(store, profile = {}) {
  const email = cleanString(profile.email, 160).toLowerCase();
  if (!email || !isEmail(email)) return null;

  const existing = await store.getPrivateUserByEmail(email);
  if (existing) return existing.status === "active" ? existing : null;

  const payload = {
    name: cleanString(profile.name, 120) || fallbackNameFromEmail(email),
    email,
    photoUrl: cleanPhotoUrl(profile.photoUrl),
    company: "",
    department: "",
    group: "",
    role: "member",
    status: "active",
    passwordHash: null
  };

  try {
    const user = await store.createUser(payload, null);
    await store.writeAudit("user.activity", user.id, {
      source: profile.source || "oauth",
      activity: "oauth-self-registration",
      email: user.email
    }, user.id).catch(() => {});
    return user;
  } catch (error) {
    if (error.status === 409 || /already exists/i.test(error.message || "")) {
      const user = await store.getPrivateUserByEmail(email);
      return user && user.status === "active" ? user : null;
    }
    throw error;
  }
}

module.exports = { getOrCreateOAuthUser };

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { test } = require("node:test");

const webDir = path.resolve(__dirname, "..");
const publicDir = path.join(webDir, "public");
const schemaSql = fs.readFileSync(path.join(webDir, "db", "schema.sql"), "utf8");
const seedSql = fs.readFileSync(path.join(webDir, "db", "seed-bootstrap-users.sql"), "utf8");

function readPublicFiles(dir = publicDir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) return readPublicFiles(fullPath);
    if (!/\.(html|css|js)$/.test(entry.name)) return [];
    return [[fullPath, fs.readFileSync(fullPath, "utf8")]];
  });
}

test("public HTML CSS and JS files do not contain common mojibake markers", () => {
  const mojibake = /(?:â|Ã|Â|ðŸ|â˜|â†|âŒ|â—|â–|ð)/;
  for (const [filePath, content] of readPublicFiles()) {
    assert.doesNotMatch(content, mojibake, `${path.relative(webDir, filePath)} contains mojibake`);
  }
});

test("bootstrap users are explicit seed data and not automatic schema startup data", () => {
  assert.doesNotMatch(schemaSql, /INSERT\s+INTO\s+users/i);
  assert.match(seedSql, /INSERT\s+INTO\s+users/i);
  assert.match(seedSql, /admin@example\.com/);
  assert.match(seedSql, /site-admin@example\.com/);
  assert.match(seedSql, /Run this file only for an intentional bootstrap or demo setup/);
});

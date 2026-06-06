-- Optional bootstrap/demo users.
-- Run this file only for an intentional bootstrap or demo setup. Do not rely on these
-- accounts as production credentials, and rotate or disable them before production use.

INSERT INTO users (id, name, email, role, status, password_hash, password_updated_at)
SELECT seed.id, seed.name, seed.email, seed.role, 'active', seed.password_hash, NOW()
FROM (
  VALUES
    ('00000000-0000-4000-8000-000000000001'::uuid, 'admin', 'admin@example.com', 'owner', 'scrypt:e20a23cf6eb225c06473fcd731f39ee5:9ed8b8c51c5bdb7011be853fda0da20f7ab0568397199a6776375e161158edfa453b15098a08c79ccd78063bbc0c346975077ffb29e0470d3f0744de63756d5d'),
    ('00000000-0000-4000-8000-000000000002'::uuid, 'Admin User', 'site-admin@example.com', 'admin', 'scrypt:d91a13ce255f5da69f6ac821abf91b60:2861e4521e722e3d6f3ce97e96417b0b7578b8296f03a75e5b5ddce4d1b3c7c70773d3640d69450c301ddb09616acfa9e1dffc6e13b808b247e74b03f52fd9c6'),
    ('00000000-0000-4000-8000-000000000003'::uuid, 'Standard User', 'user@example.com', 'member', 'scrypt:a2f76653e0b315c55acfc9ed23f76737:a223a3133af3de2a10f7a727270ff5c456bda5795d4371efc4e69dd0bfae49bb88c66e2a3d66a7fe8d5a40c1ae6b62e9bf23db3d7ca255003f260dd107105981'),
    ('00000000-0000-4000-8000-000000000004'::uuid, 'Guest User', 'guest@example.com', 'viewer', 'scrypt:1b9805960061c67ab55898398607ff15:8b3ee8164736e4fc22594633eec8a2e96b85a8031a8839fc4b0e55f4561a6bbf6247d16b05d671504cd0ff1444e63b4149aaf736c7ac8e8c71ea89c972b83c99')
) AS seed(id, name, email, role, password_hash)
WHERE NOT EXISTS (
  SELECT 1 FROM users WHERE LOWER(users.email) = LOWER(seed.email)
);

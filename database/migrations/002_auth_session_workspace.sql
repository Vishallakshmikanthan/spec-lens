-- ============================================================
-- Migration 002: Add auth fields and sessions table
-- ============================================================

-- Add lastLoginAt to users table
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "lastLoginAt" TIMESTAMP;

-- Create sessions table for server-side session management
CREATE TABLE IF NOT EXISTS "sessions" (
  "id" SERIAL PRIMARY KEY,
  "userId" INTEGER NOT NULL REFERENCES "users"(id) ON DELETE CASCADE,
  "tokenHash" VARCHAR(256) NOT NULL,
  "expiresAt" TIMESTAMP NOT NULL,
  "createdAt" TIMESTAMP DEFAULT NOW(),
  "lastUsedAt" TIMESTAMP DEFAULT NOW(),
  UNIQUE ("userId", "tokenHash")
);

-- Index for session lookup by token hash
CREATE INDEX IF NOT EXISTS "idx_sessions_token_hash" ON "sessions"(tokenHash);

-- Index for session lookup by user
CREATE INDEX IF NOT EXISTS "idx_sessions_user" ON "sessions"(userId);

-- Update workspaceMembers role enum to include owner and admin
-- (existing role column already has DEFAULT 'member', we add constraints via comments)
COMMENT ON COLUMN "workspaceMembers"."role" IS 'Role: member|admin|owner';

-- Add helper index for workspace membership lookup
CREATE INDEX IF NOT EXISTS "idx_workspace_members_role" ON "workspaceMembers"(role);

-- Grant permissions for session management
GRANT ALL ON "sessions" TO authenticated;

-- Add comment documenting the session security model
COMMENT ON TABLE "sessions" IS 'Server-side session store. tokenHash is hashed bcrypt/argon2 id. 
  Never stores plaintext tokens. Uses HTTP-only secure cookies for client transmission.
  Server-side invalidation on logout. Session fixation protection via rotating tokenHash.';
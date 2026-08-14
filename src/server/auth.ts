import argon2 from "argon2";
import { defineEventHandler, H3Event } from "h3";
import { getDb } from "@/lib/db";
import { eq, sql } from "drizzle-orm";
import { createError, setCookie, getCookie } from "h3";
import * as schema from "../../database/schema";

/**
 * Hash a password using Argon2id.
 */
export async function hashPassword(password: string): Promise<string> {
  return await argon2.hash(password);
}

/**
 * Verify a password against its hash.
 */
export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return await argon2.verify(hash, password);
}

/**
 * Generate a new secure session token hash for a user.
 * Stores the argon2 hash of the token in the sessions table.
 * Returns the token hash (not the raw token).
 */
export async function createSessionTokenHash(userId: number): Promise<string> {
  const buf = new Uint8Array(64);
  crypto.getRandomValues(buf);
  const token = Buffer.from(buf).toString("base64");
  return await argon2.hash(token);
}

/**
 * Get the current user from the secure HTTP-only session cookie.
 * Server-side only - reads token from cookie, validates against DB.
 */
export async function getCurrentUserFromSession(
  event: H3Event
): Promise<{
  user: {
    id: number;
    name: string;
    email: string;
    role: string;
    createdAt: string;
    updatedAt: string;
    lastLoginAt: string | null;
  } | null;
  memberships: {
    workspaceId: number;
    role: string;
    joinedAt: string;
  }[];
}> {
  // Read the session token from the secure HTTP-only cookie
  const token = getCookie(event, "speclens_session");

  if (!token) {
    return { user: null, memberships: [] };
  }

  // Hash the token to look up in the database
  const tokenHash = await argon2.hash(token);

  // Get database instance
  const db = getDb();

  // Look up the session by token hash
  const [session] = await db
    .select({
      userId: schema.sessions.userId,
      expiresAt: schema.sessions.expiresAt,
    })
    .from(schema.sessions)
    .where(sql`${schema.sessions.tokenHash} = ${tokenHash}`)
    .limit(1);

  if (!session || new Date(session.expiresAt) < new Date()) {
    // Session expired or not found - clear cookie
    setCookie(event, "speclens_session", "", {
      httpOnly: true,
      secure: process.env["NODE_ENV"] === "production",
      sameSite: "lax",
      expires: new Date(0),
      path: "/",
    });
    return { user: null, memberships: [] };
  }

  // Update last used at
  await db
    .update(schema.sessions)
    .set({ lastUsedAt: new Date() })
    .where(sql`${schema.sessions.id} = ${session.id}`);

  // Get the user details
  const [user] = await db
    .select({
      id: schema.users.id,
      name: schema.users.name,
      email: schema.users.email,
      role: schema.users.role,
      createdAt: schema.users.createdAt,
      updatedAt: schema.users.updatedAt,
      lastLoginAt: schema.users.lastLoginAt,
    })
    .from(schema.users)
    .where(eq(schema.users.id, session.userId))
    .limit(1);

  if (!user) {
    setCookie(event, "speclens_session", "", {
      httpOnly: true,
      secure: process.env["NODE_ENV"] === "production",
      sameSite: "lax",
      expires: new Date(0),
      path: "/",
    });
    return { user: null, memberships: [] };
  }

  // Get workspace memberships
  const memberships = await db
    .select({
      workspaceId: schema.workspaceMembers.workspaceId,
      role: schema.workspaceMembers.role,
      joinedAt: schema.workspaceMembers.joinedAt,
    })
    .from(schema.workspaceMembers)
    .where(eq(schema.workspaceMembers.userId, session.userId));

  return {
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
      lastLoginAt: user.lastLoginAt,
    },
    memberships,
  };
}

/**
 * Set the secure HTTP-only session cookie.
 */
function setSessionCookie(
  event: H3Event,
  token: string,
  expiresAt: Date
): void {
  setCookie(event, "speclens_session", token, {
    httpOnly: true,
    secure: process.env["NODE_ENV"] === "production",
    sameSite: "lax",
    expires: expiresAt,
    path: "/",
  });
}

/**
 * Clear the session cookie (logout).
 */
function clearSessionCookie(event: H3Event): void {
  setCookie(event, "speclens_session", "", {
    httpOnly: true,
    secure: process.env["NODE_ENV"] === "production",
    sameSite: "lax",
    expires: new Date(0),
    path: "/",
  });
}

/**
 * API: POST /api/auth/signup
 * Creates a new user, workspace, membership, and session.
 */
export async function signup(event: H3Event) {
  try {
    const body = await event.request.json();

    const { name, email, password, passwordConfirmation, workspaceName } = body;

    // Validation
    if (!name || !email || !password) {
      throw createError({
        statusCode: 400,
        statusMessage: "Name, email, and password are required.",
      });
    }

    if (password !== passwordConfirmation) {
      throw createError({
        statusCode: 400,
        statusMessage: "Passwords do not match.",
      });
    }

    if (password.length < 8) {
      throw createError({
        statusCode: 400,
        statusMessage: "Password must be at least 8 characters.",
      });
    }

    // Get database instance
    const db = getDb();

    // Check if user already exists (private check - doesn't reveal if email exists)
    const [existingUser] = await db
      .select({ id: schema.users.id })
      .from(schema.users)
      .where(eq(schema.users.email, email))
      .limit(1);

    if (existingUser) {
      throw createError({
        statusCode: 409,
        statusMessage: "Account with this email already exists.",
      });
    }

    // Hash password
    const passwordHash = await hashPassword(password);

    // Create user
    const [newUser] = await db
      .insert(schema.users)
      .values({
        name,
        email,
        passwordHash,
        role: "owner",
      })
      .returning({
        id: schema.users.id,
        name: schema.users.name,
        email: schema.users.email,
        role: schema.users.role,
      });

    // Create default workspace
    const [workspace] = await db
      .insert(schema.workspaces)
      .values({
        name: workspaceName || name,
        plan: "free",
        createdBy: newUser.id,
      })
      .returning({
        id: schema.workspaces.id,
        name: schema.workspaces.name,
        plan: schema.workspaces.plan,
      });

    // Create workspace membership (owner)
    await db.insert(schema.workspaceMembers).values({
      workspaceId: schema.workspaceMembers.workspaceId,
      userId: newUser.id,
      role: "owner",
    });

    // Create session token
    const tokenHash = await createSessionTokenHash(newUser.id);

    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 days

    // Create session
    await db.insert(schema.sessions).values({
      userId: newUser.id,
      tokenHash,
      expiresAt,
    });

    // Set secure cookie
    setSessionCookie(event, tokenHash, expiresAt);

    // Update lastLoginAt
    await db
      .update(schema.users)
      .set({ lastLoginAt: new Date() })
      .where(eq(schema.users.id, newUser.id));

    // Return session info (without passwordHash)
    const result = {
      authenticated: true,
      user: {
        id: newUser.id,
        name: newUser.name,
        email: newUser.email,
        role: newUser.role,
      },
      workspace: {
        id: workspace.id,
        name: workspace.name,
      },
    };

    event.node.res?.setHeader("Content-Type", "application/json");
    return {
      body: JSON.stringify(result),
      statusCode: 201,
    };
  } catch (error: any) {
    console.error("Signup error:", error);
    throw createError({
      statusCode: error.statusCode ?? 500,
      statusMessage: error.statusMessage ?? "Internal server error",
    });
  }
}

/**
 * API: POST /api/auth/login
 * Verifies credentials and establishes session.
 */
export async function login(event: H3Event) {
  try {
    const body = await event.request.json();

    const { email, password } = body;

    if (!email || !password) {
      throw createError({
        statusCode: 400,
        statusMessage: "Email and password are required.",
      });
    }

    // Get database instance
    const db = getDb();

    // Look up user - do not reveal if user exists
    const [user] = await db
      .select({
        id: schema.users.id,
        email: schema.users.email,
        passwordHash: schema.users.passwordHash,
        role: schema.users.role,
      })
      .from(schema.users)
      .where(eq(schema.users.email, email))
      .limit(1);

    if (!user) {
      // Generic error - don't reveal if email exists
      throw createError({
        statusCode: 401,
        statusMessage: "Invalid credentials.",
      });
    }

    // Verify password
    const validPassword = await verifyPassword(password, user.passwordHash);

    if (!validPassword) {
      // Generic error - don't reveal if password is wrong
      throw createError({
        statusCode: 401,
        statusMessage: "Invalid credentials.",
      });
    }

    // Create session token
    const tokenHash = await createSessionTokenHash(user.id);

    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 days

    // Create or replace session
    await db.insert(schema.sessions).values({
      userId: user.id,
      tokenHash,
      expiresAt,
    }).onConflictDoUpdate({
      target: schema.sessions.userId,
      set: {
        tokenHash,
        expiresAt,
      },
    });

    // Set secure cookie
    setSessionCookie(event, tokenHash, expiresAt);

    // Update lastLoginAt
    await db
      .update(schema.users)
      .set({ lastLoginAt: new Date() })
      .where(eq(schema.users.id, user.id));

    const result = {
      authenticated: true,
      user: {
        id: user.id,
        name: user.name ?? "Unknown",
        email: user.email,
        role: user.role,
      },
      workspace: null,
    };

    event.node.res?.setHeader("Content-Type", "application/json");
    return {
      body: JSON.stringify(result),
      statusCode: 200,
    };
  } catch (error: any) {
    console.error("Login error:", error);
    throw createError({
      statusCode: error.statusCode ?? 500,
      statusMessage: error.statusMessage ?? "Internal server error",
    });
  }
}

/**
 * API: POST /api/auth/logout
 * Invalidates the session server-side.
 */
export async function logout(event: H3Event) {
  try {
    // Get the session token from cookie
    const token = getCookie(event, "speclens_session");

    if (token) {
      // Get database instance
      const db = getDb();

      // Hash the token to find the session in the database
      const tokenHash = await argon2.hash(token);

      // Delete the specific session
      await db.delete(schema.sessions).where(eq(schema.sessions.tokenHash, tokenHash));
    }

    // Clear the cookie
    clearSessionCookie(event);

    // Return success
    event.node.res?.setHeader("Content-Type", "application/json");
    return {
      body: JSON.stringify({ authenticated: false }),
      statusCode: 200,
    };
  } catch (error: any) {
    console.error("Logout error:", error);
    throw createError({
      statusCode: error.statusCode ?? 500,
      statusMessage: error.statusMessage ?? "Internal server error",
    });
  }
}

/**
 * API: GET /api/auth/session
 * Returns current authenticated user and workspace info.
 */
export async function session(event: H3Event) {
  try {
    const { user, memberships } = await getCurrentUserFromSession(event);

    // Determine the current/active workspace
    // For now, use the first membership as the active workspace
    const activeWorkspace = memberships.length > 0 ? {
      id: memberships[0].workspaceId,
      role: memberships[0].role,
    } : null;

    const result = {
      authenticated: !!user,
      user: user ?? null,
      workspace: activeWorkspace,
      memberships: memberships.map(m => ({
        workspaceId: m.workspaceId,
        role: m.role,
      })),
    };

    event.node.res?.setHeader("Content-Type", "application/json");
    return {
      body: JSON.stringify(result),
      statusCode: 200,
    };
  } catch (error: any) {
    console.error("Session error:", error);
    throw createError({
      statusCode: error.statusCode ?? 500,
      statusMessage: error.statusMessage ?? "Internal server error",
    });
  }
}
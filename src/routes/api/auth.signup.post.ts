import { createError, defineEventHandler, setCookie, getCookie } from "h3";
import { getDb } from "@/lib/db";
import { users, sessions, workspaceMembers, workspaces } from "@/database/schema";
import { eq } from "drizzle-orm";
import { hashPassword, createSessionTokenHash } from "@/server/auth";
import type { H3Event } from "h3";

export default defineEventHandler(async (event: H3Event) => {
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

    // Check if user already exists (private check - doesn't reveal if email exists)
    const db = getDb();
    const [existingUser] = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.email, email))
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
      .insert(users)
      .values({
        name,
        email,
        passwordHash,
        role: "owner",
      })
      .returning({
        id: users.id,
        name: users.name,
        email: users.email,
        role: users.role,
      });

    // Create default workspace
    const [workspace] = await db
      .insert(workspaces)
      .values({
        name: workspaceName || name,
        plan: "free",
        createdBy: newUser.id,
      })
      .returning({
        id: workspaces.id,
        name: workspaces.name,
        plan: workspaces.plan,
      });

    // Create workspace membership (owner)
    await db.insert(workspaceMembers).values({
      workspaceId: workspace.id,
      userId: newUser.id,
      role: "owner",
    });

    // Create session token
    const tokenHash = await createSessionTokenHash(newUser.id);

    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 days

    // Create session
    await db.insert(sessions).values({
      userId: newUser.id,
      tokenHash,
      expiresAt,
    });

    // Set secure cookie
    setCookie(event, "speclens_session", tokenHash, {
      httpOnly: true,
      secure: process.env["NODE_ENV"] === "production",
      sameSite: "lax",
      expires: expiresAt,
      path: "/",
    });

    // Update lastLoginAt
    await db
      .update(users)
      .set({ lastLoginAt: new Date() })
      .where(eq(users.id, newUser.id));

    // Return session info
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
});
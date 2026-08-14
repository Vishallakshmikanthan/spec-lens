import { createError, defineEventHandler, setCookie, getCookie } from "h3";
import { getDb } from "@/lib/db";
import { users, sessions } from "@/database/schema";
import { eq } from "drizzle-orm";
import { verifyPassword, createSessionTokenHash } from "@/server/auth";
import type { H3Event } from "h3";

export default defineEventHandler(async (event: H3Event) => {
  try {
    const body = await event.request.json();

    const { email, password } = body;

    if (!email || !password) {
      throw createError({
        statusCode: 400,
        statusMessage: "Email and password are required.",
      });
    }

    // Look up user - do not reveal if user exists
    const db = getDb();
    const [user] = await db
      .select({
        id: users.id,
        email: users.email,
        passwordHash: users.passwordHash,
        role: users.role,
      })
      .from(users)
      .where(eq(users.email, email))
      .limit(1);

    if (!user) {
      throw createError({
        statusCode: 401,
        statusMessage: "Invalid credentials.",
      });
    }

    // Verify password
    const validPassword = await verifyPassword(password, user.passwordHash);

    if (!validPassword) {
      throw createError({
        statusCode: 401,
        statusMessage: "Invalid credentials.",
      });
    }

    // Create session token
    const tokenHash = await createSessionTokenHash(user.id);

    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 days

    // Create or replace session
    await db.insert(sessions).values({
      userId: user.id,
      tokenHash,
      expiresAt,
    }).onConflictDoUpdate({
      target: sessions.userId,
      set: {
        tokenHash,
        expiresAt,
      },
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
      .where(eq(users.id, user.id));

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
});
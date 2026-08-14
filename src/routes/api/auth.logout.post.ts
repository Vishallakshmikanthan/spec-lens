import { createError, defineEventHandler, setCookie, getCookie } from "h3";
import { getDb } from "@/lib/db";
import { sessions } from "@/database/schema";
import { eq } from "drizzle-orm";
import argon2 from "argon2";
import type { H3Event } from "h3";

export default defineEventHandler(async (event: H3Event) => {
  try {
    // Get the session token from cookie
    const token = getCookie(event, "speclens_session");

    if (token) {
      // Hash the token to find the session in the database
      const db = getDb();
      const tokenHash = await argon2.hash(token);

      // Delete the specific session
      await db.delete(sessions).where(eq(sessions.tokenHash, tokenHash));
    }

    // Clear the cookie
    setCookie(event, "speclens_session", "", {
      httpOnly: true,
      secure: process.env["NODE_ENV"] === "production",
      sameSite: "lax",
      expires: new Date(0),
      path: "/",
    });

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
});
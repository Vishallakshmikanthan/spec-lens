import { getCookie, defineEventHandler, createError } from "h3";
import { getDb } from "@/lib/db";
import { users, workspaceMembers } from "@/database/schema";
import { eq } from "drizzle-orm";
import { getCurrentUserFromSession } from "@/server/auth";
import type { H3Event } from "h3";

export default defineEventHandler(async (event: H3Event) => {
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
});
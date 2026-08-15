import { defineEventHandler, H3Event, setHeader, getQuery } from "h3";
import { getDb } from "@/lib/db";
import { datasheets, workspaces, users, workspaceMembers } from "@/database/schema";
import { eq, and, sql } from "drizzle-orm";
import { getCurrentUserFromSession } from "@/server/auth";

export default defineEventHandler(async (event: H3Event) => {
  try {
    // 1. Authenticate the user
    const { user, memberships } = await getCurrentUserFromSession(event);

    if (!user) {
      throw createError({
        statusCode: 401,
        statusMessage: "Unauthenticated",
      });
    }

    // 2. Resolve the active workspace (first membership)
    const activeWorkspace = memberships.length > 0
      ? memberships[0].workspaceId
      : null;

    if (activeWorkspace === null) {
      throw createError({
        statusCode: 403,
        statusMessage: "User has no workspace membership.",
      });
    }

    const db = getDb();

    // 3. Get optional query parameters
    const qs = getQuery(event);
    const status = qs.status as string | undefined;
    const manufacturer = qs.manufacturer as string | undefined;
    const mpn = qs.mpn as string | undefined;
    const limit = (qs.limit ? Number(qs.limit) : 50);

    // 4. Build where clause for workspace filtering
    const workspaceCondition = eq(datasheets.workspaceId, activeWorkspace);

    // 5. Optionally filter by status
    let datasheetsQuery = db.select()
      .from(datasheets)
      .where(workspaceCondition);

    if (status) {
      datasheetsQuery = datasheetsQuery.where(eq(datasheets.status, status));
    }

    if (manufacturer) {
      datasheetsQuery = datasheetsQuery.where(eq(datasheets.manufacturer, manufacturer));
    }

    if (mpn) {
      datasheetsQuery = datasheetsQuery.where(eq(datasheets.mpn, mpn));
    }

    // 6. Apply limit and order by most recent first
    const allDatasheets = await datasheetsQuery
      .orderBy(datasheets.updatedAt.descnullsLast)
      .limit(limit);

    setHeader(event, "Content-Type", "application/json");

    return {
      body: JSON.stringify({
        datasheets: allDatasheets,
        total: allDatasheets.length,
      }),
      statusCode: 200,
    };
  } catch (error: any) {
    console.error("List datasheets error:", error);

    if (error.statusCode) {
      throw error;
    }

    throw createError({
      statusCode: 500,
      statusMessage: "Internal server error",
    });
  }
});
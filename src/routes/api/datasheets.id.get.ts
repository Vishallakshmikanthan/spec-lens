import { defineEventHandler, H3Event, setHeader, getOrderedRouterParam } from "h3";
import { getDb } from "@/lib/db";
import { datasheets, processingJobs, processingStages, workspaces, users, workspaceMembers } from "@/database/schema";
import { eq, and } from "drizzle-orm";
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

    // 3. Get the datasheet ID from route params
    const datasheetId = getOrderedRouterParam(event, ["datasheetId"]) as string | undefined;

    if (!datasheetId) {
      throw createError({
        statusCode: 400,
        statusMessage: "Missing datasheetId parameter.",
      });
    }

    // 4. Verify workspace membership
    const [workspace] = await db
      .select({ id: workspaces.id, name: workspaces.name })
      .from(workspaces)
      .where(eq(workspaces.id, activeWorkspace));

    if (!workspace) {
      throw createError({
        statusCode: 403,
        statusMessage: "Workspace not found.",
      });
    }

    // 5. Find the datasheet
    const [ds] = await db
      .select({
        id: datasheets.id,
        workspaceId: datasheets.workspaceId,
        mpn: datasheets.mpn,
        manufacturer: datasheets.manufacturer,
        title: datasheets.title,
        fileName: datasheets.fileName,
        storageKey: datasheets.storageKey,
        mimeType: datasheets.mimeType,
        fileSize: datasheets.fileSize,
        pageCount: datasheets.pageCount,
        status: datasheets.status,
        indexStatus: datasheets.indexStatus,
        favorite: datasheets.favorite,
        createdBy: datasheets.createdBy,
        createdAt: datasheets.createdAt,
        updatedAt: datasheets.updatedAt,
        checksum: datasheets.checksum,
        version: datasheets.version,
      })
      .from(datasheets)
      .where(eq(datasheets.id, datasheetId));

    if (!ds) {
      throw createError({
        statusCode: 404,
        statusMessage: `Datasheet ${datasheetId} not found.`,
      });
    }

    // 6. Verify datasheet belongs to user's workspace
    if (ds.workspaceId !== activeWorkspace) {
      throw createError({
        statusCode: 403,
        statusMessage: "Access denied: this datasheet belongs to a different workspace.",
      });
    }

    // 7. Fetch associated processing job if available
    let job = null;
    if (ds.pageCount && ds.pageCount > 0) {
      const [pj] = await db
        .select({
          id: processingJobs.id,
          status: processingJobs.status,
          progress: processingJobs.progress,
          pages: processingJobs.pages,
          startedAt: processingJobs.startedAt,
          completedAt: processingJobs.completedAt,
          error: processingJobs.error,
        })
        .from(processingJobs)
        .where(eq(processingJobs.fileName, ds.fileName))
        .limit(1);

      if (pj) {
        job = pj;
      }
    }

    // 8. Fetch associated stages
    let stages = [];
    try {
      stages = await db
        .select({
          id: processingStages.id,
          stage: processingStages.stage,
          status: processingStages.status,
          startedAt: processingStages.startedAt,
          completedAt: processingStages.completedAt,
          error: processingStages.error,
        })
        .from(processingStages)
        .where(eq(processingStages.processingJobId, job?.id ?? ""));
    } catch {
      stages = [];
    }

    setHeader(event, "Content-Type", "application/json");

    return {
      body: JSON.stringify({
        datasheet: {
          id: ds.id,
          workspaceId: ds.workspaceId,
          mpn: ds.mpn,
          manufacturer: ds.manufacturer,
          title: ds.title,
          fileName: ds.fileName,
          storageKey: ds.storageKey,
          mimeType: ds.mimeType,
          fileSize: ds.fileSize,
          pageCount: ds.pageCount,
          status: ds.status,
          indexStatus: ds.indexStatus,
          favorite: ds.favorite,
          createdBy: ds.createdBy,
          createdAt: ds.createdAt.toISOString(),
          updatedAt: ds.updatedAt.toISOString(),
          checksum: ds.checksum,
          version: ds.version,
        },
        job,
        stages,
      }),
      statusCode: 200,
    };
  } catch (error: any) {
    console.error("Get datasheet error:", error);

    if (error.statusCode) {
      throw error;
    }

    throw createError({
      statusCode: 500,
      statusMessage: "Internal server error",
    });
  }
});
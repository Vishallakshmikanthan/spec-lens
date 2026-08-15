import { defineEventHandler, H3Event, setHeader } from "h3";
import { getDb } from "@/lib/db";
import { processingJobs, processingStages } from "@/database/schema";
import { eq } from "drizzle-orm";
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

    // 2. Resolve the active workspace
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

    // 3. Get the job ID from route params
    const jobId = getOrderedRouterParam(event, ["jobId"]) as string | undefined;

    if (!jobId) {
      throw createError({
        statusCode: 400,
        statusMessage: "Missing jobId parameter.",
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

    // 5. Find the processing job
    const [job] = await db
      .select()
      .from(processingJobs)
      .where(eq(processingJobs.id, jobId));

    if (!job) {
      throw createError({
        statusCode: 404,
        statusMessage: `Processing job ${jobId} not found.`,
      });
    }

    if (job.workspaceId !== activeWorkspace) {
      throw createError({
        statusCode: 403,
        statusMessage: "Access denied: this job belongs to a different workspace.",
      });
    }

    // 6. Check if the job can be retried
    // Only allow retry if the job is in a failed state
    if (job.status !== "failed") {
      throw createError({
        statusCode: 400,
        statusMessage: `Job is in "${job.status}" state and cannot be retried. Only failed jobs can be retried.`,
      });
    }

    // 7. Reset the job status and stages
    await db
      .update(processingJobs)
      .set({
        status: "processing",
        progress: 0,
        error: null,
        startedAt: new Date(),
        completedAt: null,
      })
      .where(eq(processingJobs.id, jobId));

    // 8. Reset all stages to pending
    await db
      .delete(processingStages)
      .where(eq(processingStages.processingJobId, jobId));

    const initialStages = [
      { key: "validate", label: "PDF validated", state: "pending" },
      { key: "store", label: "Document stored", state: "pending" },
      { key: "extract", label: "Content extracted", state: "pending" },
      { key: "render", label: "Pages rendered", state: "pending" },
      { key: "layout", label: "Layout analyzed", state: "pending" },
      { key: "regions", label: "Region detection", state: "pending" },
      { key: "embed", label: "Embedding", state: "pending" },
      { key: "index", label: "Vector indexing", state: "pending" },
      { key: "verify", label: "Evidence verification", state: "pending" },
      { key: "ready", label: "Ready", state: "pending" },
    ];

    for (const stage of initialStages) {
      await db.insert(processingStages).values({
        processingJobId: jobId,
        stage: stage.key,
        status: stage.state,
        startedAt: null,
        completedAt: null,
      });
    }

    // 9. Reset the associated datasheet status
    const [datasheet] = await db
      .select({ id: "id", status: "status", version: "version", checksum: "checksum" })
      .from(processingJobs)
      // We need to find the associated datasheet - use fileName to match
      .from(processingJobs)
      .innerJoin(datasheets, sql`${processingJobs.fileName} = ${datasheets.fileName}`)
      .where(eq(processingJobs.id, jobId));

    if (datasheet) {
      // Increment version if this was previously processed
      const newVersion = (datasheet.version || 1) + 1;
      await db
        .update(datasheets)
        .set({ status: "processing", version: newVersion })
        .where(eq(datasheets.id, datasheet.id));
    }

    setHeader(event, "Content-Type", "application/json");

    return {
      body: JSON.stringify({
        jobId,
        status: "processing",
        progress: 0,
        message: "Processing job reset. Retry started.",
      }),
      statusCode: 200,
    };
  } catch (error: any) {
    console.error("Job retry error:", error);

    if (error.statusCode) {
      throw error;
    }

    throw createError({
      statusCode: 500,
      statusMessage: "Internal server error during job retry.",
    });
  }
});
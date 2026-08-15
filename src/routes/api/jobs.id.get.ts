import { defineEventHandler, H3Event, setHeader, getOrderedRouterParam } from "h3";
import { getDb } from "@/lib/db";
import { processingJobs, processingStages, datasheets } from "@/database/schema";
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
      .select({
        id: processingJobs.id,
        fileName: processingJobs.fileName,
        status: processingJobs.status,
        progress: processingJobs.progress,
        pages: processingJobs.pages,
        sizeMb: processingJobs.fileSize,
        startedAt: processingJobs.startedAt,
        completedAt: processingJobs.completedAt,
        error: processingJobs.error,
        duration: processingJobs.duration,
        createdAt: processingJobs.createdAt,
        updatedAt: processingJobs.updatedAt,
      })
      .from(processingJobs)
      .where(eq(processingJobs.id, jobId));

    if (!job) {
      throw createError({
        statusCode: 404,
        statusMessage: `Processing job ${jobId} not found.`,
      });
    }

    // 6. Verify job belongs to user's workspace
    if (job.workspaceId !== activeWorkspace) {
      throw createError({
        statusCode: 403,
        statusMessage: "Access denied: this job belongs to a different workspace.",
      });
    }

    // 7. Fetch associated stages
    const stages = await db
      .select({
        id: processingStages.id,
        stage: processingStages.stage,
        status: processingStages.status,
        startedAt: processingStages.startedAt,
        completedAt: processingStages.completedAt,
        error: processingStages.error,
      })
      .from(processingStages)
      .where(eq(processingStages.processingJobId, jobId))
      .orderBy(processingStages.stage);

    // 8. Compute progress from completed stages
    const totalStages = stages.length;
    const completedStages = stages.filter((s) => s.status === "completed").length;
    const progress = totalStages > 0 ? Math.round((completedStages / totalStages) * 100) : 0;

    // 9. Compute overall job progress considering completed status
    let overallProgress = progress;
    if (job.status === "completed") {
      overallProgress = 100;
    } else if (job.status === "failed") {
      overallProgress = 0;
    }

    // 10. Format logs from stages
    const logs = stages
      .filter((s) => s.error || s.startedAt || s.completedAt)
      .map((s) => ({
        at: s.startedAt ? s.startedAt.toISOString() : "",
        line: `${s.stage}: ${s.status}${s.error ? ` - ${s.error}` : ""}`,
      }))
      .slice(-20); // last 20 logs

    setHeader(event, "Content-Type", "application/json");

    return {
      body: JSON.stringify({
        job: {
          id: job.id,
          fileName: job.fileName,
          status: job.status,
          progress: overallProgress,
          pages: job.pages,
          sizeMb: job.sizeMb,
          startedAt: job.startedAt?.toISOString(),
          completedAt: job.completedAt?.toISOString(),
          error: job.error,
          duration: job.duration,
          stages,
          logs,
        },
      }),
      statusCode: 200,
    };
  } catch (error: any) {
    console.error("Get job error:", error);

    if (error.statusCode) {
      throw error;
    }

    throw createError({
      statusCode: 500,
      statusMessage: "Internal server error",
    });
  }
});
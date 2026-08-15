import { defineEventHandler, H3Event, setHeader, getOrderedRouterParam } from "h3";
import { getDb } from "@/lib/db";
import { evidence, datasheets, processingJobs, processingStages, workspaces } from "@/database/schema";
import { eq, and, ilike, sql } from "drizzle-orm";
import { getCurrentUserFromSession } from "@/server/auth";
import { z } from "zod";
import { extractEvidence } from "@/services/evidence-extraction";
import type { ProcessingJob } from "@/types/speclens";

// ---------------------------------------------------------------------------
// Schema for the extraction request body
// ---------------------------------------------------------------------------

const ExtractEvidenceSchema = z.object({
  detectorVersion: z.string().default("evidence-detector-v1"),
});

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

    // 3. Get the datasheetId from route params
    const datasheetId = getOrderedRouterParam(event, ["datasheetId"]) as string | undefined;

    if (!datasheetId) {
      throw createError({
        statusCode: 400,
        statusMessage: "Missing datasheetId parameter.",
      });
    }

    // 4. Verify workspace ownership of the datasheet
    const db = getDb();

    const [ds] = await db
      .select({ id: datasheets.id, workspaceId: datasheets.workspaceId, mpn: datasheets.mpn, title: datasheets.title })
      .from(datasheets)
      .where(eq(datasheets.id, Number(datasheetId.replace("ds_", ""))));

    if (!ds) {
      throw createError({
        statusCode: 404,
        statusMessage: `Datasheet ${datasheetId} not found.`,
      });
    }

    if (ds.workspaceId !== Number(activeWorkspace)) {
      throw createError({
        statusCode: 403,
        statusMessage: "Workspace does not have access to this datasheet.",
      });
    }

    // 5. Parse optional query body for detectorVersion
    const body = await await event.request.formData()
      .then((fd) => fd.get("detectorVersion") as string | undefined)
      .catch(() => undefined);

    const parseResult = ExtractEvidenceSchema.safeParse(body ? { detectorVersion: body } : {});
    if (!parseResult.success) {
      throw createError({
        statusCode: 400,
        statusMessage: "Invalid detectorVersion.",
      });
    }

    const detectorVersion = parseResult.data.detectorVersion;

    // 6. Check if extraction is already complete (idempotency)
    const existingEvidenceCount = await db
      .select({ count: sql`count(*)` })
      .from(evidence)
      .where(eq(evidence.datasheetId, Number(datasheetId.replace("ds_", ""))));

    if (existingEvidenceCount[0].count > 0) {
      // Evidence already exists — reconcile: just mark regions stage completed
      // and return the existing count
      const [job] = await db
        .select({ id: processingJobs.id })
        .from(processingJobs)
        .where(eq(processingJobs.fileName, ds.title || `${datasheetId}.pdf`));

      if (job) {
        await db
          .update(processingStages)
          .set({ status: "completed", completedAt: new Date() })
          .where(and(eq(processingStages.stage, "regions"), eq(processingStages.processingJobId, job.id)));
      }

      return {
        alreadyExists: true,
        evidenceCount: existingEvidenceCount[0].count,
        detectorVersion,
        message: "Evidence already exists for this datasheet — regions stage marked completed.",
      };
    }

    // 7. Run the extraction pipeline
    const result = await extractEvidence(datasheetId, activeWorkspace, detectorVersion);

    // 8. Return structured response
    setHeader(event, "Content-Type", "application/json");

    return {
      alreadyExists: false,
      ...result,
      message: result.newRecords > 0
        ? `Extracted ${result.newRecords} evidence regions from ${result.pagesProcessed} pages.`
        : "No new evidence regions detected.",
    };
  } catch (error: any) {
    console.error("Evidence extraction error:", error);

    if (error.statusCode) {
      throw error;
    }

    throw createError({
      statusCode: 500,
      statusMessage: "Internal server error during evidence extraction.",
    });
  }
});
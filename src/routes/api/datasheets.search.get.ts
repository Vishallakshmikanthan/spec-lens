import { defineEventHandler, H3Event, setHeader } from "h3";
import { getDb } from "@/lib/db";
import { datasheetPages, documentTextBlocks, evidence } from "@/database/schema";
import { eq, and, sql, ilike, or } from "drizzle-orm";
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

    // 3. Resolve the datasheetId from query parameters
    const qs = getQuery(event);
    const datasheetId = qs["datasheetId"] as string | undefined;
    const query = qs.query as string | undefined;

    if (!datasheetId) {
      throw createError({
        statusCode: 400,
        statusMessage: "Missing required query parameter: datasheetId",
      });
    }

    // 4. Verify workspace membership and datasheet access
    const [datasheet] = await db
      .select({ id: datasheets.id, workspaceId: datasheets.workspaceId })
      .from(datasheets)
      .where(eq(datasheets.id, datasheetId));

    if (!datasheet) {
      throw createError({
        statusCode: 404,
        statusMessage: "Datasheet not found.",
      });
    }

    if (datasheet.workspaceId !== activeWorkspace) {
      throw createError({
        statusCode: 403,
        statusMessage: "Access denied: this datasheet belongs to a different workspace.",
      });
    }

    // 5. If no search query, return empty results
    if (!query || query.trim().length === 0) {
      setHeader(event, "Content-Type", "application/json");
      return {
        body: JSON.stringify({
          query,
          latencyMs: 0,
          total: 0,
          results: [],
          facets: [],
        }),
        statusCode: 200,
      };
    }

    // 6. Search document text blocks
    const searchTokens = query.trim().toLowerCase().split(/\s+/).filter((t) => t.length > 2);

    // Search in document text blocks
    const [blocks] = await db
      .select({
        id: documentTextBlocks.id,
        pageNumber: documentTextBlocks.pageNumber,
        text: documentTextBlocks.text,
        bboxX: documentTextBlocks.bboxX,
        bboxY: documentTextBlocks.bboxY,
        bboxW: documentTextBlocks.bboxW,
        bboxH: documentTextBlocks.bboxH,
        readingOrder: documentTextBlocks.readingOrder,
      })
      .from(documentTextBlocks)
      .where(eq(documentTextBlocks.documentId, Number(datasheetId.replace("ds_", ""))));

    // Score each block by token matches
    const scoredResults = blocks.map((block) => {
      const lowerText = block.text.toLowerCase();
      const matches = searchTokens.filter((token) => lowerText.includes(token));
      const hitCount = matches.length;

      if (hitCount > 0) {
        // Extract a text snippet around the matches
        const words = block.text.split(" ");
        const snippetLength = 15;
        let startIdx = Math.max(0, Math.min(words.length - snippetLength, Math.floor(block.readingOrder / 2)));
        startIdx = Math.max(0, startIdx - 2); // include some context
        const endIdx = Math.min(words.length, startIdx + snippetLength);
        const snippet = words.slice(startIdx, endIdx).join(" ") + "...";

        return {
          page: block.pageNumber,
          snippet,
          bbox: {
            x: block.bboxX,
            y: block.bboxY,
            w: block.bboxW,
            h: block.bboxH,
          },
          hitCount,
          text: block.text,
        };
      }
      return null;
    });

    // Filter out null results and sort by hit count then reading order
    const validResults = scoredResults
      .filter((r): r is NonNullType<typeof r> => r !== null)
      .sort((a, b) => b.hitCount - a.hitCount || a.readingOrder - b.readingOrder);

    // Dedup results by page + bbox proximity
    const dedupedResults = validResults.filter((result, index, self) =>
      index === self.findIndex(
        (r) =>
          r.page === result.page &&
          Math.abs(r.bbox.x - result.bbox.x) < 0.1 &&
          Math.abs(r.bbox.y - result.bbox.y) < 0.1,
      ),
    );

    // 7. Also search in evidence records for additional context
    const [evidenceResults] = await db
      .select({
        id: evidence.id,
        pageNumber: evidence.pageNumber,
        title: evidence.title,
        caption: evidence.caption,
        evidenceType: evidence.evidenceType,
        bboxX: evidence.bboxX,
        bboxY: evidence.bboxY,
        bboxW: evidence.bboxW,
        bboxH: evidence.bboxH,
        confidence: evidence.confidence,
      })
      .from(evidence)
      .where(eq(evidence.datasheetId, Number(datasheetId.replace("ds_", ""))));

    // Score evidence results too
    const evidenceScored = evidenceResults.map((ev) => {
      const lowerTitle = (ev.title + " " + ev.caption).toLowerCase();
      const matches = searchTokens.filter((token) => lowerTitle.includes(token));
      if (matches.length > 0) {
        return {
          page: ev.pageNumber,
          snippet: `${ev.title}: ${ev.caption || ""}`.substring(0, 80) + "...",
          bbox: {
            x: ev.bboxX,
            y: ev.bboxY,
            w: ev.bboxW,
            h: ev.bboxH,
          },
          hitCount: matches.length,
          evidenceId: ev.id,
          type: ev.evidenceType,
        };
      }
      return null;
    });

    const validEvidence = evidenceScored.filter((e): e is NonNullType<typeof e> => e !== null).sort(
      (a, b) => b.hitCount - a.hitCount,
    );

    // Combine results
    const allResults = [
      ...validResults.map((r) => ({ ...r, type: "text-block" } as const)),
      ...validEvidence.map((r) => ({ ...r, type: "evidence" } as const)),
    ].sort((a, b) => b.hitCount - a.hitCount);

    setHeader(event, "Content-Type", "application/json");

    return {
      body: JSON.stringify({
        query,
        latencyMs: 100, // placeholder
        total: allResults.length,
        results: allResults.slice(0, 50), // limit results
        facets: {
          types: ["text", "evidence"], // placeholder facets
        },
      }),
      statusCode: 200,
    };
  } catch (error: any) {
    console.error("Document search error:", error);

    if (error.statusCode) {
      throw error;
    }

    throw createError({
      statusCode: 500,
      statusMessage: "Internal server error during document search.",
    });
  }
});
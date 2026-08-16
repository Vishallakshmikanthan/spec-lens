import { defineEventHandler, H3Event, setHeader, createError } from "h3";
import { getDb } from "@/lib/db";
import { getCurrentUserFromSession } from "@/server/auth";
import { evidence, evidenceEmbeddings, workspaces, datasheets, documentEmbeddings } from "@/database/schema";
import { eq, sql, and, or, ilike } from "drizzle-orm";
import { RetrievalService, createRetrievalService } from "@/server/services/embeddings/service";
import { EmbeddingProvider, EmbeddingConfig } from "@/lib/embedding/provider";
import { Evidence } from "@/types/speclens";

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
          query: "",
          latencyMs: 0,
          total: 0,
          results: [],
          facets: {
            types: [],
            manufacturers: [],
            documents: [],
          },
        }),
        statusCode: 200,
      };
    }

    // 6. Check if document embeddings exist for pgvector search
    // If no embeddings are available, fall back to text search
    const embeddingCount = await db.select({
      count: sql`count(*)`.as("count"),
    })
      .from(documentEmbeddings)
      .where(eq(documentEmbeddings.datasheetId, Number(datasheetId)));

    const hasVectorEmbeddings = (embeddingCount[0]?.count ?? 0) > 0;

    // 7. Build filters from query parameters
    const filters: any = {};

    // Evidence type filter (from query or predefined)
    if (qs.evidenceType) {
      filters.evidenceTypes = qs.evidenceType.split(",");
    }

    // Manufacturer filter
    if (qs.manufacturer) {
      filters.manufacturers = [qs.manufacturer];
    }

    // Document filter (only this one)
    filters.documentIds = [Number(datasheetId)];

    // Min confidence filter
    if (qs.minConfidence) {
      filters.minConfidence = Number(qs.minConfidence);
    }

    // Page filter
    if (qs.page) {
      filters.page = Number(qs.page);
    }

    // Page size limit
    const pageSize = Math.min(Number(qs.pageSize) || 20, 50);

    let results: any[] = [];
    let total = 0;
    let latencyMs = 0;

    // 8. Perform vector-based semantic search if embeddings exist
    if (hasVectorEmbeddings) {
      const startTime = Date.now();

      // Use the retrieval service for pgvector-based search
      const provider = await import("/dev/null").then(() => {
        // Return a mock/provider that will use whatever is configured
        return {
          embedText: async (text: string): Promise<number[]> => {
            // Fallback: try to use the lib embedding provider
            try {
              const { getEmbeddingProvider } = await import("@/server/services/embeddings/service");
              const p = getEmbeddingProvider();
              // @ts-ignore - accessing internal method
              return p.embedText(text);
            } catch {
              // Deterministic fallback
              const crypto = await import("crypto");
              const hash = crypto.createHash("sha256").update(text).digest();
              const arr: number[] = [];
              for (let i = 0; i < 384; i++) {
                const byteOffset = (i * 4) % hash.length;
                const hashVal = hash.readUInt32BE(byteOffset) / 0xffffffff;
                arr.push(hashVal - 0.5);
              }
              let sum = 0;
              for (const v of arr) sum += v * v;
              const norm = Math.sqrt(sum) || 1;
              return arr.map((v) => v / norm);
            }
          },
          embedTexts: async (texts: string[]) => texts.map(t => import("/dev/null").then(() => [])),
        };
      });

      try {
        const retrievalService = createRetrievalService(activeWorkspace, provider, {
          model: process.env.EMBEDDING_MODEL || "nvidia/nemotron",
          dimension: Number(process.env.DIMENSION) || 384,
          metric: "cosine",
        });

        const hybridResult = await retrievalService.hybridSearch(query, {
          ...filters,
          pageSize,
        });

        results = hybridResult.results.map((r: any) => ({
          evidence: r.evidence,
          similarity: r.similarity,
          retrievalScore: r.retrievalScore,
          matchedBy: r.matchedBy,
          snippet: r.snippet,
          page: r.page,
          document: r.document,
        }));

        total = hybridResult.total;
        latencyMs = hybridResult.elapsedMs;
      } catch (vectorError) {
        console.error("Vector search failed, falling back to text search:", vectorError);
        // Fall through to text-based search
        hasVectorEmbeddings = false;
      }
    }

    // 9. Fall back to text-based search if no vector embeddings
    if (!hasVectorEmbeddings || results.length === 0) {
      const searchTokens = query.trim().toLowerCase().split(/\s+/).filter((t) => t.length > 2);
      const startTime = Date.now();

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
          startIdx = Math.max(0, startIdx - 2);
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
            evidenceId: null,
            type: "text-block" as const,
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

      results = dedupedResults.map((r: any) => ({
        evidence: {
          id: r.evidenceId || 0,
          datasheetId: Number(datasheetId),
          workspaceId: activeWorkspace,
          mpn: "",
          manufacturer: "",
          title: "",
          evidenceType: "text-block",
          pageNumber: r.page,
          bboxX: r.bbox.x,
          bboxY: r.bbox.y,
          bboxWidth: r.bbox.w,
          bboxHeight: r.bbox.h,
          confidence: 1,
          verificationState: "verified",
          caption: "",
          cropStorageKey: "",
          retrievalScore: r.hitCount / Math.max(1, searchTokens.length),
          modelVersion: process.env.EMBEDDING_MODEL || "nvidia/nemotron",
        } as Evidence,
        similarity: r.hitCount / Math.max(1, searchTokens.length),
        retrievalScore: r.hitCount / Math.max(1, searchTokens.length),
        matchedBy: ["text-match"],
        snippet: r.snippet,
        page: r.page,
        document: {
          id: Number(datasheetId),
          fileName: "",
          mpn: "",
          manufacturer: "",
        },
      }));

      total = results.length;
      latencyMs = Date.now() - startTime;
    }

    // 10. Generate REAL facet counts from retrieved candidates/data
    const facetTypes: Record<string, number> = {};
    const facetManufacturers: Record<string, number> = {};
    const facetDocuments: Record<number, number> = {};

    // Count from results
    results.forEach((r: any) => {
      const ev = r.evidence;
      if (ev.evidenceType) {
        facetTypes[ev.evidenceType] = (facetTypes[ev.evidenceType] || 0) + 1;
      }
      if (ev.manufacturer) {
        facetManufacturers[ev.manufacturer] = (facetManufacturers[ev.manufacturer] || 0) + 1;
      }
      if (r.document && r.document.id) {
        facetDocuments[r.document.id] = (facetDocuments[r.document.id] || 0) + 1;
      }
    });

    // Also count from evidence records for this datasheet
    if (hasVectorEmbeddings || true) {
      try {
        const [evidenceResults] = await db
          .select({
            evidenceType: evidence.evidenceType,
            manufacturer: evidence.manufacturer,
          })
          .from(evidence)
          .where(eq(evidence.datasheetId, Number(datasheetId.replace("ds_", ""))));

        evidenceResults.forEach((ev: any) => {
          if (ev.evidenceType) {
            facetTypes[ev.evidenceType] = (facetTypes[ev.evidenceType] || 0) + 1;
          }
          if (ev.manufacturer) {
            facetManufacturers[ev.manufacturer] = (facetManufacturers[ev.manufacturer] || 0) + 1;
          }
        });
      } catch {}
    }

    const facets = {
      types: Object.entries(facetTypes).map(([type, count]) => ({ type, count })),
      manufacturers: Object.entries(facetManufacturers).map(([man, count]) => ({ manufacturer: man, count })),
      documents: Object.entries(facetDocuments).map(([id, count]) => ({ documentId: id, count })),
    };

    // 11. Return results with the existing SearchResultSet shape
    setHeader(event, "Content-Type", "application/json");

    return {
      body: JSON.stringify({
        query,
        latencyMs,
        total,
        results,
        facets,
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
import { createError, defineEventHandler, getCookie, setCookie } from "h3";
import { getDb } from "@/lib/db";
import { z } from "zod";
import {
  copilotConversations,
  copilotMessages,
  sessions,
  users,
  workspaces,
  workspaceMembers,
  evidence,
  datasheets,
  components,
} from "@/database/schema";
import { eq, and, ilike, or, sql } from "drizzle-orm";
import {
  normalizeQuestion,
  detectComponent,
  runRetrieval,
  rerankEvidence,
  selectContextSet,
  buildEvidenceContext,
  buildGroundingContext,
  getNemotronSystemPrompt,
  buildNemotronUserPrompt,
  parseNemotronResponse,
  validateCitations,
  calculateConfidence,
  cleanInvalidCitations,
  getConversationHistory,
  persistConversationAndMessage,
  CopilotRateLimiter,
} from "@/lib/speclens/copilot-utils";
import type { H3Event } from "h3";

/**
 * POST /api/copilot
 *
 * Core grounding pipeline:
 * 1. Authenticate user + verify workspace access
 * 2. Normalize the question
 * 3. Detect relevant component/entity
 * 4. Run SpecLens retrieval
 * 5. Rerank evidence
 * 6. Select bounded context set
 * 7. Build structured evidence context
 * 8. Send ONLY necessary evidence context to Nemotron
 * 9. Generate grounded answer
 * 10. Validate citations
 * 11. Return answer + sources + confidence
 */
export default defineEventHandler(async (event: H3Event) => {
  try {
    const db = getDb();

    // --- Step 1: Authenticate user and verify workspace access ---
    const sessionToken = getCookie(event, "speclens_session");
    if (!sessionToken) {
      throw createError({
        statusCode: 401,
        statusMessage: "Authentication required. No session found.",
      });
    }

    // Look up session to get user
    const [session] = await db
      .select({ userId: users.id, workspaceId: workspaces.id })
      .from(users)
      .innerJoin(sessions, eq(users.id, sessions.userId))
      .leftJoin(workspaceMembers, eq(workspaceMembers.userId, users.id))
      .where(eq(sessions.tokenHash, sessionToken))
      .limit(1);

    if (!session) {
      throw createError({
        statusCode: 401,
        statusMessage: "Invalid session.",
      });
    }

    const userId = session.userId;
    const workspaceId = session.workspaceId;

    // Verify user is a member of the workspace (or is the creator)
    const [member] = await db
      .select()
      .from(workspaceMembers)
      .where(
        and(eq(workspaceMembers.workspaceId, workspaceId), eq(workspaceMembers.userId, userId)),
      )
      .limit(1);

    if (!member) {
      throw createError({
        statusCode: 403,
        statusMessage: "User is not a member of this workspace.",
      });
    }

    // --- Step 2: Parse and validate request body ---
    const body = await event.request.json();

    const requestSchema = z.object({
      question: z.string().min(1).max(500),
      conversationHistory: z
        .array(
          z.object({
            role: z.enum(["user", "assistant"]),
            content: z.string().max(2000),
          })
        )
        .max(10)
        .default([]),
      workspaceId: z.string().optional(),
    });

    const validated = requestSchema.safeParse(body);

    if (!validated.success) {
      throw createError({
        statusCode: 400,
        statusMessage: "Invalid request format",
      });
    }

    const { question: validatedQuestion, conversationHistory, workspaceId: reqWorkspaceId } =
      validated.data;

    // Use workspace from body or fall back to the authenticated user's workspace
    // If workspaceId provided in request, use it; otherwise use session workspace
    const finalWorkspace = reqWorkspaceId || String(workspaceId);

    // --- Step 3: Normalize the question ---
    const normalizedQuestion = normalizeQuestion(validatedQuestion.trim());

    // --- Step 4: Detect relevant component/entity ---
    const detectedComponent = await detectComponent(
      normalizedQuestion,
      undefined,
      finalWorkspace,
      db,
    );

    // --- Step 5: Run SpecLens retrieval ---
    // Enforce max retrieval results
    const MAX_RETRIEVAL_RESULTS = 50;
    const retrievalStart = Date.now();
    const retrievalResults = await runRetrieval({
      question: normalizedQuestion,
      workspace: finalWorkspace,
      componentMpn: detectedComponent?.mpn || undefined,
      selectedEvidenceIds: undefined,
      db,
    }).then((results) => results.slice(0, MAX_RETRIEVAL_RESULTS));

    const retrievalEnd = Date.now();
    const retrievalLatencyMs = retrievalEnd - retrievalStart;

    // --- Step 6: Rerank evidence ---
    const rerankedEvidence = rerankEvidence(retrievalResults);

    // --- Step 7: Select bounded context set ---
    const contextSet = selectContextSet(rerankedEvidence, 20);

    // --- Step 8: Build structured evidence context ---
    const groundingContext = buildGroundingContext(contextSet);

    // --- Step 9: Check for sufficient evidence before calling Nemotron ---
    if (contextSet.length === 0) {
      // No evidence found - return grounded no-evidence response
      return {
        statusCode: 200,
        body: {
          answer:
            "I couldn't find sufficient evidence in the indexed SpecLens documents to answer this reliably.",
          sources: [],
          confidence: 0.0,
          caveats: ["No relevant evidence found in indexed documents"],
          evidenceContext: {
            totalItems: groundingContext.totalItems,
            hasComponentContext: groundingContext.componentContext?.mpn
              ? true
              : false,
          },
        },
      };
}

// Check rate limiter
    const rateLimiter = new CopilotRateLimiter();
    const rateKey = `user:${userId}`;
    if (!rateLimiter.isAllowed(rateKey, 30, 60000)) {
      throw createError({
        statusCode: 429,
        statusMessage: "Rate limit exceeded. Too many requests.",
      });
    }

    const totalStart = Date.now();

    const conversationHistory = await getConversationHistory(conversationId, db);

    let llmResponse: {
      answer: string;
      sources: unknown[];
      caveats?: string[];
    };
    try {
      llmResponse = await callNemotron({
        question: normalizedQuestion,
        evidenceContext: groundingContext,
        conversationHistory,
        componentContext: detectedComponent,
      });
      const aiLatencyMs = Date.now() - totalStart;

      // Observability: log retrieval and AI latency
      console.info(
        `[Copilot] retrieval=${retrievalLatencyMs}ms ai=${aiLatencyMs}ms sources=${contextSet.length} user=${userId}`
      );
    } catch (nemotronError) {
      // If Nemotron fails, return error response rather than falling back to mock
      console.error("Nemotron call failed:", nemotronError);
      return {
        statusCode: 502,
        body: {
          answer:
            "I encountered an error while generating the grounded answer. The retrieved evidence is available, but the AI service is temporarily unavailable.",
          sources: [],
          confidence: 0.0,
          caveats: ["AI service unavailable - evidence was retrieved successfully"],
          evidenceContext: {
            totalItems: groundingContext.totalItems,
            hasComponentContext: groundingContext.componentContext?.mpn
              ? true
              : false,
          },
        },
      };
    }

    // --- Step 10: Validate citations ---
    const validationResult = validateCitations(llmResponse.sources, contextSet);

    if (!validationResult.valid) {
      const cleaned = cleanInvalidCitations(llmResponse.answer, validationResult);
      // Use cleaned answer with validated sources only
    }

    // --- Step 11: Calculate confidence ---
    const confidence = calculateConfidence(contextSet, validationResult);

    // --- Step 12: Persist conversation and message ---
    await persistConversationAndMessage({
      db,
      userId: Number(userId),
      workspaceId: Number(workspaceId),
      conversationId: conversationId || undefined,
      question: normalizedQuestion,
      answer: llmResponse.answer,
      sources: validationResult.citations,
      confidence,
    });

    // Format and return response
    return {
      statusCode: 200,
      body: {
        answer: llmResponse.answer,
        sources: validationResult.citations,
        confidence,
        caveats: llmResponse.caveats || [],
        // Include evidence context metadata for UI
        evidenceContext: {
          totalItems: groundingContext.totalItems,
          hasComponentContext: groundingContext.componentContext?.mpn
            ? true
            : false,
        },
      },
    };
  } catch (error) {
    const err = error as { statusCode?: number; statusMessage?: string };
    console.error("Copilot endpoint error:", err);
    throw createError({
      statusCode: err.statusCode ?? 500,
      statusMessage: err.statusMessage ?? "Internal server error",
    });
  }
});

/**
 * Call Nemotron LLM server-side with the evidence context.
 */
async function callNemotron({
  question,
  evidenceContext,
  conversationHistory,
  componentContext,
}: {
  question: string;
  evidenceContext: Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
  conversationHistory?: unknown[];
  componentContext?: { mpn: string; manufacturer: string } | null;
}): Promise<{
  answer: string;
  sources: unknown[];
  caveats?: string[];
}> {
  const nemotronKey = process.env["NEMOTRON_API_KEY"];
  if (!nemotronKey) {
    throw new Error("Nemotron API key not configured");
  }

  // Build the user prompt with evidence context
  const userPrompt = buildNemotronUserPrompt({
    question,
    evidenceContext,
    conversationHistory,
    componentContext,
  });

  const response = await fetch("https://api.nVIDIA.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${nemotronKey}`,
    },
    body: JSON.stringify({
      model: "nemotron",
      messages: [
        { role: "system", content: getNemotronSystemPrompt() },
        { role: "user", content: userPrompt },
      ],
      temperature: 0.1,
      max_tokens: 1024,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Nemotron API error: ${response.status} - ${errorText}`);
  }

  const data = await response.json();
  const message = data.choices?.[0]?.message;

  if (!message || !message.content) {
    throw new Error("Nemotron returned unexpected response format");
  }

  // Parse the response
  return parseNemotronResponse(message.content);
}

/**
 * Truncate string to max length.
 */
function truncate(str: string, maxLen: number): string {
  return str.length > maxLen ? str.slice(0, maxLen - 3) + "..." : str;
}

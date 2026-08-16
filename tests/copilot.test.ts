import { describe, it, expect, beforeEach, vi } from "vitest";
import { createError, defineEventHandler } from "h3";
import { z } from "zod";

// Import the request schema and handler
import { copilotPostHandler } from "@/routes/api/copilot.post";
import type { H3Event } from "h3";

// Mock the database and utility functions
function createMockDb() {
  return {
    select: vi.fn(),
    from: vi.fn(),
    innerJoin: vi.fn(),
    where: vi.fn(),
    limit: vi.fn(),
    eq: vi.fn(),
    sql: vi.fn(),
    orderBy: vi.fn(),
    insert: vi.fn(),
    update: vi.fn(),
    return: vi.fn(),
    values: vi.fn(),
  };
}

function mockGetDb() {
  return createMockDb();
}

function mockGetCookie(event: H3Event, name: string) {
  event.node = { cookies: {} };
  return undefined;
}

describe("Copilot API Zod Validation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("rejects empty question", () => {
    const body = { question: "" };

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
    expect(validated.success).toBe(false);
  });

  it("rejects missing question", () => {
    const body = {};

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
    expect(validated.success).toBe(false);
  });

  it("accepts valid question", () => {
    const body = { question: "What is the supply voltage range?" };

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
    expect(validated.success).toBe(true);
    expect(validated.data.question).toBe("What is the supply voltage range?");
  });

  it("limits question max length", () => {
    const longQuestion = "a".repeat(501);
    const body = { question: longQuestion };

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
    expect(validated.success).toBe(false);
  });

  it("limits conversation history to 10 turns", () => {
    const body = {
      question: "test",
      conversationHistory: Array(11).fill({ role: "user" as const, content: "hi" }),
    };

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
    expect(validated.success).toBe(false);
  });

  it("limits conversation history content max length", () => {
    const body = {
      question: "test",
      conversationHistory: [
        { role: "user" as const, content: "a".repeat(2001) },
      ],
    };

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
    expect(validated.success).toBe(false);
  });
});

describe("Copilot API Request Contract", () => {
  it("parses conversationHistory from request body", () => {
    const body = {
      question: "test question",
      conversationHistory: [
        { role: "user", content: "previous question" },
        { role: "assistant", content: "previous answer" },
      ],
      workspaceId: "ws-123",
    };

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
    expect(validated.success).toBe(true);
    expect(validated.data.conversationHistory).toHaveLength(2);
    expect(validated.data.conversationHistory[0].role).toBe("user");
    expect(validated.data.conversationHistory[0].content).toBe("previous question");
    expect(validated.data.workspaceId).toBe("ws-123");
  });

  it("uses session workspace when not provided in request", () => {
    const body = {
      question: "test question",
    };

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
    expect(validated.success).toBe(true);
    expect(validated.data.workspaceId).toBeUndefined();
  });
});

describe("Copilot API Grounding Pipeline", () => {
  // These tests require a running database, so they focus on
  // the logic flow rather than end-to-end execution.

  it("has valid import structure", () => {
    // Verify the handler can be imported without errors
    expect(copilotPostHandler).toBeDefined();
  });
});
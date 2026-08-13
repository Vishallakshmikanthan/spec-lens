/**
 * HTTP transport for the real SpecLens backend.
 * Used by src/services/real-api.ts. Not exercised while DEMO_MODE is true.
 *
 * Responsibilities:
 *   - resolve paths against API_BASE
 *   - normalize errors into ApiError
 *   - JSON (de)serialization
 *   - forward abort signals for cancel-on-unmount
 */
import { API_BASE } from "@/lib/speclens/config";

export class ApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export interface RequestOptions {
  method?: "GET" | "POST" | "PATCH" | "DELETE";
  body?: unknown;
  headers?: Record<string, string>;
  signal?: AbortSignal | null;
}

export async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { method = "GET", body, headers, signal } = options;

  const init: RequestInit = {
    method,
    headers: {
      "Content-Type": "application/json",
      ...headers,
    },
  };
  if (signal) init.signal = signal;
  if (body !== undefined) init.body = JSON.stringify(body);

  const response = await fetch(`${API_BASE}${path}`, init);

  if (!response.ok) {
    throw new ApiError(
      `Request failed: ${response.status} ${response.statusText}`,
      response.status,
    );
  }

  if (response.status === 204) return undefined as T;
  return (await response.json()) as T;
}

export function qs(params: Record<string, string | number | boolean | undefined | null>): string {
  const entries = Object.entries(params).filter(
    (entry): entry is [string, string | number | boolean] =>
      entry[1] !== undefined && entry[1] !== null,
  );
  if (!entries.length) return "";
  const search = new URLSearchParams(entries.map(([k, v]) => [k, String(v)])).toString();
  return `?${search}`;
}

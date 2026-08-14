/**
 * HTTP transport for the SpecLens backend.
 *
 * Responsibilities:
 *   - resolve paths against API_BASE
 *   - normalize errors into ApiError
 *   - JSON (de)serialization
 *   - FormData/file uploads
 *   - forward abort signals for cancel-on-unmount
 *   - timeout handling
 *   - credentials support
 *   - future authentication-header support
 *
 * The UI must never import this directly.
 * Use src/services/real-api.ts instead.
 *
 * Backward-compatible exports: ApiError, qs, request, RequestOptions
 */

import { API_BASE } from "@/lib/speclens/config";

/* -------------------------------------------------------------------------
 * Normalized API error model
 * -------------------------------------------------------------------------*/

export class ApiError extends Error {
  constructor(
    public readonly status: number | null,
    public readonly code: string | null,
    message: string,
    public readonly details: unknown,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export interface RequestOptions {
  method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  body?: unknown;
  headers?: Record<string, string>;
  signal?: AbortSignal | null;
  timeout?: number;
}

/* -------------------------------------------------------------------------
 * Low-level fetch with timeout — no top-level await
 * -------------------------------------------------------------------------*/

async function runFetch(
  input: RequestInfo,
  init: RequestInit & { timeout?: number; base: string; signal?: AbortSignal | null },
): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), init.timeout ?? 30000);

  let url: URL;
  if (input instanceof URL) {
    url = input;
  } else if (typeof input === "string") {
    url = new URL(input, init.base);
  } else {
    // Request object
    const req = input as Request;
    url = new URL(req.url, init.base);
  }

  // Use the provided AbortSignal directly, or the controller's signal
  const effectiveSignal = init.signal ?? controller.signal;

  try {
    const response = await fetch(url, {
      method: "GET",
      signal: effectiveSignal,
      credentials: "include",
    });
    return response;
  } finally {
    clearTimeout(timeoutId);
  }
}

/* -------------------------------------------------------------------------
 * Error normalization
 * -------------------------------------------------------------------------*/

function normalizeError(response: Response): never {
  const status = response.status;

  if (status === 0) {
    throw new ApiError(
      0,
      "network_error",
      "Network error. Check your connection and that the backend is running.",
      { cause: "network" },
    );
  }

  const text = response.statusText || "Unknown error";

  switch (status) {
    case 400:
      throw new ApiError(400, "bad_request", text, { status });
    case 401:
      throw new ApiError(401, "unauthorized", text, { status });
    case 403:
      throw new ApiError(403, "forbidden", text, { status });
    case 404:
      throw new ApiError(404, "not_found", text, { status });
    case 409:
      throw new ApiError(409, "conflict", text, { status });
    case 422:
      throw new ApiError(422, "unprocessable", text, { status });
    case 429:
      throw new ApiError(429, "too_many_requests", text, { status });
    case 500:
    case 502:
    case 503:
      throw new ApiError(status, "server_error", text, { status });
    default:
      throw new ApiError(status ?? 0, "unknown_error", text, { status });
  }
}

/* -------------------------------------------------------------------------
 * JSON request builder
 * -------------------------------------------------------------------------*/

async function jsonFetch<T>(
  path: string,
  options: {
    base: string;
    method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
    body?: unknown;
    headers?: Record<string, string>;
    signal?: AbortSignal | null;
    timeout?: number;
  },
): Promise<T> {
  const { method = "GET", body, headers, signal, timeout } = options;
  const url = new URL(path, options.base);
  const init: RequestInit = {
    method,
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...headers,
    },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  };

  const response = await runFetch(url.href, { signal, timeout, base: options.base });

  if (!response.ok) {
    normalizeError(response);
  }

  const contentType = response.headers.get("content-type") || "";
  if (contentType.includes("application/json")) {
    return (await response.json()) as Promise<T>;
  }

  throw new ApiError(response.status ?? 0, "invalid_response", "Expected JSON response", {
    status: response.status,
  });
}

/* -------------------------------------------------------------------------
 * FormData/file upload builder
 * -------------------------------------------------------------------------*/

async function formFetch<T>(
  path: string,
  options: {
    base: string;
    method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
    body?: unknown;
    headers?: Record<string, string>;
    signal?: AbortSignal | null;
    timeout?: number;
  },
): Promise<T> {
  const { method = "POST", body, headers } = options;
  const formData = new FormData();

  if (body instanceof FormData) {
    body.forEach((value, key) => formData.append(key, String(value)));
  } else if (body && typeof body === "object") {
    Object.entries(body).forEach(([key, value]) => {
      if (value instanceof File || value instanceof Blob) {
        formData.append(key, value);
      } else {
        formData.append(key, String(value));
      }
    });
  }

  const init: RequestInit = {
    method,
    credentials: "include",
    body: formData,
    ...(headers ? { headers } : {}),
  };

  const url = new URL(path, options.base);
  const response = await runFetch(url.href, { signal, timeout, base: options.base });

  if (!response.ok) {
    normalizeError(response);
  }

  const contentType = response.headers.get("content-type") || "";
  if (contentType.includes("application/json")) {
    return (await response.json()) as Promise<T>;
  }

  if (response.status === 204) {
    return undefined as T;
  }

  throw new ApiError(response.status ?? 0, "invalid_response", "Expected JSON response", {
    status: response.status,
  });
}

/* -------------------------------------------------------------------------
 * Public API convenience methods
 * -------------------------------------------------------------------------*/

export const transport = {
  /** GET request */
  async get<T>(path: string, options: { signal?: AbortSignal } = {}): Promise<T> {
    return jsonFetch<T>(path, {
      method: "GET",
      signal: options.signal ?? undefined,
      base: API_BASE,
    });
  },

  /** POST request */
  async post<T>(path: string, options: { body?: unknown; signal?: AbortSignal } = {}): Promise<T> {
    return jsonFetch<T>(path, {
      method: "POST",
      body: options.body,
      signal: options.signal ?? undefined,
      base: API_BASE,
    });
  },

  /** PUT request */
  async put<T>(path: string, options: { body?: unknown; signal?: AbortSignal } = {}): Promise<T> {
    return jsonFetch<T>(path, {
      method: "PUT",
      body: options.body,
      signal: options.signal ?? undefined,
      base: API_BASE,
    });
  },

  /** PATCH request */
  async patch<T>(path: string, options: { body?: unknown; signal?: AbortSignal } = {}): Promise<T> {
    return jsonFetch<T>(path, {
      method: "PATCH",
      body: options.body,
      signal: options.signal ?? undefined,
      base: API_BASE,
    });
  },

  /** DELETE request */
  async delete<T>(path: string, options: { signal?: AbortSignal } = {}): Promise<T> {
    return jsonFetch<T>(path, {
      method: "DELETE",
      signal: options.signal ?? undefined,
      base: API_BASE,
    });
  },

  /** FormData / file upload */
  async upload<T>(
    path: string,
    options: { body?: FormData; signal?: AbortSignal } = {},
  ): Promise<T> {
    return formFetch<T>(path, {
      method: "POST",
      body: options.body,
      signal: options.signal ?? undefined,
      base: API_BASE,
    });
  },
} as const;

/* -------------------------------------------------------------------------
 * Backward-compatible exports — declared once at module level
 * -------------------------------------------------------------------------*/

/* ApiError is exported as a class above */
/* RequestOptions is exported as an interface above */

/* -------------------------------------------------------------------------
 * qs helper — preserved from original implementation
 * -------------------------------------------------------------------------*/

export function qs(params: Record<string, string | number | boolean | undefined | null>): string {
  const entries = Object.entries(params).filter(
    (entry): entry is [string, string | number | boolean] =>
      entry[1] !== undefined && entry[1] !== null,
  );
  if (!entries.length) return "";
  const search = new URLSearchParams(entries.map(([k, v]) => [k, String(v)])).toString();
  return `?${search}`;
}

/* -------------------------------------------------------------------------
 * request function — preserved for real-api.ts and services/index.ts compatibility
 * -------------------------------------------------------------------------*/

export async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { method = "GET", body } = options;

  const methodUpper = method.toUpperCase() as "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

  if (methodUpper === "GET") {
    return transport.get(path, { signal: options.signal }) as Promise<T>;
  }
  if (methodUpper === "POST") {
    return transport.post(path, { body: options.body, signal: options.signal }) as Promise<T>;
  }
  if (methodUpper === "PUT") {
    return transport.put(path, { body: options.body, signal: options.signal }) as Promise<T>;
  }
  if (methodUpper === "PATCH") {
    return transport.patch(path, { body: options.body, signal: options.signal }) as Promise<T>;
  }
  if (methodUpper === "DELETE") {
    return transport.delete(path, { signal: options.signal }) as Promise<T>;
  }

  // Fallback to GET
  return transport.get(path, { signal: options.signal }) as Promise<T>;
}

/**
 * SpecLens service facade.
 *
 * Exposes a single `api` object implementing SpecLensApi. Which implementation
 * is active is decided here — mock in DEMO_MODE, real backend otherwise. The
 * UI always imports { api } from here (or the legacy shim) and never knows
 * which implementation it is talking to.
 */
import { DEMO_MODE } from "@/lib/speclens/config";
import type { SpecLensApi } from "./speclens-api";
import { mockApi } from "./mock-api";
import { realApi } from "./real-api";

export { ApiError, qs, request } from "./transport";
export { mockApi } from "./mock-api";
export { realApi } from "./real-api";
export type { RequestOptions } from "./transport";
export type { SpecLensApi, UploadFileInput } from "./speclens-api";

/** The active service implementation — swap point between demo and real backend. */
export const api: SpecLensApi = DEMO_MODE ? mockApi : realApi;

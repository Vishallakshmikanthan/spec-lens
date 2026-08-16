/**
 * Application-level flags.
 * DEMO_MODE = true means every number, document and result in the UI comes
 * from the typed mock layer in mock-data.ts, not from a real backend.
 */
export const DEMO_MODE = false;

export const API_BASE = (import.meta.env["VITE_API_BASE"] as string | undefined) ?? "/api";

export const APP_NAME = "SpecLens";
export const APP_TAGLINE = "Visual Intelligence for Technical Specifications";

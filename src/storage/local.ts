import { StorageProvider } from "./provider";
import { v4 as uuidv4 } from "uuid";
import path from "path";
import fs from "fs";
import { createHash } from "crypto";

const STORAGE_ROOT = path.resolve(
  process.cwd(),
  "storage",
);

function ensureRootDir(): void {
  if (!fs.existsSync(STORAGE_ROOT)) {
    fs.mkdirSync(STORAGE_ROOT, { recursive: true });
  }
}

function workspaceDir(workspaceId: string): string {
  const d = path.join(STORAGE_ROOT, "workspace", workspaceId);
  ensureRootDir();
  fs.mkdirSync(d, { recursive: true });
  return d;
}

function datasheetDir(workspaceId: string, datasheetId: string): string {
  const d = path.join(workspaceDir(workspaceId), "datasheets", datasheetId);
  ensureRootDir();
  fs.mkdirSync(d, { recursive: true });
  return d;
}

function pagesDir(workspaceId: string, datasheetId: string): string {
  const d = path.join(datasheetDir(workspaceId, datasheetId), "pages");
  ensureRootDir();
  fs.mkdirSync(d, { recursive: true });
  return d;
}

function cropsDir(workspaceId: string, datasheetId: string): string {
  const d = path.join(datasheetDir(workspaceId, datasheetId), "crops");
  ensureRootDir();
  fs.mkdirSync(d, { recursive: true });
  return d;
}

/**
 * Generate a safe, unique storage key that does NOT use the original filename.
 * Pattern: workspace/{workspaceId}/datasheets/{datasheetId}/original.pdf
 */
export function generateStorageKey(
  workspaceId: string,
  datasheetId: string,
  kind: "original" | "page" | "crop" = "original",
): string {
  const base = kind === "original"
    ? path.join("datasheets", `${datasheetId}`, "original.pdf")
    : kind === "page"
      ? path.join("datasheets", `${datasheetId}`, "pages", `${uuidv4()}.pdf`)
      : path.join("datasheets", `${datasheetId}`, "crops", `${uuidv4()}.png`);
  return base;
}

/**
 * Generate a SHA-256 fingerprint for a file buffer.
 * Used for duplicate detection within a workspace.
 */
export function hashBuffer(buffer: Buffer): string {
  return createHash("sha256").update(buffer).digest("hex");
}

/**
 * Check if a filename is a PDF by checking the extension and magic bytes.
 */
export function isPdfFile(name: string, buffer: Buffer): boolean {
  const lower = name.toLowerCase();
  if (!lower.endsWith(".pdf")) {
    return false;
  }
  // Check PDF magic bytes (%PDF-)
  if (buffer.length < 5) {
    return false;
  }
  const magic = buffer.subarray(0, 5).toString("ascii");
  return magic === "%PDF-";
}

/**
 * Local filesystem implementation of StorageProvider.
 *
 * Development-only provider. Uses the local filesystem under
 * `storage/workspace/{workspaceId}/...`. The `storage/` directory
 * must be gitignored.
 */
export class LocalFsStorageProvider implements StorageProvider {
  constructor() {
    ensureRootDir();
  }

  async put(file: Buffer, key: string): Promise<void> {
    const targetPath = path.resolve(STORAGE_ROOT, key);
    const dir = path.dirname(targetPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(targetPath, file);
  }

  async get(key: string): Promise<Buffer> {
    const targetPath = path.resolve(STORAGE_ROOT, key);
    if (!fs.existsSync(targetPath)) {
      throw new Error(`Storage file not found: ${key}`);
    }
    return fs.readFileSync(targetPath);
  }

  async delete(key: string): Promise<void> {
    const targetPath = path.resolve(STORAGE_ROOT, key);
    if (fs.existsSync(targetPath)) {
      fs.unlinkSync(targetPath);
    }
  }

  async exists(key: string): Promise<boolean> {
    const targetPath = path.resolve(STORAGE_ROOT, key);
    return fs.existsSync(targetPath);
  }

  async getMetadata(key: string): Promise<{ size: number; mimeType: string }> {
    const targetPath = path.resolve(STORAGE_ROOT, key);
    if (!fs.existsSync(targetPath)) {
      throw new Error(`Storage file not found: ${key}`);
    }
    const stat = fs.statSync(targetPath);
    // Determine mime type from extension
    const ext = path.extname(key).toLowerCase();
    const mimeMap: Record<string, string> = {
      ".pdf": "application/pdf",
      ".png": "image/png",
      ".jpg": "image/jpeg",
      ".jpeg": "image/jpeg",
    };
    const mimeType = mimeMap[ext] || "application/octet-stream";
    return { size: stat.size, mimeType };
  }

  async computeChecksum(key: string): Promise<string> {
    const targetPath = path.resolve(STORAGE_ROOT, key);
    if (!fs.existsSync(targetPath)) {
      throw new Error(`Storage file not found: ${key}`);
    }
    const fileBuffer = fs.readFileSync(targetPath);
    return hashBuffer(fileBuffer);
  }
}
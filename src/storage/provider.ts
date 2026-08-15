/**
 * Storage provider abstraction.
 *
 * The rest of SpecLens depends on this abstraction, not directly on
 * S3/local filesystem APIs. Concrete providers (local fs, S3, etc.)
 * implement this interface.
 */
export interface StorageProvider {
  put(file: Buffer, key: string): Promise<void>;
  get(key: string): Promise<Buffer>;
  delete(key: string): Promise<void>;
  exists(key: string): Promise<boolean>;
  getMetadata(key: string): Promise<{ size: number; mimeType: string }>;
  /** Compute SHA-256 checksum for a file already stored */
  computeChecksum(key: string): Promise<string>;
}

/**
 * Document metadata stored alongside each uploaded document.
 */
export interface DocumentMetadata {
  /** Unique document ID */
  id: string;
  /** Storage key (opaque, not exposed to browser) */
  storageKey: string;
  /** Original filename */
  fileName: string;
  /** MIME type */
  mimeType: string;
  /** File size in bytes */
  size: number;
  /** SHA-256 checksum */
  checksum: string;
  /** Page count */
  pageCount: number;
  /** Created at timestamp */
  createdAt: string;
}
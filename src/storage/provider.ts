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
}
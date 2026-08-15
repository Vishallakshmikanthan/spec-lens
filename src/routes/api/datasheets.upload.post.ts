import { defineEventHandler, H3Event, setHeader } from "h3";
import { getDb } from "@/lib/db";
import { users, workspaces, workspaceMembers, datasheets, processingJobs, processingStages, datasheetPages } from "@/database/schema";
import { eq, and, sql } from "drizzle-orm";
import { getCurrentUserFromSession } from "@/server/auth";
import { createError, v4 as uuidv4 } from "h3";
import { hashBuffer, generateStorageKey } from "@/storage/local";
import { LocalFsStorageProvider } from "@/storage/local";
import { z } from "zod";
import parse from "pdf-parse";
import type { ProcessingJob, Datasheet } from "@/types/speclens";
import { PROCESSING_STAGES } from "@/lib/speclens/stages";

// Maximum file size: 200 MB (configurable)
const MAX_DATASHEET_SIZE_BYTES = 200 * 1024 * 1024;

// Valid MIME types for PDF
const PDF_MIME_TYPES = ["application/pdf"];

const MAX_DATASHEET_SIZE_MB = 200;

// Allowed PDF stage labels for the processing job
const ingestStageKey = "ingest";
const renderStageKey = "render";

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

    // 2. Resolve the active workspace (first membership)
    const activeWorkspace = memberships.length > 0
      ? memberships[0].workspaceId
      : null;

    if (activeWorkspace === null) {
      throw createError({
        statusCode: 403,
        statusMessage: "User has no workspace membership.",
      });
    }

    // 3. Verify workspace membership
    const db = getDb();

    const [workspace] = await db
      .select({ id: workspaces.id, name: workspaces.name })
      .from(workspaces)
      .where(eq(workspaces.id, activeWorkspace));

    if (!workspace) {
      throw createError({
        statusCode: 403,
        statusMessage: "Workspace not found.",
      });
    }

    // 4. Parse multipart/form-data
    const formData = await event.request.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      throw createError({
        statusCode: 400,
        statusMessage: "No file uploaded.",
      });
    }

    // 5. Validate the file
    const fileName = file.name;
    const fileSize = file.size;
    const fileBuffer = Buffer.from(await file.arrayBuffer());

    // Validate file size
    if (fileSize === 0) {
      throw createError({
        statusCode: 400,
        statusMessage: "Empty file.",
      });
    }

    if (fileSize > MAX_DATASHEET_SIZE_BYTES) {
      throw createError({
        statusCode: 400,
        statusMessage: `File size exceeds maximum limit of ${MAX_DATASHEET_SIZE_MB} MB.`,
      });
    }

    // Validate MIME type
    const mimeType = file.type || "application/pdf";
    if (!PDF_MIME_TYPES.includes(mimeType)) {
      throw createError({
        statusCode: 400,
        statusMessage: `Invalid MIME type: ${mimeType}. Only application/pdf is accepted.`,
      });
    }

    // Validate extension and magic bytes (do not trust filename extension alone)
    if (!isPdfFile(fileName, fileBuffer)) {
      throw createError({
        statusCode: 400,
        statusMessage: "Invalid PDF file. Only PDF files are accepted.",
      });
    }

    // 6. Compute SHA-256 hash for duplicate detection and checksum
    const fileHash = hashBuffer(fileBuffer);

    // 7. Check for duplicate within the same workspace by checksum
    // Look for an existing datasheet with the same checksum in this workspace
    const [existingByChecksum] = await db
      .select({ id: datasheets.id, checksum: datasheets.checksum, version: datasheets.version, title: datasheets.title })
      .from(datasheets)
      .where(eq(datasheets.workspaceId, activeWorkspace));

    let newVersion = 1;
    let isDuplicate = false;

    if (existingByChecksum && existingByChecksum.checksum === fileHash) {
      // Checksum matches — this is a duplicate document upload
      isDuplicate = true;
      newVersion = (existingByChecksum.version || 0) + 1;
    }

    // 8. Validate page count and PDF integrity
    let pdfInfo: {
      numPages: number;
      info: any;
      metadata: any;
    } = { numPages: 0, info: {}, metadata: {} };

    try {
      pdfInfo = await new Promise((resolve, reject) => {
        parse(fileBuffer, (err, data) => {
          if (err) reject(err);
          else resolve(data);
        });
      });
    } catch (parseError) {
      // If PDF parsing fails, mark job as failed and clean up
      await storageProvider.delete(storageKey);
      throw createError({
        statusCode: 400,
        statusMessage: "Invalid or corrupted PDF file.",
      });
    }

    const pageCount = pdfInfo.numPages || 0;

    // Validate page count - reject if unreasonably low or high
    if (pageCount === 0) {
      await storageProvider.delete(storageKey);
      throw createError({
        statusCode: 400,
        statusMessage: "PDF has no pages (corrupted or empty document).",
      });
    }

    if (pageCount > 500) {
      await storageProvider.delete(storageKey);
      throw createError({
        statusCode: 400,
        statusMessage: `PDF has ${pageCount} pages, which exceeds the maximum supported of 500.`,
      });
    }

    // Check for encrypted/password-protected PDF
    if (pdfInfo.metadata && pdfInfo.metadata.isEncrypted) {
      await storageProvider.delete(storageKey);
      throw createError({
        statusCode: 400,
        statusMessage: "Encrypted/password-protected PDFs are not supported. Please provide an unprotected PDF.",
      });
    }

    // 8. Extract PDF title when available
    let pdfTitle: string | null = null;
    if (pdfInfo.metadata && pdfInfo.metadata.title) {
      pdfTitle = String(pdfInfo.metadata.title);
    } else if (pdfInfo.info && pdfInfo.info.Title) {
      pdfTitle = String(pdfInfo.info.Title);
    }

    // 9. Extract page dimensions from PDF info
    // pdf-parse may not always provide dimensions; fall back to defaults
    let pageWidth = 0;
    let pageHeight = 0;

    // Try to get dimensions from PDF info/metadata
    if (pdfInfo.info) {
      pageWidth = pdfInfo.info.PageSize
        ? parseFloat(pdfInfo.info.PageSize.split(/[ ,]/)[0]) || 0
        : 0;
      pageHeight = pdfInfo.info.PageSize
        ? parseFloat(pdfInfo.info.PageSize.split(/[ ,]/)[1]) || 0
        : 0;
    }

    // If still 0, try metadata
    if (pageWidth === 0 || pageHeight === 0) {
      if (pdfInfo.metadata) {
        pageWidth = pdfInfo.metadata.width || 0;
        pageHeight = pdfInfo.metadata.height || 0;
      }
    }

    // Default page dimensions if none found
    if (pageWidth === 0) pageWidth = 612; // Letter default
    if (pageHeight === 0) pageHeight = 792; // Letter default

    // 8. Generate a datasheet ID and storage key
    const datasheetId = `ds_${uuidv4()}`;
    const storageKey = generateStorageKey(
      String(activeWorkspace),
      datasheetId,
      "original"
    );

    // 9. Store the original PDF using the storage provider
    const storageProvider = new LocalFsStorageProvider();
    await storageProvider.put(fileBuffer, storageKey);

    // 10. Extract PDF metadata using pdf-parse
    let pdfInfo: {
      numPages: number;
      info: any;
      metadata: any;
    } = { numPages: 0, info: {}, metadata: {} };

    try {
      pdfInfo = await new Promise((resolve, reject) => {
        parse(fileBuffer, (err, data) => {
          if (err) reject(err);
          else resolve(data);
        });
      });
    } catch (parseError) {
      // If PDF parsing fails, mark job as failed and clean up
      await storageProvider.delete(storageKey);
      throw createError({
        statusCode: 400,
        statusMessage: "Invalid or corrupted PDF file.",
      });
    }

    const pageCount = pdfInfo.numPages || 0;

    // 11. Extract page dimensions from PDF info
    // pdf-parse may not always provide dimensions; fall back to defaults
    let pageWidth = 0;
    let pageHeight = 0;

    // Try to get dimensions from PDF info/metadata
    if (pdfInfo.info) {
      pageWidth = pdfInfo.info.PageSize
        ? parseFloat(pdfInfo.info.PageSize.split(/[ ,]/)[0]) || 0
        : 0;
      pageHeight = pdfInfo.info.PageSize
        ? parseFloat(pdfInfo.info.PageSize.split(/[ ,]/)[1]) || 0
        : 0;
    }

    // If still 0, try metadata
    if (pageWidth === 0 || pageHeight === 0) {
      if (pdfInfo.metadata) {
        pageWidth = pdfInfo.metadata.width || 0;
        pageHeight = pdfInfo.metadata.height || 0;
      }
    }

    // Default page dimensions if none found
    if (pageWidth === 0) pageWidth = 612; // Letter default
    if (pageHeight === 0) pageHeight = 792; // Letter default

// 12. Extract PDF title when available
    let pdfTitle: string | null = null;
    if (pdfInfo.metadata && pdfInfo.metadata.title) {
      pdfTitle = String(pdfInfo.metadata.title);
    } else if (pdfInfo.info && pdfInfo.info.Title) {
      pdfTitle = String(pdfInfo.info.Title);
    }

    // 13. Handle duplicate detection and versioning
    const targetVersion = isDuplicate ? newVersion : 1;

    // 14. Create the Datasheet database record
    const [datasheet] = await db
      .insert(datasheets)
      .values({
        id: datasheetId,
        workspaceId: activeWorkspace,
        mpn: null,
        manufacturer: null,
        title: isDuplicate ? `${pdfTitle} (v${targetVersion})` : pdfTitle,
        fileName: isDuplicate ? `${fileName} (v${targetVersion})` : fileName,
        storageKey,
        mimeType: "application/pdf",
        fileSize: fileSize,
        pageCount,
        status: "processing",
        indexStatus: "queued",
        favorite: false,
        createdBy: user.id,
        checksum: fileHash,
        version: targetVersion,
      })
      .returning({
        id: datasheets.id,
        workspaceId: datasheets.workspaceId,
        fileName: datasheets.fileName,
        pageCount: datasheets.pageCount,
        status: datasheets.status,
      });

    // 15. Create a document version record
    await db.insert(documentVersions).values({
      datasheetId: datasheetId,
      version: targetVersion,
      checksum: fileHash,
      storageKey,
      pageCount,
      mimeType: "application/pdf",
      fileSize: fileSize,
      title: isDuplicate ? `${pdfTitle} (v${targetVersion})` : pdfTitle,
      fileName: isDuplicate ? `${fileName} (v${targetVersion})` : fileName,
      status: "processed",
      createdBy: user.id,
    });

    // 16. If this is a duplicate, mark the previous version appropriately
    if (isDuplicate && existingByChecksum) {
      await db
        .update(datasheets)
        .set({ version: targetVersion, status: "processed" })
        .where(eq(datasheets.id, existingByChecksum.id));
    }

    // 14. Create the ProcessingJob record
    const jobId = `job_${uuidv4()}`;

    // Create the job with initial stages following canonical vocabulary
    // validate and store are completed after upload; the rest are pending
    const initialStages = [
      { key: "validate", label: "PDF validated", state: "completed" },
      { key: "store", label: "Document stored", state: "completed" },
      { key: "extract", label: "Content extracted", state: "pending" },
      { key: "render", label: "Pages rendered", state: "pending" },
      { key: "layout", label: "Layout analyzed", state: "pending" },
      { key: "regions", label: "Region detection", state: "pending" },
      { key: "embed", label: "Embedding", state: "pending" },
      { key: "index", label: "Vector indexing", state: "pending" },
      { key: "verify", label: "Evidence verification", state: "pending" },
      { key: "ready", label: "Ready", state: "pending" },
    ];

    await db.insert(processingJobs).values({
      id: jobId,
      workspaceId: activeWorkspace,
      fileName: fileName,
      storageKey,
      mimeType: "application/pdf",
      fileSize: fileSize,
      mpn: null,
      status: "processing",
      progress: 30, // 30%: ingest + render done
      startedAt: new Date(),
      completedAt: null,
      error: null,
      pages: pageCount,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    // Create the processing stages entries
    for (const stage of initialStages) {
      await db.insert(processingStages).values({
        processingJobId: jobId,
        stage: stage.key,
        status: stage.state,
        startedAt: stage.key === "validate" || stage.key === "store" ? new Date() : null,
        completedAt: stage.state === "completed" ? new Date() : null,
      });
    }

    // 15. Create page records for every page in the PDF
    const pagePromises = [];

    for (let i = 1; i <= pageCount; i++) {
      pagePromises.push(
        db.insert(datasheetPages).values({
          datasheetId: datasheetId,
          pageNumber: i,
          width: pageWidth,
          height: pageHeight,
          storageKey: null,
          text: null, // Text extracted later (or empty if no text layer)
        })
      );
    }

    await db.batch(pagePromises);

    // 16. Update progress to reflect page creation
    await db
      .update(processingJobs)
      .set({ progress: 50 })
      .where(eq(processingJobs.id, jobId));

    // 17. Emit observability log (structured log)
    // In a full implementation, this would go to a logging system
    console.log(`upload_received: workspace=${activeWorkspace}, datasheet=${datasheetId}, pages=${pageCount}, size=${fileSize}`);

    // 18. Return structured response
    setHeader(event, "Content-Type", "application/json");

    return {
      body: JSON.stringify({
        datasheet: {
          id: datasheet.id,
          workspaceId: datasheet.workspaceId,
          fileName: datasheet.fileName,
          pageCount: datasheet.pageCount,
          status: datasheet.status,
        },
        job: {
          id: jobId,
          fileName: fileName,
          status: "processing",
          progress: 50,
          pages: pageCount,
          stages: initialStages,
        },
        message: "PDF uploaded and ingestion started.",
      }),
      statusCode: 201,
    };
  } catch (error: any) {
    // Clean up: if database creation failed but file was stored, clean up storage
    // The error handling below handles most cases

    console.error("Upload error:", error);

    if (error.statusCode) {
      throw error;
    }

    throw createError({
      statusCode: 500,
      statusMessage: "Internal server error",
    });
  }
});

/**
 * Check if a file is a valid PDF by extension and magic bytes.
 */
function isPdfFile(name: string, buffer: Buffer): boolean {
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
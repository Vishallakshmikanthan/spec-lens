import { defineEventHandler, H3Event, setHeader, getHeader, getQuery } from "h3";
import { getDb } from "@/lib/db";
import { datasheets, datasheetPages } from "@/database/schema";
import { eq, and } from "drizzle-orm";
import { getCurrentUserFromSession } from "@/server/auth";
import { createError } from "h3";
import { StorageProvider } from "@/storage/provider";
import { LocalFsStorageProvider } from "@/storage/local";
import { PdfRenderer, PdfRenderConfig } from "@/lib/pdf-renderer";
import { generateStorageKey } from "@/storage/local";

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

    // 2. Resolve the datasheetId and optionally pageNumber from query parameters
    const qs = getQuery(event);
    const datasheetId = (qs["datasheetId"] as string | undefined);
    const pageParam = qs["page"] as string | undefined;
    const pageNumber = pageParam !== undefined ? Number(pageParam) : undefined;

    if (!datasheetId) {
      throw createError({
        statusCode: 400,
        statusMessage: "Missing required query parameter: datasheetId",
      });
    }

    // 3. Verify workspace membership
    const activeWorkspace = memberships.length > 0
      ? memberships[0].workspaceId
      : null;

    if (activeWorkspace === null) {
      throw createError({
        statusCode: 403,
        statusMessage: "User has no workspace membership.",
      });
    }

    const db = getDb();

    // 4. Verify the user has access to the datasheet (belongs to their workspace)
    const [datasheet] = await db
      .select({ id: datasheets.id, workspaceId: datasheets.workspaceId, title: datasheets.title })
      .from(datasheets)
      .where(eq(datasheets.id, datasheetId));

    if (!datasheet) {
      throw createError({
        statusCode: 404,
        statusMessage: "Datasheet not found.",
      });
    }

    if (datasheet.workspaceId !== activeWorkspace) {
      throw createError({
        statusCode: 403,
        statusMessage: "Access denied: this datasheet belongs to a different workspace.",
      });
    }

    // 5. Determine if requesting a specific page or all pages
    if (pageNumber !== undefined) {
      // Get a specific page
      const [page] = await db
        .select({
          id: datasheetPages.id,
          pageNumber: datasheetPages.pageNumber,
          width: datasheetPages.width,
          height: datasheetPages.height,
          text: datasheetPages.text,
          renderStatus: datasheetPages.renderStatus,
          renderFormat: datasheetPages.renderFormat,
          renderedAt: datasheetPages.renderedAt,
          renderWidth: datasheetPages.renderWidth,
          renderHeight: datasheetPages.renderHeight,
          storageKey: datasheetPages.storageKey,
        })
        .from(datasheetPages)
        .where(and(
          eq(datasheetPages.datasheetId, datasheetId),
          eq(datasheetPages.pageNumber, pageNumber),
        ));

      if (!page) {
        throw createError({
          statusCode: 404,
          statusMessage: `Page ${pageNumber} not found for this datasheet.`,
        });
      }

      // 6. Check render status and render if needed
      const renderConfig: PdfRenderConfig = {
        dpi: 220,
        format: page.renderFormat ?? "webp",
        quality: 80,
      };

      let imageBuffer: Buffer;
      let renderWidth = page.renderWidth;
      let renderHeight = page.renderHeight;
      let cached = false;

      if (page.renderStatus === "done" && page.storageKey) {
        // Check if the cached asset exists and is valid
        const storageProvider = new LocalFsStorageProvider();
        if (await storageProvider.exists(page.storageKey)) {
          try {
            const cachedBuffer = await storageProvider.get(page.storageKey);
            const cachedMeta = await storageProvider.getMetadata(page.storageKey);

            if (pdfRenderer.isValidImage(cachedBuffer, cachedMeta.mimeType)) {
              const dimensions = pdfRenderer.dimensionsFromBuffer(cachedBuffer);
              imageBuffer = cachedBuffer;
              renderWidth = dimensions.width;
              renderHeight = dimensions.height;
              cached = true;
            }
          } catch {
            // Cache invalid — re-render below
          }
        }
      }

      // If not cached or render not done, render the page
      if (!imageBuffer) {
        // Ensure the original PDF is available
        const originalKey = generateStorageKey(
          String(activeWorkspace),
          datasheetId,
          "original"
        );
        let pdfBuffer: Buffer;

        try {
          pdfBuffer = await new LocalFsStorageProvider().get(originalKey);
        } catch {
          throw createError({
            statusCode: 404,
            statusMessage: "Original PDF not found for this datasheet.",
          });
        }

        // Render the page
        const pdfRenderer = new PdfRenderer(renderConfig, new LocalFsStorageProvider());
        const renderResult = await pdfRenderer.renderPage(
          String(activeWorkspace),
          datasheetId,
          pageNumber,
          renderConfig,
        );

        imageBuffer = renderResult.imageBuffer;
        renderWidth = renderResult.renderWidth;
        renderHeight = renderResult.renderHeight;
        cached = renderResult.cached;

        // Update the page record with render status
        await db
          .update(datasheetPages)
          .set({
            renderStatus: "done",
            renderFormat: renderConfig.format,
            renderedAt: new Date(),
            renderWidth: renderResult.renderWidth,
            renderHeight: renderResult.renderHeight,
            // Store the storage key for the rendered asset
            storageKey: renderResult.imageBuffer.length > 0 ? generateStorageKey(
              String(activeWorkspace),
              datasheetId,
              "page-" + pageNumber + "." + renderConfig.format
            ) : null,
          })
          .where(and(
            eq(datasheetPages.datasheetId, datasheetId),
            eq(datasheetPages.pageNumber, pageNumber),
          ));
      }

      // Set cache headers
      setHeader(event, "Content-Type", `image/${renderConfig.format}`);
      setHeader(event, "Cache-Control", "public, max-age=86400, stale-while-revalidate=86400");
      setHeader(event, "X-Original-Page-Number", String(page.pageNumber));
      setHeader(event, "X-Cached", cached ? "true" : "false");

      // Return page metadata and image
      setHeader(event, "Content-Type", "application/json");

      return {
        body: JSON.stringify({
          page: {
            id: page.id,
            pageNumber: page.pageNumber,
            width: page.width,
            height: page.height,
            text: page.text,
            renderStatus: page.renderStatus,
            renderFormat: page.renderFormat,
            renderedAt: page.renderedAt,
            renderWidth: page.renderWidth,
            renderHeight: page.renderHeight,
            storageKey: page.storageKey,
          },
          image: Buffer.from(imageBuffer).toString("base64"),
          cached,
        }),
        statusCode: 200,
      };
    } else {
      // Get all pages for this datasheet
      const allPages = await db
        .select({
          id: datasheetPages.id,
          pageNumber: datasheetPages.pageNumber,
          width: datasheetPages.width,
          height: datasheetPages.height,
          text: datasheetPages.text,
          renderStatus: datasheetPages.renderStatus,
          renderFormat: datasheetPages.renderFormat,
          renderedAt: datasheetPages.renderedAt,
          renderWidth: datasheetPages.renderWidth,
          renderHeight: datasheetPages.renderHeight,
          storageKey: datasheetPages.storageKey,
        })
        .from(datasheetPages)
        .where(eq(datasheetPages.datasheetId, datasheetId))
        .orderBy(datasheetPages.pageNumber);

      setHeader(event, "Content-Type", "application/json");

      return {
        body: JSON.stringify({
          datasheetId,
          totalPages: allPages.length,
          pages: allPages,
        }),
        statusCode: 200,
      };
    }
  } catch (error: any) {
    console.error("Pages error:", error);

    if (error.statusCode) {
      throw error;
    }

    throw createError({
      statusCode: 500,
      statusMessage: "Internal server error",
    });
  }
});
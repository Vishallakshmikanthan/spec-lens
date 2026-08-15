-- ============================================================
-- Migration 022: Add render columns to datasheet_pages
-- ============================================================

-- render_status: pending | failed | done
ALTER TABLE "datasheet_pages" ADD COLUMN IF NOT EXISTS "render_status" VARCHAR(50) DEFAULT 'pending';

-- render_format: png | webp
ALTER TABLE "datasheet_pages" ADD COLUMN IF NOT EXISTS "render_format" VARCHAR(10) DEFAULT 'webp';

-- rendered_at: timestamp of when the page was rendered
ALTER TABLE "datasheet_pages" ADD COLUMN IF NOT EXISTS "rendered_at" TIMESTAMP;

-- render_width: rendered page width in pixels
ALTER TABLE "datasheet_pages" ADD COLUMN IF NOT EXISTS "render_width" DOUBLE PRECISION;

-- render_height: rendered page height in pixels
ALTER TABLE "datasheet_pages" ADD COLUMN IF NOT EXISTS "render_height" DOUBLE PRECISION;
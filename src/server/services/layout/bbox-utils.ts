/**
 * Bounding box utility functions.
 * 
 * Keeps the canonical BoundingBox contract: normalized 0..1 relative to page.
 * Provides conversion, IoU calculation, and validation.
 */

import type { BoundingBox } from "@/types/speclens";

/** Normalize a rect from rendered-page pixels to 0..1 relative to page dimensions. */
export function normalizeBoundingBox(
  x: number,
  y: number,
  w: number,
  h: number,
  pageWidth: number,
  pageHeight: number,
): BoundingBox {
  return {
    x: Math.max(0, Math.min(1, x / pageWidth)),
    y: Math.max(0, Math.min(1, y / pageHeight)),
    w: Math.max(0, Math.min(1, w / pageWidth)),
    h: Math.max(0, Math.min(1, h / pageHeight)),
  };
}

/** Denormalize a normalized bbox to pixel coordinates given page dimensions. */
export function denormalizeBoundingBox(
  bbox: BoundingBox,
  pageWidth: number,
  pageHeight: number,
): { x: number; y: number; w: number; h: number } {
  return {
    x: bbox.x * pageWidth,
    y: bbox.y * pageHeight,
    w: bbox.w * pageWidth,
    h: bbox.h * pageHeight,
  };
}

/** Intersection over Union (IoU) for two normalized bounding boxes. */
export function computeIoU(
  bboxA: BoundingBox,
  bboxB: BoundingBox,
  pageWidth: number,
  pageHeight: number,
): number {
  const { x: ax, y: ay, w: aw, h: ah } = denormalizeBoundingBox(bboxA, pageWidth, pageHeight);
  const { x: bx, y: by, w: bw, h: bh } = denormalizeBoundingBox(bboxB, pageWidth, pageHeight);

  const intersectionX = Math.max(0, Math.min(ax + aw, bx + bw) - Math.max(ax, bx));
  const intersectionY = Math.max(0, Math.min(ay + ah, by + bh) - Math.max(ay, by));
  const intersectionArea = intersectionX * intersectionY;

  const areaA = aw * ah;
  const areaB = bw * bh;
  const unionArea = areaA + areaB - intersectionArea;

  return unionArea > 0 ? intersectionArea / unionArea : 0;
}

/** Check if a normalized bounding box is valid (within 0..1 bounds). */
export function isValidBoundingBox(bbox: BoundingBox): boolean {
  return (
    bbox.x >= 0 && bbox.x <= 1 &&
    bbox.y >= 0 && bbox.y <= 1 &&
    bbox.w > 0 && bbox.w <= 1 &&
    bbox.h > 0 && bbox.h <= 1
  );
}

/** Check if two normalized bounding boxes overlap with IoU above threshold. */
export function doBoundsOverlap(
  bboxA: BoundingBox,
  bboxB: BoundingBox,
  pageWidth: number,
  pageHeight: number,
  threshold: number = 0.1,
): boolean {
  return computeIoU(bboxA, bboxB, pageWidth, pageHeight) >= threshold;
}

/** Calculate the center point of a normalized bounding box. */
export function boundingBoxCenter(bbox: BoundingBox): { x: number; y: number } {
  return {
    x: bbox.x + bbox.w / 2,
    y: bbox.y + bbox.h / 2,
  };
}

/** Calculate the area of a normalized bounding box. */
export function boundingBoxArea(bbox: BoundingBox): number {
  return bbox.w * bbox.h;
}
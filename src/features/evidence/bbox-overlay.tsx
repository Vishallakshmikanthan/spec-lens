/**
 * BboxOverlay — the visual highlight for an evidence region on a page.
 *
 * Renders a normalized bounding box (0..1) onto an arbitrary viewBox, so it
 * works identically over the synthetic SVG page and (later) a real PDF render.
 * This is the canonical home of the feature; doc-page.tsx consumes it.
 */
import { cn } from "@/lib/utils";
import type { BoundingBox } from "@/types/speclens";

export interface BboxOverlayProps {
  bbox: BoundingBox;
  /** Pixel size of the page viewport the bbox is normalized against. */
  viewBox: { width: number; height: number };
  highlight?: boolean;
  className?: string;
}

export function BboxOverlay({ bbox, viewBox, highlight = false, className }: BboxOverlayProps) {
  const { width: W, height: H } = viewBox;
  const x = bbox.x * W;
  const y = bbox.y * H;
  const w = bbox.w * W;
  const h = bbox.h * H;

  const corners: [number, number][] = [
    [x, y],
    [x + w, y],
    [x, y + h],
    [x + w, y + h],
  ];

  return (
    <g className={className}>
      <rect
        x={x}
        y={y}
        width={w}
        height={h}
        className={cn(
          "fill-primary/15 stroke-primary strokeWidth-2",
          highlight && "animate-pulse-ring",
        )}
        rx={3}
      />
      {corners.map(([cx, cy], i) => (
        <rect
          key={i}
          x={cx - 4}
          y={cy - 4}
          width="8"
          height="8"
          className="fill-primary opacity-80"
        />
      ))}
      {highlight && (
        <circle
          cx={x + w / 2}
          cy={y + h / 2}
          r={Math.max(w, h) / 2 + 8}
          className="fill-none stroke-primary strokeWidth-1 animate-pulse-ring-opacity"
          fill="none"
        />
      )}
    </g>
  );
}

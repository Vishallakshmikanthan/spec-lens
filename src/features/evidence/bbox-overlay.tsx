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
        className={cn("fill-primary/10 stroke-primary", highlight && "animate-pulse-ring")}
        strokeWidth={1.5}
        rx={2}
      />
      {corners.map(([cx, cy], i) => (
        <rect key={i} x={cx - 2.5} y={cy - 2.5} width="5" height="5" className="fill-primary" />
      ))}
    </g>
  );
}

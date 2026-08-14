/**
 * BboxOverlay — the visual highlight for an evidence region on a page.
 *
 * Renders a normalized bounding box (0..1) onto an arbitrary viewBox, so it
 * works identically over the synthetic SVG page and (later) a real PDF render.
 * Styling intent: forensic, not flashy — a dimmed page, a precise frame and
 * machined corner ticks.
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
  const t = Math.max(6, Math.min(w, h) * 0.18);

  const ticks: string[] = [
    `M${x} ${y + t} L${x} ${y} L${x + t} ${y}`,
    `M${x + w - t} ${y} L${x + w} ${y} L${x + w} ${y + t}`,
    `M${x + w} ${y + h - t} L${x + w} ${y + h} L${x + w - t} ${y + h}`,
    `M${x + t} ${y + h} L${x} ${y + h} L${x} ${y + h - t}`,
  ];

  return (
    <g className={className}>
      {/* dim everything outside the region */}
      <path
        d={`M0 0 H${W} V${H} H0 Z M${x} ${y} H${x + w} V${y + h} H${x} Z`}
        fillRule="evenodd"
        className="fill-background/45"
      />
      <rect
        x={x}
        y={y}
        width={w}
        height={h}
        rx={1}
        className={cn("fill-primary/8 stroke-primary/70", highlight && "fill-primary/14")}
        strokeWidth={1}
      />
      {ticks.map((d, i) => (
        <path key={i} d={d} className="stroke-primary" strokeWidth={1.75} fill="none" />
      ))}
      {highlight && (
        <rect
          x={x - 3}
          y={y - 3}
          width={w + 6}
          height={h + 6}
          rx={2}
          fill="none"
          className="stroke-primary/40"
          strokeWidth={1}
          strokeDasharray="4 4"
        />
      )}
    </g>
  );
}

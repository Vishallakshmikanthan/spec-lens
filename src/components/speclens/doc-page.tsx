import { cn } from "@/lib/utils";
import { BboxOverlay } from "@/features/evidence/bbox-overlay";
import type { BoundingBox, EvidenceType } from "@/types/speclens";

/**
 * Synthetic datasheet page renderer.
 * Draws a PDF-like page (header, columns, figure) as vector graphics so the
 * demo shows realistic document structure without shipping binary PDFs.
 * When a real PDF renderer is wired in, this component is the swap point.
 * Supports zoom transformation so bounding boxes map correctly.
 */

interface DocPageProps {
  type?: EvidenceType;
  bbox?: BoundingBox | null;
  page?: number;
  title?: string;
  mpn?: string;
  className?: string;
  highlight?: boolean;
  zoom?: number;
  totalPages?: number;
}

export function DocPage({
  type = "other",
  bbox,
  page,
  title,
  mpn,
  className,
  highlight = false,
  zoom = 1,
  totalPages,
}: DocPageProps) {
  const W = 240;
  const H = 320;
  const effectiveW = Math.round(W * zoom);
  const effectiveH = Math.round(H * zoom);
  const lines = 10;

  const translateX = totalPages && page ? 0 : 0;
  const translateY = 0;

  return (
    <div className={cn("relative w-full", className)}>
      <svg
        viewBox={`0 0 ${effectiveW} ${effectiveH}`}
        className="block h-full w-full rounded-[3px] bg-foreground/[0.93] text-background/70 resize-x overflow-hidden"
        role="img"
        aria-label={`${title ?? "Datasheet"} page ${page ?? ""} of ${totalPages ?? ""} preview`}
        style={{ transform: `scale(${zoom})`, transformOrigin: "0 0" }}
      >
        {/* header band */}
        <rect x="0" y="0" width={effectiveW} height="26" className="fill-background/[0.06]" />
        <text
          x="14"
          y="17"
          className="fill-background/70"
          style={{ fontSize: 9 * zoom, fontWeight: 600, letterSpacing: 0.4 * zoom }}
        >
          {mpn ?? "DATASHEET"}
        </text>
        <text
          x={effectiveW - 14}
          y="17"
          textAnchor="end"
          className="fill-background/40"
          style={{ fontSize: 8 * zoom }}
        >
          {page ? `Page ${page}` : "SLxx"}
        </text>

        {/* body text lines */}
        {Array.from({ length: lines }).map((_, i) => (
          <rect
            key={i}
            x="14"
            y={38 + i * 8}
            width={i % 4 === 3 ? 120 : 212}
            height="3"
            rx="1.5"
            className="fill-background/25"
          />
        ))}

        {/* figure area */}
        <g
          transform={`translate(58, ${44 + lines * 8}) scale(1.05)`}
          className="text-background/75"
        >
          <Figure type={type} />
        </g>

        {/* footer lines */}
        {Array.from({ length: 4 }).map((_, i) => (
          <rect
            key={`f${i}`}
            x="14"
            y={effectiveH - 52 + i * 8}
            width={i === 3 ? 90 : 212}
            height="3"
            rx="1.5"
            className="fill-background/20"
          />
        ))}

        {bbox && (
          <BboxOverlay
            bbox={bbox}
            viewBox={{ width: effectiveW, height: effectiveH }}
            highlight={highlight}
          />
        )}
      </svg>
    </div>
  );
}

import { cn } from "@/lib/utils";
import type { BoundingBox, EvidenceType } from "@/lib/speclens/types";

/**
 * Synthetic datasheet page renderer.
 * Draws a PDF-like page (header, columns, figure) as vector graphics so the
 * demo shows realistic document structure without shipping binary PDFs.
 * When a real PDF renderer is wired in, this component is the swap point.
 */

function Figure({ type }: { type: EvidenceType }) {
  const stroke = "currentColor";
  switch (type) {
    case "pinout":
      return (
        <g stroke={stroke} strokeWidth="1.2" fill="none">
          <rect x="36" y="16" width="48" height="60" rx="3" />
          {[0, 1, 2, 3].map((i) => (
            <g key={`l${i}`}>
              <path d={`M36 ${26 + i * 15}H22`} />
              <circle cx="19" cy={26 + i * 15} r="2" />
            </g>
          ))}
          {[0, 1, 2, 3].map((i) => (
            <g key={`r${i}`}>
              <path d={`M84 ${26 + i * 15}H98`} />
              <circle cx="101" cy={26 + i * 15} r="2" />
            </g>
          ))}
          <circle cx="46" cy="26" r="3" />
        </g>
      );
    case "application-circuit":
      return (
        <g stroke={stroke} strokeWidth="1.2" fill="none">
          <path d="M20 30h18M20 62h18" />
          <path d="M38 18l34 22-34 22z" />
          <path d="M72 40h26M86 40v-18h-40M46 22v8" />
          <rect x="52" y="66" width="18" height="7" />
          <path d="M52 70H40v-8M70 70h12v-30" />
        </g>
      );
    case "timing":
      return (
        <g stroke={stroke} strokeWidth="1.2" fill="none">
          <path d="M18 26h10v-12h12v12h12v-12h12v12h12v-12h12v12h12" />
          <path d="M18 52h16v-12h20v12h16v-12h20v12h12" />
          <path d="M18 78h24v-12h14v12h24v-12h14v12h10" />
          <path d="M40 10v76M76 10v76" strokeDasharray="3 3" strokeOpacity="0.5" />
        </g>
      );
    case "electrical-curve":
      return (
        <g stroke={stroke} strokeWidth="1.2" fill="none">
          <path d="M20 82V14M20 82h84" />
          <path d="M22 26c22 2 30 10 38 26s16 24 42 26" />
          <path d="M22 40c24 4 34 14 44 28s14 14 36 16" strokeOpacity="0.5" />
          {[0, 1, 2, 3].map((i) => (
            <path key={i} d={`M20 ${28 + i * 16}h84`} strokeDasharray="2 4" strokeOpacity="0.28" />
          ))}
        </g>
      );
    case "mechanical":
    case "package":
      return (
        <g stroke={stroke} strokeWidth="1.2" fill="none">
          <rect x="32" y="24" width="56" height="44" rx="2" />
          <path d="M32 18h56M32 15v6M88 15v6" strokeOpacity="0.6" />
          <path d="M96 24v44M93 24h6M93 68h6" strokeOpacity="0.6" />
          {[0, 1, 2, 3].map((i) => (
            <rect key={i} x={38 + i * 14} y="68" width="8" height="8" />
          ))}
          {[0, 1, 2, 3].map((i) => (
            <rect key={`t${i}`} x={38 + i * 14} y="16" width="8" height="8" strokeOpacity="0.35" />
          ))}
        </g>
      );
    case "block-diagram":
    case "functional-diagram":
      return (
        <g stroke={stroke} strokeWidth="1.2" fill="none">
          <rect x="16" y="20" width="28" height="20" rx="2" />
          <rect x="16" y="56" width="28" height="20" rx="2" />
          <rect x="60" y="20" width="30" height="20" rx="2" />
          <rect x="60" y="56" width="30" height="20" rx="2" />
          <path d="M44 30h16M44 66h16M75 40v16M30 40v16" />
        </g>
      );
    case "table":
    case "absolute-maximum":
      return (
        <g stroke={stroke} strokeWidth="1" fill="none">
          <rect x="14" y="16" width="92" height="64" />
          {[1, 2, 3, 4, 5].map((i) => (
            <path key={i} d={`M14 ${16 + i * 10.6}h92`} strokeOpacity={i === 1 ? 1 : 0.4} />
          ))}
          <path d="M52 16v64M78 16v64" strokeOpacity="0.4" />
        </g>
      );
    default:
      return (
        <g stroke={stroke} strokeWidth="1.2" fill="none">
          <rect x="24" y="20" width="72" height="56" rx="2" />
          <path d="M24 60l20-18 16 14 14-12 22 20" />
        </g>
      );
  }
}

export interface DocPageProps {
  type?: EvidenceType;
  bbox?: BoundingBox | null;
  page?: number;
  title?: string;
  mpn?: string;
  className?: string;
  highlight?: boolean;
  dense?: boolean;
}

export function DocPage({
  type = "other",
  bbox,
  page,
  title,
  mpn,
  className,
  highlight = false,
  dense = false,
}: DocPageProps) {
  const W = 240;
  const H = 320;
  const lines = dense ? 6 : 10;

  return (
    <div className={cn("relative w-full", className)}>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="block h-full w-full rounded-[3px] bg-foreground/[0.93] text-background/70"
        role="img"
        aria-label={`${title ?? "Datasheet"} page ${page ?? ""} preview`}
      >
        {/* header band */}
        <rect x="0" y="0" width={W} height="26" className="fill-background/[0.06]" />
        <text
          x="14"
          y="17"
          className="fill-background/70"
          style={{ fontSize: 9, fontWeight: 600, letterSpacing: 0.4 }}
        >
          {mpn ?? "DATASHEET"}
        </text>
        <text x={W - 14} y="17" textAnchor="end" className="fill-background/40" style={{ fontSize: 8 }}>
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
        <g transform={`translate(58, ${44 + lines * 8}) scale(1.05)`} className="text-background/75">
          <Figure type={type} />
        </g>

        {/* footer lines */}
        {Array.from({ length: 4 }).map((_, i) => (
          <rect
            key={`f${i}`}
            x="14"
            y={H - 52 + i * 8}
            width={i === 3 ? 90 : 212}
            height="3"
            rx="1.5"
            className="fill-background/20"
          />
        ))}

        {bbox && (
          <g>
            <rect
              x={bbox.x * W}
              y={bbox.y * H}
              width={bbox.w * W}
              height={bbox.h * H}
              className={cn(
                "fill-primary/10 stroke-primary",
                highlight && "animate-pulse-ring",
              )}
              strokeWidth="1.5"
              rx="2"
            />
            {(
              [
                [bbox.x * W, bbox.y * H],
                [(bbox.x + bbox.w) * W, bbox.y * H],
                [bbox.x * W, (bbox.y + bbox.h) * H],
                [(bbox.x + bbox.w) * W, (bbox.y + bbox.h) * H],
              ] as [number, number][]
            ).map(([cx, cy], i) => (
              <rect
                key={i}
                x={cx - 2.5}
                y={cy - 2.5}
                width="5"
                height="5"
                className="fill-primary"
              />
            ))}
          </g>
        )}
      </svg>
    </div>
  );
}

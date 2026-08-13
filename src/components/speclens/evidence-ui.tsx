import {
  AlertTriangle,
  Box,
  CircuitBoard,
  Cpu,
  Grid3x3,
  LineChart,
  Layers,
  Ruler,
  ShieldCheck,
  Shapes,
  Table2,
  Waves,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { EVIDENCE_TYPE_LABEL } from "@/lib/speclens/mock-data";
import type { EvidenceType, VerificationState } from "@/lib/speclens/types";

export const evidenceIcon: Record<EvidenceType, LucideIcon> = {
  pinout: Cpu,
  package: Box,
  "block-diagram": Layers,
  timing: Waves,
  "application-circuit": CircuitBoard,
  "electrical-curve": LineChart,
  mechanical: Ruler,
  table: Table2,
  "absolute-maximum": AlertTriangle,
  "functional-diagram": Shapes,
  other: Grid3x3,
};

export function EvidenceTypeBadge({ type, className }: { type: EvidenceType; className?: string }) {
  const Icon = evidenceIcon[type];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-sm border border-border bg-secondary px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground",
        className,
      )}
    >
      <Icon className="size-3 text-primary" aria-hidden="true" />
      {EVIDENCE_TYPE_LABEL[type]}
    </span>
  );
}

export function VerificationBadge({
  state,
  className,
}: {
  state: VerificationState;
  className?: string;
}) {
  const map = {
    verified: { label: "Verified", cls: "text-success border-success/30 bg-success/10" },
    unverified: { label: "Unverified", cls: "text-muted-foreground border-border bg-secondary" },
    flagged: { label: "Flagged", cls: "text-warning border-warning/30 bg-warning/10" },
  } as const;
  const item = map[state];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-sm border px-1.5 py-0.5 text-[10px] font-medium",
        item.cls,
        className,
      )}
    >
      {state === "verified" && <ShieldCheck className="size-3" aria-hidden="true" />}
      {item.label}
    </span>
  );
}

export function ConfidenceBar({
  value,
  className,
  showValue = true,
}: {
  value: number;
  className?: string;
  showValue?: boolean;
}) {
  const pct = Math.round(value * 1000) / 10;
  const tone = value >= 0.93 ? "bg-success" : value >= 0.85 ? "bg-primary" : "bg-warning";
  return (
    <div className={cn("flex items-center gap-2", className)}>
      <div
        className="h-1 w-full overflow-hidden rounded-full bg-muted"
        role="meter"
        aria-valuenow={pct}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label="Confidence"
      >
        <div
          className={cn("h-full rounded-full transition-[width] duration-700 ease-out", tone)}
          style={{ width: `${pct}%` }}
        />
      </div>
      {showValue && (
        <span className="shrink-0 font-mono text-[11px] tabular-nums text-muted-foreground">
          {pct.toFixed(1)}%
        </span>
      )}
    </div>
  );
}

export function StatDelta({ delta, positive }: { delta: string; positive: boolean }) {
  return (
    <span className={cn("font-mono text-[11px]", positive ? "text-success" : "text-warning")}>
      {delta}
    </span>
  );
}

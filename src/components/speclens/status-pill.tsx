import { cn } from "@/lib/utils";
import type { IndexStatus } from "@/lib/speclens/types";

const map: Record<IndexStatus, { label: string; cls: string }> = {
  indexed: { label: "Indexed", cls: "text-success border-success/30 bg-success/10" },
  indexing: { label: "Indexing", cls: "text-primary border-primary/30 bg-primary/10" },
  queued: { label: "Queued", cls: "text-muted-foreground border-border bg-secondary" },
  failed: { label: "Failed", cls: "text-destructive border-destructive/30 bg-destructive/10" },
};

export function StatusPill({ status, className }: { status: IndexStatus; className?: string }) {
  const s = map[status];
  return (
    <span className={cn("inline-flex shrink-0 items-center gap-1.5 rounded-sm border px-2 py-0.5 text-[11px]", s.cls, className)}>
      {status === "indexing" && <span className="size-1.5 animate-pulse rounded-full bg-primary" />}
      {s.label}
    </span>
  );
}

import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import {
  Copy,
  Download,
  Maximize2,
  Minus,
  Plus,
  ChevronLeft,
  ChevronRight,
  ArrowRight,
} from "lucide-react";
import { PageHeader } from "@/components/speclens/primitives";
import { DocPage } from "@/components/speclens/doc-page";
import { Button } from "@/components/ui/button";
import {
  ConfidenceBar,
  EvidenceTypeBadge,
  VerificationBadge,
} from "@/components/speclens/evidence-ui";
import type { BoundingBox } from "@/types/speclens";
import { mockEvidence } from "@/lib/speclens/mock-data";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/app/evidence")({
  head: () => ({
    meta: [
      { title: "Evidence Explorer — SpecLens" },
      {
        name: "description",
        content:
          "Inspect exact document regions with bounding boxes, provenance, confidence and verification state.",
      },
      { property: "og:title", content: "Evidence Explorer — SpecLens" },
      {
        property: "og:description",
        content:
          "Inspect exact document regions with bounding boxes, provenance, confidence and verification state.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  validateSearch: (s: Record<string, unknown>) => ({
    doc: typeof s["doc"] === "string" ? s["doc"] : undefined,
    ev: typeof s["ev"] === "string" ? s["ev"] : undefined,
  }),
  component: EvidenceExplorer,
});

const TRAIL = ["Search", "Result", "Evidence", "Region", "Provenance", "Verification"];

function EvidenceExplorer() {
  const { doc, ev } = Route.useSearch();
  const pool = doc ? mockEvidence.filter((e) => e.documentId === doc) : mockEvidence;
  const list = pool.length ? pool : mockEvidence;
  const [selectedId, setSelectedId] = useState(ev ?? list[0]!.id);
  const [zoom, setZoom] = useState(1);
  const [zoomTarget, setZoomTarget] = useState(1);
  const [raw, setRaw] = useState(false);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(243);
  const evidence = list.find((e) => e.id === selectedId) ?? list[0]!;

  const [highlightedBbox, setHighlightedBbox] = useState<BoundingBox | null>(null);

  useEffect(() => {
    const e = list.find((x) => x.id === selectedId);
    if (e) {
      setHighlightedBbox(e.bbox);
      setPage(e.page);
      setTotalPages(e.totalPages);
      setZoomTarget(1);
    }
  }, [selectedId, list]);

  useEffect(() => {
    const id = setTimeout(() => setZoom(zoomTarget), 120);
    return () => clearTimeout(id);
  }, [zoomTarget]);

  const prevPage = () => setPage((p) => Math.max(1, p - 1));
  const nextPage = () => setPage((p) => Math.min(totalPages || 1, p + 1));
  const handleZoom = (delta: number) =>
    setZoomTarget((z) => Math.max(0.6, Math.min(2, Number((z + delta).toFixed(2)))));

  return (
    <div className="min-w-0">
      <PageHeader
        title="Evidence Explorer"
        subtitle="Trace an answer to its exact document region, provenance and verification."
      />

      {/* provenance trail */}
      <div className="flex flex-wrap items-center gap-1.5 border-b border-border px-4 py-2.5 sm:px-6">
        {TRAIL.map((step, i) => (
          <span key={step} className="flex items-center gap-1.5">
            <span
              className={cn(
                "label-mono rounded-sm border px-1.5 py-0.5",
                i <= 3
                  ? "border-primary/40 bg-primary/10 text-foreground"
                  : "border-border text-muted-foreground",
              )}
            >
              {step}
            </span>
            {i < TRAIL.length - 1 && (
              <ArrowRight className="size-3 text-muted-foreground/50" aria-hidden="true" />
            )}
          </span>
        ))}
      </div>

      <div className="grid min-w-0 grid-cols-1 lg:grid-cols-[248px_minmax(0,1fr)] xl:grid-cols-[248px_minmax(0,1fr)_368px]">
        {/* Region rail */}
        <aside className="min-w-0 border-b border-border lg:border-b-0 lg:border-r">
          <p className="label-mono border-b border-border px-4 py-2.5">
            Regions · {list.length}
          </p>
          <ul className="max-h-[240px] overflow-y-auto lg:max-h-[calc(100vh-190px)]">
            {list.map((e) => {
              const active = e.id === evidence.id;
              return (
                <li key={e.id}>
                  <button
                    onClick={() => setSelectedId(e.id)}
                    aria-current={active}
                    className={cn(
                      "w-full border-b border-border/70 px-4 py-3 text-left transition-colors",
                      active ? "bg-primary/10" : "hover:bg-secondary/60",
                    )}
                  >
                    <span
                      className={cn(
                        "block truncate text-[12.5px] font-medium",
                        active ? "text-foreground" : "text-foreground/80",
                      )}
                    >
                      {e.title}
                    </span>
                    <span className="mt-1 flex items-center justify-between font-mono text-[10.5px] text-muted-foreground">
                      <span>
                        {e.mpn} · p{e.page}
                      </span>
                      <span className={active ? "text-primary" : ""}>
                        {(e.confidence * 100).toFixed(0)}%
                      </span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </aside>

        {/* Document viewer */}
        <section className="min-w-0 xl:border-r xl:border-border">
          <div className="flex flex-wrap items-center gap-2 border-b border-border px-4 py-2.5 sm:px-6">
            <div className="flex overflow-hidden rounded-md border border-border">
              <button
                onClick={prevPage}
                aria-label="Previous page"
                className="px-2 py-1.5 transition-colors hover:bg-secondary"
              >
                <ChevronLeft className="size-3.5" />
              </button>
              <span className="border-x border-border px-3 py-1.5 font-mono text-[11.5px]">
                {page} / {totalPages}
              </span>
              <button
                onClick={nextPage}
                aria-label="Next page"
                className="px-2 py-1.5 transition-colors hover:bg-secondary"
              >
                <ChevronRight className="size-3.5" />
              </button>
            </div>
            <div className="flex overflow-hidden rounded-md border border-border">
              <button
                onClick={() => handleZoom(-0.2)}
                className="px-2 py-1.5 transition-colors hover:bg-secondary"
                aria-label="Zoom out"
              >
                <Minus className="size-3.5" />
              </button>
              <span className="border-x border-border px-3 py-1.5 font-mono text-[11.5px]">
                {Math.round(zoom * 100)}%
              </span>
              <button
                onClick={() => handleZoom(0.2)}
                className="px-2 py-1.5 transition-colors hover:bg-secondary"
                aria-label="Zoom in"
              >
                <Plus className="size-3.5" />
              </button>
            </div>
            <Button variant="outline" size="sm" onClick={() => setZoomTarget(1)}>
              Fit width
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => toast.info("Fullscreen inspection requires the SpecLens backend.")}
            >
              <Maximize2 className="size-3.5" />
              Fullscreen
            </Button>
            <span className="ml-auto font-mono text-[10.5px] uppercase tracking-[0.14em] text-muted-foreground">
              {evidence.documentId}
            </span>
          </div>

          <div className="grid-bg p-6 sm:p-10">
            <div className="framed mx-auto max-w-[560px] shadow-[var(--shadow-lift)]">
              <DocPage
                type={evidence.type}
                mpn={evidence.mpn}
                page={page}
                bbox={highlightedBbox}
                highlight={page === evidence.page}
                zoom={1}
                totalPages={totalPages}
              />
            </div>
            <p className="mt-4 text-center font-mono text-[10.5px] text-muted-foreground">
              {page === evidence.page
                ? `Region ${evidence.id} highlighted on page ${page}`
                : `No region for page ${page} — evidence lives on page ${evidence.page}`}
            </p>
          </div>
        </section>

        {/* Metadata rail */}
        <aside className="min-w-0 space-y-5 border-t border-border p-4 sm:p-6 xl:border-t-0">
          <div className="space-y-2">
            <EvidenceTypeBadge type={evidence.type} />
            <h2 className="text-[15px] font-medium leading-snug">{evidence.title}</h2>
            <p className="text-[12.5px] leading-relaxed text-muted-foreground">
              {evidence.caption}
            </p>
          </div>

          <div className="panel space-y-3 p-4">
            <div className="flex items-center justify-between gap-3">
              <span className="label-mono">Confidence</span>
              <span className="font-mono text-[12px]">
                {(evidence.confidence * 100).toFixed(1)}%
              </span>
            </div>
            <ConfidenceBar value={evidence.confidence} />
            <div className="flex items-center justify-between gap-2 border-t border-border pt-3">
              <VerificationBadge state={evidence.verification} />
              <span className="font-mono text-[11px] text-muted-foreground">{evidence.id}</span>
            </div>
          </div>

          <dl className="grid grid-cols-2 gap-x-4 gap-y-3 border-t border-border pt-4 text-[12.5px]">
            {[
              ["Document", evidence.documentId],
              ["MPN", evidence.mpn],
              ["Page", `${evidence.page} / ${evidence.totalPages}`],
              ["Retrieval score", evidence.retrievalScore.toFixed(3)],
              ["Model version", evidence.modelVersion],
              ["Matched by", evidence.matchedBy.join(", ")],
            ].map(([k, v]) => (
              <div key={k}>
                <dt className="label-mono">{k}</dt>
                <dd className="mt-0.5 truncate font-mono text-[11.5px]">{v}</dd>
              </div>
            ))}
          </dl>

          <details className="border-t border-border pt-4">
            <summary className="cursor-pointer text-[12.5px] text-muted-foreground transition-colors hover:text-foreground">
              Technical metadata
            </summary>
            <dl className="mt-3 space-y-2 text-[12px]">
              <div>
                <dt className="label-mono">Bounding box</dt>
                <dd className="font-mono text-[11px]">
                  x {highlightedBbox?.x.toFixed(3)} · y {highlightedBbox?.y.toFixed(3)} · w{" "}
                  {highlightedBbox?.w.toFixed(3)} · h {highlightedBbox?.h.toFixed(3)}
                </dd>
              </div>
              <div>
                <dt className="label-mono">Crop URI</dt>
                <dd className="break-all font-mono text-[11px]">{evidence.cropUri}</dd>
              </div>
              <div>
                <dt className="label-mono">Timestamp</dt>
                <dd className="font-mono text-[11px]">{evidence.timestamp}</dd>
              </div>
            </dl>
            <Button variant="ghost" size="sm" className="mt-3" onClick={() => setRaw((r) => !r)}>
              {raw ? "Hide" : "View"} raw metadata
            </Button>
            {raw && (
              <pre className="mt-2 overflow-x-auto rounded-md border border-border bg-background p-3 font-mono text-[10.5px]">
                {JSON.stringify(evidence, null, 2)}
              </pre>
            )}
          </details>

          <div className="flex flex-wrap gap-2 border-t border-border pt-4">
            <Button asChild size="sm" variant="secondary">
              <Link to="/app/datasheets">Open document</Link>
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                void navigator.clipboard?.writeText(evidence.id);
                toast.success(`Copied ${evidence.id}`);
              }}
            >
              <Copy className="size-3.5" />
              Copy ID
            </Button>
            <Button asChild size="sm" variant="ghost">
              <Link to="/app/collections">Add to collection</Link>
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => toast.info("Export requires the SpecLens backend.")}
            >
              <Download className="size-3.5" />
              Export
            </Button>
          </div>
        </aside>
      </div>
    </div>
  );
}

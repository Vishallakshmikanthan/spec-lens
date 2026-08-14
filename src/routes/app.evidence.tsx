import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, useEffect, useRef, useCallback } from "react";
import { Copy, Download, Maximize2, Minus, Plus, ChevronLeft, ChevronRight } from "lucide-react";
import { PageHeader, DemoNotice } from "@/components/speclens/primitives";
import { DocPage } from "@/components/speclens/doc-page";
import { Button } from "@/components/ui/button";
import {
  ConfidenceBar,
  EvidenceTypeBadge,
  VerificationBadge,
} from "@/components/speclens/evidence-ui";
import { BboxOverlay } from "@/features/evidence/bbox-overlay";
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
  const selected = list.find((e) => e.id === selectedId) ?? list[0]!;

  // Track bbox highlight state
  const [highlightedBbox, setHighlightedBbox] = useState<BoundingBox | null>(null);
  const [highlightedId, setHighlightedId] = useState<string | null>(null);

  // Effect: sync bbox when selection changes
  useEffect(() => {
    const e = list.find((x) => x.id === selectedId);
    if (e) {
      setHighlightedBbox(e.bbox);
      setHighlightedId(e.id);
      setPage(e.page);
      setTotalPages(e.totalPages);
      setZoomTarget(1);
    }
  }, [selectedId, list]);

  // Smooth zoom animation
  useEffect(() => {
    const id = setTimeout(() => setZoom(zoomTarget), 150);
    return () => clearTimeout(id);
  }, [zoomTarget]);

  const goToPage = (targetPage: number) => {
    setPage(targetPage);
    setZoomTarget(1);
  };

  const prevPage = () => {
    if (selected.page > 1) goToPage(selected.page - 1);
  };
  const nextPage = () => {
    if (selected.page < (selected.totalPages || 1)) goToPage(selected.page + 1);
  };

  const handleZoom = (delta: number) => {
    setZoomTarget(Math.max(0.6, Math.min(2, zoomTarget + delta)));
  };

  const evidence = selected;

  // PIN CONFIGURATION for pinout types
  const pinConfig =
    evidence.type === "pinout" ? (
      <div className="grid grid-cols-2 gap-2 text-[10px]">
        <div>
          <span className="font-mono text-[9px] text-primary uppercase tracking-[0.1em]">Pin</span>
          <span className="font-mono text-[9px] text-foreground">Name</span>
        </div>
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="border-t border-border/50 pt-1">
            <span className="font-mono text-[9px] text-primary">{i}</span>
            <span className="font-mono text-[9px] ml-2 text-foreground">
              {evidence.id === "EV-0017" && i === 1
                ? "OUT1"
                : i === 2
                  ? "IN1-"
                  : i === 3
                    ? "IN1+"
                    : "GND"}
            </span>
          </div>
        ))}
        {[5, 6, 7, 8].map((i) => (
          <div key={i + 4} className="border-t border-border/50 pt-1">
            <span className="font-mono text-[9px] text-primary">{i}</span>
            <span className="font-mono text-[9px] ml-2 text-foreground">
              {evidence.id === "EV-0017" && i === 5
                ? "IN2+"
                : i === 6
                  ? "IN2-"
                  : i === 7
                    ? "OUT2"
                    : "V+"}
            </span>
          </div>
        ))}
      </div>
    ) : null;

  return (
    <div>
      <PageHeader
        title="Evidence Explorer"
        subtitle="Document region, provenance and verification in one view."
      />
      <div className="max-w-[1400px] mx-auto grid gap-4 sm:grid-cols-[1fr_360px] sm:grid-rows-[auto_1fr] lg:grid-cols-[1fr_360px] lg:grid-rows-[auto_1fr] xl:grid-cols-[1fr_420px]">
        <div className="lg:col-span-1 lg:row-span-1">
          <div className="border-b border-border sm:p-6 lg:border-0">
            <div className="mb-3 flex flex-wrap items-center gap-2">
              <div className="flex overflow-hidden rounded-md border border-border">
                <button
                  onClick={prevPage}
                  aria-label="Previous page"
                  className="px-2 py-1.5 hover:bg-secondary"
                >
                  <ChevronLeft className="size-3.5" />
                </button>
                <span className="border-x border-border px-3 py-1.5 font-mono text-[11.5px]">
                  {page} / {totalPages}
                </span>
                <button
                  onClick={nextPage}
                  aria-label="Next page"
                  className="px-2 py-1.5 hover:bg-secondary"
                >
                  <ChevronRight className="size-3.5" />
                </button>
              </div>
              <div className="flex overflow-hidden rounded-md border border-border">
                <button
                  onClick={() => handleZoom(-0.2)}
                  className="px-2 py-1.5 hover:bg-secondary"
                  aria-label="Zoom out"
                >
                  <Minus className="size-3.5" />
                </button>
                <span className="border-x border-border px-3 py-1.5 font-mono text-[11.5px]">
                  {Math.round(zoom * 100)}%
                </span>
                <button
                  onClick={() => handleZoom(0.2)}
                  className="px-2 py-1.5 hover:bg-secondary"
                  aria-label="Zoom in"
                >
                  <Plus className="size-3.5" />
                </button>
              </div>
              <Button variant="outline" size="sm" onClick={() => setZoomTarget(1)}>
                Fit width
              </Button>
              <Button variant="ghost" size="sm">
                <Maximize2 className="size-3.5" />
                Fullscreen
              </Button>
            </div>

            <div className="panel p-6 sm:p-8 overflow-auto bg-background/60">
              <DocPage
                type={evidence.type}
                mpn={evidence.mpn}
                page={page}
                bbox={highlightedBbox}
                highlight={highlightedId === evidence.id}
                zoom={zoom}
                totalPages={totalPages}
              />
            </div>

            {/* Evidence Crop Preview */}
            {evidence.cropUri && (
              <div className="mt-6 p-4 border-t border-border bg-background/50">
                <h3 className="text-[12px] font-medium uppercase tracking-[0.1em] text-muted-foreground mb-3">
                  Evidence Crop
                </h3>
                <div className="relative aspect-square rounded-md overflow-hidden bg-muted">
                  <img
                    src={evidence.cropUri}
                    alt={`Evidence crop — ${evidence.id}`}
                    className="w-full h-full object-contain"
                    style={{
                      transform: `scale(${Math.min(1, 400 / 400)})`,
                    }}
                  />
                  <div className="absolute inset-0 fill-primary/20 rounded-md opacity-0 hover:opacity-50 transition-opacity" />
                  <div className="absolute top-2 left-2 flex gap-1">
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => {
                        void navigator.clipboard?.writeText(evidence.id);
                        toast.success(`Copied ${evidence.id}`);
                      }}
                    >
                      <Copy className="size-3.5" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => toast.info("Download placeholder - right click to save")}
                    >
                      <Download className="size-3.5" />
                    </Button>
                  </div>
                </div>
                <p className="text-[10px] text-muted-foreground mt-2 text-center">
                  {evidence.type === "pinout"
                    ? "Zoomable pin configuration"
                    : "Evidence region crop"}
                </p>
              </div>
            )}
          </div>
        </div>

        <aside className="sm:col-span-2 lg:col-span-2 lg:row-span-1 space-y-5 p-4 sm:p-6 lg:p-8">
          <div className="space-y-2">
            <EvidenceTypeBadge type={evidence.type} />
            <h2 className="text-[15px] font-medium">{evidence.title}</h2>
            <p className="text-[12.5px] text-muted-foreground">{evidence.caption}</p>
          </div>

          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <p className="mb-0.5 font-mono text-[10.5px] uppercase tracking-[0.14em] text-muted-foreground">
                Confidence
              </p>
              <ConfidenceBar value={evidence.confidence} />
            </div>

            <div className="flex items-center gap-2">
              <VerificationBadge state={evidence.verification} />
              <span className="font-mono text-[11px] text-muted-foreground">{evidence.id}</span>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-[12px] text-muted-foreground">Page</span>
              <span className="font-mono text-[11px] text-foreground">
                {page} / {totalPages}
              </span>
            </div>

            <dl className="grid grid-cols-2 gap-3 border-t border-border pt-3 text-[12.5px]">
              {[
                ["Document", evidence.documentId],
                ["MPN", evidence.mpn],
                ["Region", evidence.id],
                ["Page", `${page} / ${totalPages}`],
                ["Retrieval score", evidence.retrievalScore.toFixed(3)],
                ["Model version", evidence.modelVersion],
              ].map(([k, v]) => (
                <div key={k}>
                  <dt className="text-muted-foreground">{k}</dt>
                  <dd className="truncate font-mono text-[11.5px]">{v}</dd>
                </div>
              ))}
            </dl>

            <details className="border-t border-border pt-3">
              <summary className="cursor-pointer text-[12.5px] text-muted-foreground">
                Technical metadata
              </summary>
              <dl className="mt-3 space-y-2 text-[12px]">
                <div>
                  <dt className="text-muted-foreground">Bounding box</dt>
                  <dd className="font-mono text-[11px]">
                    x {highlightedBbox?.x.toFixed(3)} · y{highlightedBbox?.y.toFixed(3)}· w{" "}
                    {highlightedBbox?.w.toFixed(3)} · h{highlightedBbox?.h.toFixed(3)}
                  </dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Crop URI</dt>
                  <dd className="break-all font-mono text-[11px]">{evidence.cropUri}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Region type</dt>
                  <dd className="font-mono text-[11px]">{evidence.type}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Caption</dt>
                  <dd className="break-all font-mono text-[11px]">{evidence.caption}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Retrieval score</dt>
                  <dd className="font-mono text-[11px]">{evidence.retrievalScore.toFixed(3)}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Verification</dt>
                  <dd className="font-mono text-[11px]">{evidence.verification}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Provenance</dt>
                  <dd className="font-mono text-[11px]">
                    {evidence.documentId} · {evidence.mpn} · Page{evidence.page}· {evidence.type}
                  </dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Matched by</dt>
                  <dd className="font-mono text-[11px]">{evidence.matchedBy.join(", ")}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Timestamp</dt>
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
          </div>

          <div className="mt-5 pt-5 border-t border-border gap-3">
            <div className="flex flex-wrap gap-2">
              {pinConfig}

              <Button
                size="sm"
                variant="secondary"
                onClick={() => {
                  window.open(`/app/evidence?doc=${evidence.documentId}`, "_blank");
                }}
              >
                Open Full Page
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
                Copy Evidence ID
              </Button>
              <Button asChild size="sm" variant="ghost">
                <Link to="/app/collections">Add to Collection</Link>
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
          </div>
        </aside>
      </div>
    </div>
  );
}

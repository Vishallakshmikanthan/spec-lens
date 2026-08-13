import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { Copy, Download, Maximize2, Minus, Plus, ChevronLeft, ChevronRight } from "lucide-react";
import { PageHeader, DemoNotice } from "@/components/speclens/primitives";
import { DocPage } from "@/components/speclens/doc-page";
import { Button } from "@/components/ui/button";
import {
  ConfidenceBar,
  EvidenceTypeBadge,
  VerificationBadge,
} from "@/components/speclens/evidence-ui";
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
  const [raw, setRaw] = useState(false);
  const selected = list.find((e) => e.id === selectedId) ?? list[0]!;

  return (
    <div>
      <PageHeader
        title="Evidence Explorer"
        subtitle="Document region, provenance and verification in one view."
      />
      <div className="grid gap-0 lg:grid-cols-[1fr_360px]">
        <div className="border-b border-border p-4 sm:p-6 lg:border-b-0 lg:border-r">
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <div className="flex overflow-hidden rounded-md border border-border">
              <button className="px-2 py-1.5 hover:bg-secondary" aria-label="Previous page">
                <ChevronLeft className="size-3.5" />
              </button>
              <span className="border-x border-border px-3 py-1.5 font-mono text-[11.5px]">
                {selected.page} / {selected.totalPages}
              </span>
              <button className="px-2 py-1.5 hover:bg-secondary" aria-label="Next page">
                <ChevronRight className="size-3.5" />
              </button>
            </div>
            <div className="flex overflow-hidden rounded-md border border-border">
              <button
                onClick={() => setZoom((z) => Math.max(0.6, z - 0.2))}
                className="px-2 py-1.5 hover:bg-secondary"
                aria-label="Zoom out"
              >
                <Minus className="size-3.5" />
              </button>
              <span className="border-x border-border px-3 py-1.5 font-mono text-[11.5px]">
                {Math.round(zoom * 100)}%
              </span>
              <button
                onClick={() => setZoom((z) => Math.min(2, z + 0.2))}
                className="px-2 py-1.5 hover:bg-secondary"
                aria-label="Zoom in"
              >
                <Plus className="size-3.5" />
              </button>
            </div>
            <Button variant="outline" size="sm" onClick={() => setZoom(1)}>
              Fit width
            </Button>
            <Button variant="ghost" size="sm">
              <Maximize2 className="size-3.5" />
              Fullscreen
            </Button>
          </div>

          <div className="panel flex justify-center overflow-auto bg-background/60 p-6">
            <div
              style={{ width: `${Math.round(320 * zoom)}px` }}
              className="transition-[width] duration-200"
            >
              <DocPage
                type={selected.type}
                mpn={selected.mpn}
                page={selected.page}
                bbox={selected.bbox}
                highlight
              />
            </div>
          </div>

          <ul className="mt-4 flex gap-2 overflow-x-auto pb-2">
            {list.map((e) => (
              <li key={e.id}>
                <button
                  onClick={() => setSelectedId(e.id)}
                  aria-pressed={e.id === selected.id}
                  className={cn(
                    "w-16 shrink-0 rounded border p-1 transition-colors",
                    e.id === selected.id
                      ? "border-primary"
                      : "border-border hover:border-border-strong",
                  )}
                >
                  <DocPage type={e.type} mpn={e.mpn} bbox={e.bbox} dense />
                  <span className="mt-1 block font-mono text-[9.5px] text-muted-foreground">
                    p{e.page}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </div>

        <aside className="space-y-5 p-4 sm:p-6">
          <div className="space-y-2">
            <EvidenceTypeBadge type={selected.type} />
            <h2 className="text-[15px] font-medium">{selected.title}</h2>
            <p className="text-[12.5px] text-muted-foreground">{selected.caption}</p>
          </div>

          <div>
            <p className="mb-1.5 font-mono text-[10.5px] uppercase tracking-[0.14em] text-muted-foreground">
              Confidence
            </p>
            <ConfidenceBar value={selected.confidence} />
          </div>

          <div className="flex items-center gap-2">
            <VerificationBadge state={selected.verification} />
            <span className="font-mono text-[11px] text-muted-foreground">{selected.id}</span>
          </div>

          <dl className="grid grid-cols-2 gap-3 border-t border-border pt-4 text-[12.5px]">
            {[
              ["Document", selected.documentId],
              ["MPN", selected.mpn],
              ["Manufacturer", selected.manufacturer],
              ["Page", `${selected.page} / ${selected.totalPages}`],
              ["Retrieval score", selected.retrievalScore.toFixed(3)],
              ["Model version", selected.modelVersion],
            ].map(([k, v]) => (
              <div key={k}>
                <dt className="text-muted-foreground">{k}</dt>
                <dd className="truncate font-mono text-[11.5px]">{v}</dd>
              </div>
            ))}
          </dl>

          <details className="border-t border-border pt-4">
            <summary className="cursor-pointer text-[12.5px] text-muted-foreground">
              Technical metadata
            </summary>
            <dl className="mt-3 space-y-2 text-[12px]">
              <div>
                <dt className="text-muted-foreground">Bounding box</dt>
                <dd className="font-mono text-[11px]">
                  x {selected.bbox.x} · y {selected.bbox.y} · w {selected.bbox.w} · h{" "}
                  {selected.bbox.h}
                </dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Crop URI</dt>
                <dd className="break-all font-mono text-[11px]">{selected.cropUri}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Timestamp</dt>
                <dd className="font-mono text-[11px]">{selected.timestamp}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Retrieval method</dt>
                <dd className="font-mono text-[11px]">{selected.matchedBy.join(", ")}</dd>
              </div>
            </dl>
            <Button variant="ghost" size="sm" className="mt-3" onClick={() => setRaw((r) => !r)}>
              {raw ? "Hide" : "View"} raw metadata
            </Button>
            {raw && (
              <pre className="mt-2 overflow-x-auto rounded-md border border-border bg-background p-3 font-mono text-[10.5px]">
                {JSON.stringify(selected, null, 2)}
              </pre>
            )}
          </details>

          <div className="flex flex-wrap gap-2 border-t border-border pt-4">
            <Button size="sm" variant="secondary">
              Open Full Page
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                void navigator.clipboard?.writeText(selected.id);
                toast.success(`Copied ${selected.id}`);
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
          <DemoNotice />
        </aside>
      </div>
    </div>
  );
}

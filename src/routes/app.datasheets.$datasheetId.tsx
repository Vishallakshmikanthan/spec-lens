import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, FileText, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageHeader, Section, EmptyState, ErrorState } from "@/components/speclens/primitives";
import { StatusPill } from "@/components/speclens/status-pill";
import { DocPage } from "@/components/speclens/doc-page";
import { EvidenceTypeBadge, ConfidenceBar } from "@/components/speclens/evidence-ui";
import { useApiQuery } from "@/hooks/use-api-query";
import { api } from "@/services";
import { cn } from "@/lib/utils";
import { PdfPageViewer } from "@/components/speclens/pdf-page-viewer";

export const Route = createFileRoute("/app/datasheets/$datasheetId")({
  head: () => ({
    meta: [{ title: "Datasheet — SpecLens" }],
  }),
  component: DatasheetDetail,
});

function DatasheetDetail() {
  const { datasheetId } = Route.useParams();

  const {
    data: ds,
    isLoading,
    isError,
    refetch,
  } = useApiQuery(["datasheet", datasheetId], () => api.getDatasheet(datasheetId));
  const { data: evidence, isLoading: evidenceLoading } = useApiQuery(
    ["evidence", "by-document", datasheetId],
    () => api.listEvidence(datasheetId),
  );

  if (isLoading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center text-muted-foreground">
        <Loader2 className="size-4 animate-spin" aria-hidden="true" />
      </div>
    );
  }

  if (isError || !ds) {
    return (
      <div className="space-y-6 px-4 py-6 sm:px-6">
        <ErrorState
          title="Datasheet not available"
          reason="This datasheet could not be loaded from the workspace."
          onRetry={() => void refetch()}
        />
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title={ds.mpn}
        subtitle={`${ds.manufacturer} · ${ds.title}`}
        actions={
          <Button asChild size="sm" variant="secondary">
            <Link to="/app/datasheets">
              <ArrowLeft className="size-3.5" aria-hidden="true" />
              Back to library
            </Link>
          </Button>
        }
      />
      <div className="space-y-6 px-4 py-6 sm:px-6">
        <div className="grid gap-4 sm:grid-cols-[200px_1fr]">
          <div className="space-y-6 px-4 py-6 sm:px-6">
        <div className="grid gap-4 sm:grid-cols-[200px_1fr]">
          <PdfPageViewer
            datasheetId={datasheetId}
            pageNumber={1}
            initialZoom={1.5}
            onPageChange={(page) => console.log("Page changed:", page)}
            onZoomChange={(zoom} => console.log("Zoom changed:", zoom)}
            evidenceRegions={evidence?.length > 0 ? evidence.map((e) => ({
              bbox: e.bbox,
              evidenceType: e.type,
              title: e.title,
              confidence: e.confidence,
            })) : undefined}
            onRegionClick={(bbox, type, title) => {
              console.log("Evidence region clicked:", type, title, bbox);
            }}
          />
          <dl className="grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-3">
            {(
              [
                ["File", ds.fileName],
                ["Pages", String(ds.pages)],
                ["Size", `${ds.sizeMb} MB`],
                ["Evidence regions", String(ds.evidenceCount)],
                ["Collections", ds.collections.join(", ") || "—"],
                ["Updated", ds.updatedAt],
              ] as [string, string][]
            ).map(([label, value]) => (
              <div key={label} className="min-w-0">
                <dt className="font-mono text-[10.5px] uppercase tracking-[0.14em] text-muted-foreground">
                  {label}
                </dt>
                <dd className="mt-1 truncate text-[13px]" title={value}>
                  {value}
                </dd>
              </div>
            ))}
            <div>
              <dt className="font-mono text-[10.5px] uppercase tracking-[0.14em] text-muted-foreground">
                Status
              </dt>
              <dd className="mt-1">
                <StatusPill status={ds.status} />
              </dd>
            </div>
          </dl>
        </div>

        <Section
          title="Evidence regions"
          description={`${ds.evidenceCount} regions in the retrieval index for this document`}
        >
          {evidenceLoading ? (
            <p className="flex items-center gap-2 text-[13px] text-muted-foreground">
              <Loader2 className="size-4 animate-spin" aria-hidden="true" />
              Loading evidence…
            </p>
          ) : evidence && evidence.length > 0 ? (
            <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {evidence.map((e) => (
                <li key={e.id} className="panel p-4">
                  <div className="flex items-start justify-between gap-2">
                    <EvidenceTypeBadge type={e.type} />
                    <span className="font-mono text-[10.5px] text-muted-foreground">
                      p{e.page} / {e.totalPages}
                    </span>
                  </div>
                  <h3 className="mt-2 text-[13.5px] font-medium">{e.title}</h3>
                  <p className="mt-1 line-clamp-2 text-[12px] text-muted-foreground">{e.caption}</p>
                  <ConfidenceBar value={e.confidence} className="mt-3" />
                  <p className={cn("mt-2 truncate font-mono text-[10.5px] text-muted-foreground")}>
                    {e.id}
                  </p>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState
              icon={FileText}
              title="No evidence indexed"
              description="This document has no evidence regions in the retrieval index yet."
              action={
                <Button asChild size="sm" variant="secondary">
                  <Link to="/app/upload">Index a datasheet</Link>
                </Button>
              }
            />
          )}
        </Section>
      </div>
    </div>
  );
}

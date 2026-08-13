import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Check, CircleDashed, Loader2, XCircle } from "lucide-react";
import { PageHeader, DemoNotice, ErrorState } from "@/components/speclens/primitives";
import { mockJobs } from "@/lib/speclens/mock-data";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/app/monitor")({
  head: () => ({
    meta: [
      { title: "Processing Monitor — SpecLens" },
      {
        name: "description",
        content:
          "Track datasheet ingestion, region detection, indexing and verification jobs with live logs.",
      },
      { property: "og:title", content: "Processing Monitor — SpecLens" },
      {
        property: "og:description",
        content:
          "Track datasheet ingestion, region detection, indexing and verification jobs with live logs.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: MonitorPage,
});

function MonitorPage() {
  const [selected, setSelected] = useState(mockJobs[0]!.id);
  const job = mockJobs.find((j) => j.id === selected)!;

  return (
    <div>
      <PageHeader
        title="Processing Monitor"
        subtitle="Ingestion and indexing jobs across the workspace."
      />
      <div className="grid gap-0 lg:grid-cols-[320px_1fr]">
        <ul className="divide-y divide-border border-b border-border lg:border-b-0 lg:border-r">
          {mockJobs.map((j) => (
            <li key={j.id}>
              <button
                onClick={() => setSelected(j.id)}
                aria-pressed={j.id === selected}
                className={cn(
                  "w-full px-4 py-3 text-left transition-colors hover:bg-surface",
                  j.id === selected && "bg-surface",
                )}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="truncate font-mono text-[12.5px]">{j.fileName}</span>
                  <span
                    className={cn(
                      "text-[11px]",
                      j.status === "failed"
                        ? "text-destructive"
                        : j.status === "complete"
                          ? "text-success"
                          : "text-primary",
                    )}
                  >
                    {j.status}
                  </span>
                </div>
                <div className="mt-2 h-1 overflow-hidden rounded-full bg-muted">
                  <div
                    className={cn(
                      "h-full rounded-full",
                      j.status === "failed" ? "bg-destructive" : "bg-primary",
                    )}
                    style={{ width: `${j.progress}%` }}
                  />
                </div>
              </button>
            </li>
          ))}
        </ul>

        <div className="space-y-5 p-4 sm:p-6">
          <div>
            <h2 className="font-mono text-[15px]">{job.fileName}</h2>
            <p className="text-[12.5px] text-muted-foreground">
              {job.mpn} · {job.pages} pages · {job.sizeMb} MB · started {job.startedAt}
            </p>
          </div>

          <ol className="grid gap-2 sm:grid-cols-2">
            {job.stages.map((s) => (
              <li
                key={s.key}
                className="flex items-center gap-2 rounded-md border border-border bg-surface px-3 py-2 text-[12.5px]"
              >
                {s.state === "done" ? (
                  <Check className="size-3.5 text-success" aria-hidden="true" />
                ) : s.state === "active" ? (
                  <Loader2 className="size-3.5 animate-spin text-primary" aria-hidden="true" />
                ) : s.state === "failed" ? (
                  <XCircle className="size-3.5 text-destructive" aria-hidden="true" />
                ) : (
                  <CircleDashed className="size-3.5 text-muted-foreground/50" aria-hidden="true" />
                )}
                <span className={s.state === "pending" ? "text-muted-foreground" : ""}>
                  {s.label}
                </span>
              </li>
            ))}
          </ol>

          {job.status === "failed" && (
            <ErrorState
              title="Unable to process this datasheet."
              reason="The document appears to be a scanned PDF without a text layer, so layout analysis could not run."
              details={job.logs.map((l) => `${l.at} ${l.line}`).join("\n")}
            />
          )}

          <div>
            <p className="mb-2 font-mono text-[10.5px] uppercase tracking-[0.14em] text-muted-foreground">
              Job log
            </p>
            <pre className="max-h-72 overflow-auto rounded-lg border border-border bg-background p-3 font-mono text-[11.5px] leading-relaxed">
              {job.logs.map((l) => `${l.at}  ${l.line}`).join("\n")}
            </pre>
          </div>
          <DemoNotice />
        </div>
      </div>
    </div>
  );
}

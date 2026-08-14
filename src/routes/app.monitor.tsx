import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { Check, CircleDashed, Loader2, XCircle } from "lucide-react";
import { PageHeader, DemoNotice, ErrorState } from "@/components/speclens/primitives";
import { DEMO_MODE } from "@/lib/speclens/config";
import { api } from "@/services";

const displayedJobsFileNames = ["LM358.pdf", "TPS5430.pdf", "OPA197.pdf"];

function formatDuration(startedAt: string | undefined): string {
  if (!startedAt) return "Not started";
  const start = new Date(startedAt).getTime();
  const now = Date.now();
  const elapsedMs = now - start;
  const totalSeconds = Math.floor(elapsedMs / 1000);
  if (totalSeconds < 60) {
    return `${totalSeconds}s ago`;
  }
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  if (minutes < 60) {
    return `${minutes}m ${seconds}s ago`;
  }
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  return `${hours}h ${remainingMinutes}m ago`;
}

function getDisplayedJobs(jobs: any[]): any[] {
  if (displayedJobsFileNames.length === 0) return jobs;
  return jobs.filter((j) => displayedJobsFileNames.includes(j.fileName));
}

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
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null);
  const [jobs, setJobs] = useState<any[]>([]);
  const [pollInterval, setPollInterval] = useState<NodeJS.Timeout | null>(null);

  // Fetch jobs from real API or mock depending on DEMO_MODE
  useEffect(() => {
    let cancelled = false;

    if (DEMO_MODE) {
      // Use mock data in demo mode
      import("@/mock/data").then((mod) => {
        if (cancelled) return;
        const mockJobs = mod.mockJobs;
        setJobs(getDisplayedJobs(mockJobs));
      });
    } else {
      // Fetch from real API
      fetchRealJobs();
    }

    return () => {
      cancelled = true;
      if (pollInterval) clearInterval(pollInterval);
    };
  }, []);

  // Real API polling
  async function fetchRealJobs() {
    try {
      const realJobs = await api.listJobs();
      setJobs(getDisplayedJobs(realJobs));
    } catch (err) {
      console.error("Failed to fetch jobs:", err);
    }
  }

  useEffect(() => {
    // Poll for job status updates when we have jobs
    if (jobs.length === 0) return;

    const interval = setInterval(async () => {
      try {
        const realJobs = await api.listJobs();
        setJobs(getDisplayedJobs(realJobs));
      } catch (err) {
        console.error("Poll failed:", err);
      }
    }, 3000); // 3 second polling interval

    setPollInterval(interval);
    return () => clearInterval(interval);
  }, [jobs]);

  const job = jobs.find((j) => j.id === selectedJobId) || jobs[0];

  if (!job) {
    return (
      <div>
        <PageHeader
          title="Processing Monitor"
          subtitle="Ingestion and indexing jobs across the workspace."
        />
        <p className="text-muted-foreground">No jobs found.</p>
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title="Processing Monitor"
        subtitle="Ingestion and indexing jobs across the workspace."
      />
      <div className="grid gap-0 lg:grid-cols-[320px_1fr]">
        <ul className="divide-y divide-border border-b border-border lg:border-b-0 lg:border-r">
          {jobs.map((j) => (
            <li key={j.id}>
              <button
                onClick={() => setSelectedJobId(j.id)}
                aria-pressed={j.id === selectedJobId}
                className={cn(
                  "w-full px-4 py-3 text-left transition-colors hover:bg-surface",
                  j.id === selectedJobId && "bg-surface",
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
              {job.mpn} · {job.pages} pages · {job.sizeMb} MB · started {formatDuration(job.startedAt)} ·{" "}
              {job.duration}
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
              {job.logs.map((l) => `${l.at} ${l.line}`).join("\n")}
            </pre>
          </div>
          <DemoNotice />
        </div>
      </div>
    </div>
  );
}
import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { Check, Loader2, Circle, XCircle, UploadCloud } from "lucide-react";
import { PageHeader, DemoNotice } from "@/components/speclens/primitives";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { UPLOAD_STAGE_LABELS, type ProcessingJob } from "@/lib/speclens/stages";
import { DEMO_MODE } from "@/lib/speclens/config";
import type { JobStage } from "@/types/speclens";

const MAX_FILE_SIZE = 200 * 1024 * 1024;

export const Route = createFileRoute("/app/upload")({
  head: () => ({
    meta: [
      { title: "Upload datasheet — SpecLens" },
      {
        name: "description",
        content:
          "Drag and drop technical datasheets and watch the indexing pipeline progress stage by stage.",
      },
      { property: "og:title", content: "Upload datasheet — SpecLens" },
      {
        property: "og:description",
        content:
          "Drag and drop technical datasheets and watch the indexing pipeline progress stage by stage.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: UploadPage,
});

function UploadPage() {
  const [file, setFile] = useState<{ name: string; sizeMb: number } | null>(null);
  const [job, setJob] = useState<{
    id: string;
    status: string;
    stages: JobStage[];
    progress: number;
  } | null>(null);
  const [drag, setDrag] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const accept = (f: File | undefined) => {
    if (!f) return;
    if (f.size > MAX_FILE_SIZE) {
      return setError("File size exceeds 200 MB limit");
    }
    setStage(0);
    setFile({ name: f.name, sizeMb: Math.round((f.size / 1048576) * 10) / 10 });
    setError(null);
    // Simulate upload job creation via mock API
    import("@/services").then((mod) => {
      mod.api.uploadDatasheet({ name: f.name, size: f.size }).then(setJob);
    });
  };

  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!job) return;
    const interval = setInterval(() => {
      setStage((s) => s + 1);
      if (stage >= UPLOAD_STAGE_LABELS.length) {
        clearInterval(interval);
      }
    }, 1200);
    return () => clearInterval(interval);
  }, [job]);

  useEffect(() => {
    if (!job) return;
    const unsub = job.stages.map((s) => s.state).includes("failed");
    if (unsub) {
      setError("Processing failed - the datasheet could not be indexed.");
    }
  }, [job]);

  const progress = job ? Math.round((stage / UPLOAD_STAGE_LABELS.length) * 100) : 0;

  return (
    <div>
      <PageHeader title="Upload" subtitle="Add datasheets to the workspace index." />
      <div className="mx-auto max-w-3xl space-y-6 px-4 py-6 sm:px-6">
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setDrag(true);
          }}
          onDragLeave={() => setDrag(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDrag(false);
            const f = e.dataTransfer.files[0];
            if (f) accept(f);
          }}
          className={cn(
            "panel flex flex-col items-center justify-center px-6 py-14 text-center transition-colors",
            drag && "border-primary/60 bg-primary/5",
          )}
        >
          <UploadCloud className="size-7 text-primary" aria-hidden="true" />
          <h2 className="mt-4 text-[15px] font-medium">Drop technical datasheets here</h2>
          <p className="mt-1 text-[12.5px] text-muted-foreground">PDF supported · up to 200 MB</p>
          <input
            ref={inputRef}
            type="file"
            accept="application/pdf"
            className="sr-only"
            onChange={(e) => accept(e.target.files?.[0])}
            aria-label="Choose a PDF datasheet"
          />
          <Button className="mt-5" size="sm" onClick={() => inputRef.current?.click()}>
            Browse Files
          </Button>
        </div>

        {error && (
          <ErrorState
            title="Upload Error"
            reason={error}
            details="Please try again or select a different file."
            onRetry={() => setError(null)}
          />
        )}

        {file && !job && (
          <div className="panel animate-rise p-5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="font-mono text-[13px]">{file.name}</p>
                <p className="text-[12px] text-muted-foreground">{file.sizeMb} MB · PDF file</p>
              </div>
              <span className="font-mono text-[12px] text-muted-foreground">0%</span>
            </div>
            <div className="mt-3 h-1 overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full bg-primary/20 transition-[width] duration-500"
                style={{ width: "0%" }}
              />
            </div>
          </div>
        )}

        {job && (
          <div className="panel animate-rise p-5">
            <div className="flex flex-col gap-4">
              <div className="flex items-center gap-2">
                <p className="font-mono text-[13px]">{job.fileName}</p>
                <p className="text-[12px] text-muted-foreground">{job.progress}%</p>
              </div>

              <div className="mt-3 h-1 overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full rounded-full bg-primary transition-[width] duration-500"
                  style={{ width: `${progress}%` }}
                />
              </div>

              <ol className="space-y-2.5 text-[13px]">
                {UPLOAD_STAGE_LABELS.map((s, i) => {
                  const stageJob = job.stages.find((sj) => sj.key === s.key);
                  const isComplete = stage > i;
                  const isActive = stage === i;
                  const isPending = stage <= i && !isActive;
                  return (
                    <li
                      key={s.key}
                      className="flex items-center gap-1.5"
                      style={{ opacity: isPending ? "0.4" : "1" }}
                    >
                      {isComplete ? (
                        <Check className="size-4 text-success" aria-hidden="true" />
                      ) : isActive ? (
                        <Loader2 className="size-4 animate-spin text-primary" aria-hidden="true" />
                      ) : isPending ? (
                        <Circle className="size-4 text-muted-foreground/30" aria-hidden="true" />
                      ) : (
                        <CircleDashed
                          className="size-4 text-muted-foreground/50"
                          aria-hidden="true"
                        />
                      )}
                      <span className="text-muted-foreground/60">{s.label}</span>
                    </li>
                  );
                })}
              </ol>

              {job.status === "complete" && (
                <div className="mt-4 pt-4 border-t border-border text-[11px] text-muted-foreground">
                  <p>Job ID: {job.id}</p>
                  <p>Status: Complete</p>
                  <p>
                    {job.pages} pages · {job.sizeMb} MB · Evidence regions detected
                  </p>
                </div>
              )}

              {job.status === "failed" && (
                <ErrorState
                  title="Processing Failed"
                  reason="The datasheet could not be fully processed."
                  details="Please try uploading the file again."
                  onRetry={() => setJob(null)}
                />
              )}
            </div>
          </div>
        )}

        {(!file && !job) || (file && !job) ? (
          <div className="h-32 w-full border-2 border-border rounded-lg flex items-center justify-center text-muted-foreground">
            <UploadCloud className="size-5" aria-hidden="true" />
            <p className="mt-2">No file selected</p>
          </div>
        ) : null}

        <DemoNotice />
      </div>
    </div>
  );
}

import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { Check, CircleDashed, Loader2, UploadCloud } from "lucide-react";
import { PageHeader, DemoNotice } from "@/components/speclens/primitives";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/app/upload")({
  head: () => ({
    meta: [
      { title: "Upload datasheet — SpecLens" },
      { name: "description", content: "Drag and drop technical datasheets and watch the indexing pipeline progress stage by stage." },
      { property: "og:title", content: "Upload datasheet — SpecLens" },
      { property: "og:description", content: "Drag and drop technical datasheets and watch the indexing pipeline progress stage by stage." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: UploadPage,
});

const STAGES = [
  "PDF validated", "Document loaded", "Pages rendered", "Layout analyzed",
  "Visual regions detected", "Building retrieval index", "Evidence verification", "Ready",
];

function UploadPage() {
  const [file, setFile] = useState<{ name: string; sizeMb: number } | null>(null);
  const [stage, setStage] = useState(0);
  const [drag, setDrag] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!file || stage >= STAGES.length) return;
    const t = setTimeout(() => setStage((s) => s + 1), 900);
    return () => clearTimeout(t);
  }, [file, stage]);

  const accept = (f: File | undefined) => {
    if (!f) return;
    setStage(0);
    setFile({ name: f.name, sizeMb: Math.round((f.size / 1048576) * 10) / 10 });
  };

  const progress = Math.round((stage / STAGES.length) * 100);

  return (
    <div>
      <PageHeader title="Upload" subtitle="Add datasheets to the workspace index." />
      <div className="mx-auto max-w-3xl space-y-6 px-4 py-6 sm:px-6">
        <div
          onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
          onDragLeave={() => setDrag(false)}
          onDrop={(e) => { e.preventDefault(); setDrag(false); accept(e.dataTransfer.files[0]); }}
          className={cn("panel flex flex-col items-center justify-center px-6 py-14 text-center transition-colors",
            drag && "border-primary/60 bg-primary/5")}
        >
          <UploadCloud className="size-7 text-primary" aria-hidden="true" />
          <h2 className="mt-4 text-[15px] font-medium">Drop technical datasheets here</h2>
          <p className="mt-1 text-[12.5px] text-muted-foreground">PDF supported · up to 200 MB</p>
          <input ref={inputRef} type="file" accept="application/pdf" className="sr-only"
            onChange={(e) => accept(e.target.files?.[0])} aria-label="Choose a PDF datasheet" />
          <Button className="mt-5" size="sm" onClick={() => inputRef.current?.click()}>Browse Files</Button>
        </div>

        {file && (
          <div className="panel animate-rise p-5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="font-mono text-[13px]">{file.name}</p>
                <p className="text-[12px] text-muted-foreground">{file.sizeMb} MB · {stage >= 3 ? "243 pages" : "counting pages…"}</p>
              </div>
              <span className="font-mono text-[12px] text-muted-foreground">{progress}%</span>
            </div>
            <div className="mt-3 h-1 overflow-hidden rounded-full bg-muted">
              <div className="h-full rounded-full bg-primary transition-[width] duration-500" style={{ width: `${progress}%` }} />
            </div>
            <ol className="mt-5 space-y-2.5">
              {STAGES.map((s, i) => (
                <li key={s} className="flex items-center gap-2.5 text-[13px]">
                  {i < stage ? <Check className="size-4 text-success" aria-hidden="true" />
                    : i === stage ? <Loader2 className="size-4 animate-spin text-primary" aria-hidden="true" />
                    : <CircleDashed className="size-4 text-muted-foreground/50" aria-hidden="true" />}
                  <span className={i > stage ? "text-muted-foreground" : ""}>{s}</span>
                </li>
              ))}
            </ol>
          </div>
        )}
        <DemoNotice />
      </div>
    </div>
  );
}

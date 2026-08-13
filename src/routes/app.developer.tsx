import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Copy, Play } from "lucide-react";
import { PageHeader, DemoNotice } from "@/components/speclens/primitives";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/speclens/api";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/app/developer")({
  head: () => ({
    meta: [
      { title: "Developer Console — SpecLens" },
      { name: "description", content: "Inspect the SpecLens API contract: endpoints, requests, responses, latency and evidence IDs." },
      { property: "og:title", content: "Developer Console — SpecLens" },
      { property: "og:description", content: "Inspect the SpecLens API contract: endpoints, requests, responses, latency and evidence IDs." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: DeveloperPage,
});

const endpoints = [
  { method: "POST", path: "/api/search", body: { query: "find pinout", mpn: "LM358", evidence_type: "pinout" } },
  { method: "GET", path: "/api/datasheets", body: null },
  { method: "GET", path: "/api/evidence/EV-0017", body: null },
  { method: "POST", path: "/api/copilot", body: { question: "What is the supply voltage range?" } },
  { method: "POST", path: "/api/symbols/generate", body: { mpn: "LM358" } },
  { method: "GET", path: "/api/analytics", body: null },
];

function DeveloperPage() {
  const [idx, setIdx] = useState(0);
  const [response, setResponse] = useState<string>("// Run the request to see the demo response");
  const [latency, setLatency] = useState<number | null>(null);
  const ep = endpoints[idx]!;

  const run = async () => {
    const t0 = performance.now();
    let data: unknown;
    if (ep.path.startsWith("/api/search")) data = await api.search("find pinout", { types: ["pinout"] });
    else if (ep.path === "/api/datasheets") data = await api.listDatasheets();
    else if (ep.path.startsWith("/api/evidence")) data = await api.getEvidence("EV-0017");
    else if (ep.path === "/api/copilot") data = await api.askCopilot("What is the supply voltage range?");
    else if (ep.path === "/api/symbols/generate") data = await api.generateSymbol("LM358");
    else data = await api.getAnalytics();
    setLatency(Math.round(performance.now() - t0));
    setResponse(JSON.stringify(data, null, 2));
  };

  return (
    <div>
      <PageHeader title="Developer Console" subtitle="The API contract the SpecLens frontend is built against." />
      <div className="grid gap-0 lg:grid-cols-[300px_1fr]">
        <ul className="divide-y divide-border border-b border-border lg:border-b-0 lg:border-r">
          {endpoints.map((e, i) => (
            <li key={e.path}>
              <button onClick={() => setIdx(i)} aria-pressed={i === idx}
                className={cn("flex w-full items-center gap-2 px-4 py-3 text-left font-mono text-[12px] hover:bg-surface", i === idx && "bg-surface")}>
                <span className={cn("w-11 shrink-0 text-[10.5px]", e.method === "POST" ? "text-warning" : "text-success")}>{e.method}</span>
                <span className="truncate">{e.path}</span>
              </button>
            </li>
          ))}
        </ul>

        <div className="space-y-4 p-4 sm:p-6">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-mono text-[13px]">{ep.method} {ep.path}</span>
            {latency !== null && <span className="font-mono text-[11px] text-muted-foreground">{latency} ms</span>}
            <div className="ml-auto flex gap-2">
              <Button size="sm" onClick={run}><Play className="size-3.5" />Run</Button>
              <Button size="sm" variant="outline" onClick={() => { void navigator.clipboard?.writeText(response); toast.success("Response copied"); }}>
                <Copy className="size-3.5" />Copy
              </Button>
            </div>
          </div>

          <div>
            <p className="mb-1.5 font-mono text-[10.5px] uppercase tracking-[0.14em] text-muted-foreground">Request</p>
            <pre className="overflow-auto rounded-lg border border-border bg-background p-3 font-mono text-[11.5px]">
{ep.body ? JSON.stringify(ep.body, null, 2) : "// no request body"}
            </pre>
          </div>
          <div>
            <p className="mb-1.5 font-mono text-[10.5px] uppercase tracking-[0.14em] text-muted-foreground">Response</p>
            <pre className="max-h-[420px] overflow-auto rounded-lg border border-border bg-background p-3 font-mono text-[11.5px]">
{response}
            </pre>
          </div>
          <DemoNotice />
        </div>
      </div>
    </div>
  );
}

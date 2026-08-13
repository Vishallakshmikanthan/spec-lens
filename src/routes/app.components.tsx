import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Check, Search } from "lucide-react";
import { PageHeader, Section, DemoNotice } from "@/components/speclens/primitives";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { mockComponents, mockEvidence } from "@/lib/speclens/mock-data";
import { ConfidenceBar, EvidenceTypeBadge } from "@/components/speclens/evidence-ui";
import { DocPage } from "@/components/speclens/doc-page";

export const Route = createFileRoute("/app/components")({
  head: () => ({
    meta: [
      { title: "Component Intelligence — SpecLens" },
      {
        name: "description",
        content:
          "Component-level intelligence: packages, specifications, verified evidence and related parts.",
      },
      { property: "og:title", content: "Component Intelligence — SpecLens" },
      {
        property: "og:description",
        content:
          "Component-level intelligence: packages, specifications, verified evidence and related parts.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  validateSearch: (s: Record<string, unknown>) => ({
    mpn: typeof s["mpn"] === "string" ? s["mpn"] : "",
  }),
  component: ComponentsPage,
});

function EvidenceGraph({ mpn }: { mpn: string }) {
  const nodes = mockEvidence.filter((e) => e.mpn === mpn).slice(0, 6);
  const cx = 90,
    cy = 150;
  return (
    <div className="panel overflow-x-auto p-4">
      <svg
        viewBox="0 0 620 300"
        className="h-[300px] w-full min-w-[520px]"
        role="img"
        aria-label={`Evidence graph for ${mpn}`}
      >
        {nodes.map((n, i) => {
          const y = 40 + i * 44;
          return (
            <g key={n.id}>
              <path
                d={`M${cx + 56} ${cy} C 200 ${cy}, 240 ${y + 14}, 300 ${y + 14}`}
                fill="none"
                stroke="currentColor"
                className="flow-dash text-primary/40"
                strokeWidth="1"
              />
              <rect
                x="300"
                y={y}
                width="290"
                height="28"
                rx="4"
                className="fill-surface-raised stroke-border"
              />
              <text x="312" y={y + 18} className="fill-foreground" style={{ fontSize: 11 }}>
                {n.title.slice(0, 34)}
              </text>
              <text
                x="578"
                y={y + 18}
                textAnchor="end"
                className="fill-muted-foreground"
                style={{ fontSize: 10, fontFamily: "monospace" }}
              >
                p{n.page} · {(n.confidence * 100).toFixed(1)}%
              </text>
            </g>
          );
        })}
        <rect
          x={cx - 56}
          y={cy - 20}
          width="112"
          height="40"
          rx="6"
          className="fill-primary/10 stroke-primary"
        />
        <text
          x={cx}
          y={cy + 5}
          textAnchor="middle"
          className="fill-foreground"
          style={{ fontSize: 13, fontWeight: 600 }}
        >
          {mpn}
        </text>
      </svg>
    </div>
  );
}

function ComponentsPage() {
  const { mpn } = Route.useSearch();
  const [q, setQ] = useState(mpn || "LM358");

  useEffect(() => {
    if (mpn) setQ(mpn);
  }, [mpn]);

  const c =
    mockComponents.find((x) => x.mpn.toLowerCase() === q.trim().toLowerCase()) ??
    mockComponents[0]!;

  return (
    <div>
      <PageHeader
        title="Components"
        subtitle="Component intelligence assembled from verified evidence."
      />
      <div className="space-y-6 px-4 py-6 sm:px-6">
        <div className="relative max-w-md">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden="true"
          />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            aria-label="Search component or MPN"
            placeholder="Search MPN…"
            className="h-10 w-full rounded-md border border-border bg-surface pl-9 pr-3 text-[13px] outline-none focus-visible:border-primary/60"
          />
        </div>

        <div className="panel p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="font-mono text-[18px] font-semibold">{c.mpn}</h2>
              <p className="text-[12.5px] text-muted-foreground">
                {c.manufacturer} · {c.family} · {c.channels} channels
              </p>
            </div>
            <Button asChild size="sm" variant="secondary">
              <Link to="/app/search" search={{ q: c.mpn }}>
                Search evidence
              </Link>
            </Button>
          </div>
          <p className="mt-3 max-w-2xl text-[13px] text-muted-foreground">{c.description}</p>
        </div>

        <Tabs defaultValue="overview">
          <TabsList>
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="evidence">Evidence</TabsTrigger>
            <TabsTrigger value="graph">Graph</TabsTrigger>
            <TabsTrigger value="related">Related</TabsTrigger>
            <TabsTrigger value="history">History</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="mt-4 grid gap-4 lg:grid-cols-2">
            <Section title="Specifications">
              <dl className="divide-y divide-border overflow-hidden rounded-lg border border-border">
                {c.specs.map((s) => (
                  <div
                    key={s.label}
                    className="flex justify-between gap-4 bg-surface px-3 py-2.5 text-[12.5px]"
                  >
                    <dt className="text-muted-foreground">{s.label}</dt>
                    <dd className="text-right font-mono text-[11.5px]">{s.value}</dd>
                  </div>
                ))}
              </dl>
            </Section>
            <div className="space-y-4">
              <Section title="Known packages">
                <ul className="flex flex-wrap gap-2">
                  {c.packages.map((p) => (
                    <li
                      key={p}
                      className="rounded-md border border-border bg-secondary px-2.5 py-1 font-mono text-[11.5px]"
                    >
                      {p}
                    </li>
                  ))}
                </ul>
              </Section>
              <Section title="Verified evidence">
                <ul className="grid grid-cols-2 gap-2">
                  {c.verified.map((v) => (
                    <li
                      key={v.label}
                      className="flex items-center gap-2 rounded-md border border-border bg-surface px-3 py-2 text-[12.5px]"
                    >
                      <Check className="size-3.5 text-success" aria-hidden="true" />
                      {v.label}
                    </li>
                  ))}
                </ul>
              </Section>
            </div>
          </TabsContent>

          <TabsContent value="evidence" className="mt-4">
            <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {mockEvidence
                .filter((e) => e.mpn === c.mpn)
                .map((e) => (
                  <li key={e.id} className="panel p-3">
                    <div className="mx-auto w-24">
                      <DocPage type={e.type} mpn={e.mpn} page={e.page} bbox={e.bbox} />
                    </div>
                    <div className="mt-3 space-y-2">
                      <EvidenceTypeBadge type={e.type} />
                      <p className="text-[12.5px] font-medium">{e.title}</p>
                      <ConfidenceBar value={e.confidence} />
                      <Button asChild size="sm" variant="secondary" className="w-full">
                        <Link to="/app/evidence" search={{ doc: e.documentId, ev: e.id }}>
                          Inspect
                        </Link>
                      </Button>
                    </div>
                  </li>
                ))}
            </ul>
          </TabsContent>

          <TabsContent value="graph" className="mt-4">
            <EvidenceGraph mpn={c.mpn} />
          </TabsContent>

          <TabsContent value="related" className="mt-4">
            <ul className="divide-y divide-border overflow-hidden rounded-lg border border-border">
              {c.related.map((r) => (
                <li
                  key={r.mpn}
                  className="flex items-center justify-between gap-3 bg-surface px-3 py-3"
                >
                  <span>
                    <span className="font-mono text-[13px]">{r.mpn}</span>
                    <span className="ml-2 text-[12px] text-muted-foreground">{r.note}</span>
                  </span>
                  <Button asChild size="sm" variant="ghost">
                    <Link to="/app/search" search={{ q: r.mpn }}>
                      Search
                    </Link>
                  </Button>
                </li>
              ))}
            </ul>
          </TabsContent>

          <TabsContent value="history" className="mt-4">
            <ul className="space-y-2">
              {c.history.map((h) => (
                <li
                  key={h.at}
                  className="flex gap-3 rounded-md border border-border bg-surface px-3 py-2.5 text-[12.5px]"
                >
                  <span className="font-mono text-[11px] text-muted-foreground">{h.at}</span>
                  {h.event}
                </li>
              ))}
            </ul>
          </TabsContent>
        </Tabs>
        <DemoNotice />
      </div>
    </div>
  );
}

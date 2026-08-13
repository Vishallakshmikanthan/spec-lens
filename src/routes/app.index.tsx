import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { Boxes, FileText, Search, ShieldCheck } from "lucide-react";
import { PageHeader, KpiCard, Section, DemoNotice } from "@/components/speclens/primitives";
import { DocPage } from "@/components/speclens/doc-page";
import { StatusPill } from "@/components/speclens/status-pill";
import { mockActivity, mockDatasheets } from "@/lib/speclens/mock-data";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/app/")({
  head: () => ({
    meta: [
      { title: "Command Center — SpecLens" },
      {
        name: "description",
        content:
          "Your engineering intelligence workspace: indexed datasheets, evidence regions and retrieval activity.",
      },
      { property: "og:title", content: "Command Center — SpecLens" },
      {
        property: "og:description",
        content:
          "Your engineering intelligence workspace: indexed datasheets, evidence regions and retrieval activity.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: CommandCenter,
});

function CommandCenter() {
  const navigate = useNavigate();
  const [q, setQ] = useState("");

  return (
    <div>
      <PageHeader title="Command Center" subtitle="Your engineering intelligence workspace." />
      <div className="space-y-8 px-4 py-6 sm:px-6">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void navigate({ to: "/app/search", search: { q } });
          }}
          className="relative"
        >
          <Search
            className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden="true"
          />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            aria-label="Search datasheets, components, figures, evidence"
            placeholder="Search datasheets, components, figures, evidence…"
            className="h-12 w-full rounded-lg border border-border bg-surface pl-10 pr-4 text-[14px] outline-none transition-colors placeholder:text-muted-foreground focus-visible:border-primary/60"
          />
        </form>

        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <KpiCard
            label="Datasheets indexed"
            value="1,284"
            icon={FileText}
            delta={{ text: "+42", positive: true }}
          />
          <KpiCard
            label="Evidence regions"
            value="48,921"
            icon={Boxes}
            delta={{ text: "+1,108", positive: true }}
          />
          <KpiCard
            label="Searches"
            value="16,438"
            icon={Search}
            delta={{ text: "+9.4%", positive: true }}
          />
          <KpiCard
            label="Verified results"
            value="31,209"
            icon={ShieldCheck}
            delta={{ text: "94.1%", positive: true }}
          />
        </div>

        <div className="grid gap-6 lg:grid-cols-[1.25fr_0.75fr]">
          <Section title="Recent datasheets">
            <ul className="divide-y divide-border overflow-hidden rounded-lg border border-border">
              {mockDatasheets.slice(0, 5).map((d) => (
                <li key={d.id}>
                  <Link
                    to="/app/evidence"
                    search={{ doc: d.id, ev: undefined }}
                    className="flex items-center gap-3 bg-surface px-3 py-3 transition-colors hover:bg-surface-raised"
                  >
                    <span className="w-14 shrink-0">
                      <DocPage type="pinout" mpn={d.mpn} dense />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[13px] font-medium">
                        {d.mpn} · {d.title}
                      </span>
                      <span className="block truncate text-[12px] text-muted-foreground">
                        {d.manufacturer} · {d.pages} pages · {d.evidenceCount} evidence regions
                      </span>
                    </span>
                    <StatusPill status={d.status} />
                  </Link>
                </li>
              ))}
            </ul>
          </Section>

          <Section title="Intelligence activity">
            <ul className="space-y-px overflow-hidden rounded-lg border border-border">
              {mockActivity.map((a) => (
                <li key={a.id} className="flex gap-3 bg-surface px-3 py-3">
                  <span
                    className={cn(
                      "mt-1.5 size-1.5 shrink-0 rounded-full",
                      a.kind === "error"
                        ? "bg-destructive"
                        : a.kind === "verify"
                          ? "bg-success"
                          : "bg-primary",
                    )}
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block text-[12.5px] font-medium">{a.title}</span>
                    <span className="block text-[12px] text-muted-foreground">{a.detail}</span>
                  </span>
                  <span className="shrink-0 font-mono text-[10.5px] text-muted-foreground/70">
                    {a.at}
                  </span>
                </li>
              ))}
            </ul>
            <DemoNotice />
          </Section>
        </div>
      </div>
    </div>
  );
}

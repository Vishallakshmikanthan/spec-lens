import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Loader2, Search, SlidersHorizontal } from "lucide-react";
import { PageHeader, EmptyState, DemoNotice } from "@/components/speclens/primitives";
import { DocPage } from "@/components/speclens/doc-page";
import { Button } from "@/components/ui/button";
import {
  ConfidenceBar,
  EvidenceTypeBadge,
  VerificationBadge,
  evidenceIcon,
} from "@/components/speclens/evidence-ui";
import { EVIDENCE_TYPE_LABEL, searchExamples } from "@/lib/speclens/mock-data";
import { api } from "@/lib/speclens/api";
import type { EvidenceType, SearchResultSet } from "@/lib/speclens/types";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/app/search")({
  head: () => ({
    meta: [
      { title: "Visual Search — SpecLens" },
      {
        name: "description",
        content:
          "Search datasheets in natural language and retrieve ranked, verified visual evidence regions.",
      },
      { property: "og:title", content: "Visual Search — SpecLens" },
      {
        property: "og:description",
        content:
          "Search datasheets in natural language and retrieve ranked, verified visual evidence regions.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  validateSearch: (s: Record<string, unknown>) => ({ q: typeof s["q"] === "string" ? s["q"] : "" }),
  component: VisualSearch,
});

function VisualSearch() {
  const { q } = Route.useSearch();
  const navigate = useNavigate();
  const [input, setInput] = useState(q);
  const [types, setTypes] = useState<EvidenceType[]>([]);
  const [minConf, setMinConf] = useState(0);
  const [data, setData] = useState<SearchResultSet | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setInput(q);
  }, [q]);

  useEffect(() => {
    if (!q) {
      setData(null);
      return;
    }
    let alive = true;
    setLoading(true);
    api.search(q, { types, minConfidence: minConf }).then((r) => {
      if (alive) {
        setData(r);
        setLoading(false);
      }
    });
    return () => {
      alive = false;
    };
  }, [q, types, minConf]);

  const toggle = (t: EvidenceType) =>
    setTypes((cur) => (cur.includes(t) ? cur.filter((x) => x !== t) : [...cur, t]));

  return (
    <div>
      <PageHeader
        title="Visual Search"
        subtitle="Retrieve verified evidence regions across every indexed datasheet."
      />
      <div className="space-y-6 px-4 py-6 sm:px-6">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void navigate({ to: "/app/search", search: { q: input } });
          }}
          className="relative"
        >
          <Search
            className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden="true"
          />
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            aria-label="What are you looking for?"
            placeholder="What are you looking for?"
            className="h-12 w-full rounded-lg border border-border bg-surface pl-10 pr-24 text-[14px] outline-none focus-visible:border-primary/60"
          />
          <Button type="submit" size="sm" className="absolute right-2 top-1/2 -translate-y-1/2">
            Search
          </Button>
        </form>

        <div className="flex flex-wrap gap-2">
          {searchExamples.map((s) => (
            <button
              key={s}
              onClick={() => void navigate({ to: "/app/search", search: { q: s } })}
              className="rounded-full border border-border bg-secondary px-3 py-1 text-[12px] text-muted-foreground transition-colors hover:text-foreground"
            >
              {s}
            </button>
          ))}
        </div>

        <div className="grid gap-6 lg:grid-cols-[220px_1fr]">
          <aside className="space-y-4">
            <div className="panel p-3">
              <h2 className="mb-2 flex items-center gap-1.5 font-mono text-[10.5px] uppercase tracking-[0.14em] text-muted-foreground">
                <SlidersHorizontal className="size-3" aria-hidden="true" />
                Evidence type
              </h2>
              <ul className="space-y-0.5">
                {(Object.keys(EVIDENCE_TYPE_LABEL) as EvidenceType[]).map((t) => {
                  const Icon = evidenceIcon[t];
                  const count = data?.facets.find((f) => f.type === t)?.count ?? 0;
                  const on = types.includes(t);
                  return (
                    <li key={t}>
                      <button
                        onClick={() => toggle(t)}
                        aria-pressed={on}
                        className={cn(
                          "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-[12.5px] transition-colors hover:bg-secondary",
                          on && "bg-primary/10 text-foreground",
                        )}
                      >
                        <Icon
                          className={cn("size-3.5", on ? "text-primary" : "text-muted-foreground")}
                          aria-hidden="true"
                        />
                        <span className="flex-1 truncate">{EVIDENCE_TYPE_LABEL[t]}</span>
                        <span className="font-mono text-[10.5px] text-muted-foreground">
                          {count}
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>
            <div className="panel p-3">
              <label
                htmlFor="conf"
                className="font-mono text-[10.5px] uppercase tracking-[0.14em] text-muted-foreground"
              >
                Min confidence · {Math.round(minConf * 100)}%
              </label>
              <input
                id="conf"
                type="range"
                min={0}
                max={99}
                value={minConf * 100}
                onChange={(e) => setMinConf(Number(e.target.value) / 100)}
                className="mt-3 w-full accent-primary"
              />
            </div>
          </aside>

          <div className="space-y-3">
            {loading && (
              <p className="flex items-center gap-2 text-[13px] text-muted-foreground">
                <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                Retrieving evidence…
              </p>
            )}
            {!loading && !q && (
              <EmptyState
                icon={Search}
                title="Start with a question."
                description="Ask in natural language or search by MPN."
                suggestions={["LM358 pinout", "package dimensions", "timing diagram"]}
              />
            )}
            {!loading && q && data && data.total === 0 && (
              <EmptyState
                icon={Search}
                title="No evidence matched this query."
                description="Try a different phrasing or widen the filters."
                suggestions={["Try broader terms", "Search by MPN", "Remove filters"]}
              />
            )}
            {!loading && data && data.total > 0 && (
              <>
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <h2 className="text-[15px] font-medium">
                    {data.total} verified evidence regions
                  </h2>
                  <span className="font-mono text-[11px] text-muted-foreground">
                    {data.latencyMs} ms · demo index
                  </span>
                </div>
                <ul className="space-y-3">
                  {data.results.map((e, i) => (
                    <li
                      key={e.id}
                      className="panel animate-rise grid gap-4 p-4 sm:grid-cols-[130px_1fr]"
                      style={{ animationDelay: `${i * 40}ms` }}
                    >
                      <div className="mx-auto w-full max-w-[130px]">
                        <DocPage type={e.type} mpn={e.mpn} page={e.page} bbox={e.bbox} />
                      </div>
                      <div className="min-w-0 space-y-2">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-mono text-[10.5px] text-muted-foreground">
                            #{i + 1}
                          </span>
                          <EvidenceTypeBadge type={e.type} />
                          <VerificationBadge state={e.verification} />
                        </div>
                        <h3 className="text-[14px] font-medium">{e.title}</h3>
                        <p className="text-[12.5px] text-muted-foreground">{e.caption}</p>
                        <p className="font-mono text-[11px] text-muted-foreground">
                          {e.mpn} · page {e.page} / {e.totalPages} · {e.id}
                        </p>
                        <ConfidenceBar value={e.confidence} className="max-w-xs" />
                        <p className="text-[11.5px] text-muted-foreground">
                          Matched using: {e.matchedBy.join(" · ")}
                        </p>
                        <div className="flex flex-wrap gap-2 pt-1">
                          <Button asChild size="sm" variant="secondary">
                            <Link to="/app/evidence" search={{ doc: e.documentId, ev: e.id }}>
                              Inspect Evidence
                            </Link>
                          </Button>
                          <Button asChild size="sm" variant="outline">
                            <Link to="/app/evidence" search={{ doc: e.documentId, ev: e.id }}>
                              Open Page
                            </Link>
                          </Button>
                          <Button asChild size="sm" variant="ghost">
                            <Link to="/app/collections">Add to Collection</Link>
                          </Button>
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              </>
            )}
            <DemoNotice />
          </div>
        </div>
      </div>
    </div>
  );
}

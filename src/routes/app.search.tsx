import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Search, Loader2, SlidersHorizontal, Clock } from "lucide-react";
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
import { api, DEMO_MODE } from "@/lib/speclens/api";
import type { EvidenceType, SearchResultSet, SearchFilters } from "@/lib/speclens/types";
import { cn } from "@/lib/utils";

const SEARCH_MODES = ["Natural Language", "MPN", "Advanced"] as const;

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
          "Search datasheets in natural language and retrieve verified visual evidence regions.",
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
  const [searchMode, setSearchMode] = useState<("Natural Language" | "MPN" | "Advanced") | null>(
    null,
  );
  const [types, setTypes] = useState<EvidenceType[]>([]);
  const [minConf, setMinConf] = useState(0);
  const [data, setData] = useState<SearchResultSet | null>(null);
  const [loading, setLoading] = useState(false);
  const [retrievalStage, setRetrievalStage] = useState<
    "query" | "candidates" | "ranking" | "verify" | null
  >(null);

  useEffect(() => {
    setInput(q);
  }, [q]);

  useEffect(() => {
    if (!q) {
      setData(null);
      return;
    }
    let alive = true;
    setRetrievalStage("query");
    api.search(q, { types, minConfidence: minConf }).then((r) => {
      if (alive) {
        setData(r);
        setRetrievalStage("verify");
        setLoading(false);
      }
    });
    return () => {
      alive = false;
    };
  }, [q, types, minConf]);

  const toggle = (t: EvidenceType) =>
    setTypes((cur) => (cur.includes(t) ? cur.filter((x) => x !== t) : [...cur, t]));

  const applySearch = () => {
    void navigate({ to: "/app/search", search: { q: input } });
  };

  function renderEmptyState() {
    if (!loading && !q) {
      return (
        <EmptyState
          icon={Search}
          title="Start with a question."
          description="Ask in natural language or search by MPN."
          suggestions={["LM358 pinout", "package dimensions", "timing diagram"]}
        />
      );
    }
    if (!loading && q && data && data.total === 0) {
      return (
        <EmptyState
          icon={Search}
          title="No evidence matched this query."
          description="Try a different phrasing or widen the filters."
          suggestions={["Try broader terms", "Search by MPN", "Remove filters"]}
        />
      );
    }
    return null;
  }

  function renderResults() {
    if (!loading && q && data && data.total > 0) {
      return (
        <>
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="text-[15px] font-medium">{data.total} verified evidence regions</h2>
            <span className="font-mono text-[11px] text-muted-foreground">
              {data.latencyMs} ms
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
                    <span className="font-mono text-[10.5px] text-muted-foreground">#{i + 1}</span>
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
          <DemoNotice />
        </>
      );
    }
    return null;
  }

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
            applySearch();
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
            className="h-12 w-full rounded-lg border border-bg-secondary bg-secondary/20 pl-10 pr-24 text-[14px] outline-none focus-visible:border-primary/60"
          />
          <Button type="submit" size="sm" className="absolute right-2 top-1/2 -translate-y-1/2">
            Search
          </Button>
        </form>

        <div className="flex flex-col sm:flex-row gap-2 mb-4">
          {searchExamples.map((s) => (
            <button
              key={s}
              onClick={() => void navigate({ to: "/app/search", search: { q: s } })}
              className={cn(
                "rounded-full border border-bg-secondary bg-secondary/20 px-3 py-1 text-[12px] text-muted-foreground transition-colors hover:text-foreground",
              )}
            >
              {s}
            </button>
          ))}
        </div>

        <div className="flex gap-2 mb-3">
          {SEARCH_MODES.map((mode) => (
            <button
              key={mode}
              onClick={() => setSearchMode(mode as "Natural Language" | "MPN" | "Advanced")}
              className={cn(
                "rounded-md border px-3 py-1.5 text-[12px] font-medium transition-colors",
                searchMode === mode
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-secondary hover:text-foreground",
              )}
            >
              {mode}
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

            <div>
              <label className="font-mono text-[10.5px] uppercase tracking-[0.14em] text-muted-foreground">
                Manufacturer
              </label>
              <select
                className="mt-2 w-full rounded-lg border border-border px-3 py-2 text-[14px] focus-visible:ring-2 focus:ring-primary/20"
                onChange={(e) => setInput((e.target as HTMLSelectElement).value)}
              >
                <option value="">All manufacturers</option>
                <option value="Texas Instruments">Texas Instruments</option>
                <option value="STMicroelectronics">STMicroelectronics</option>
                <option value="Espressif">Espressif</option>
                <option value="Analog Devices">Analog Devices</option>
              </select>
            </div>
          </aside>

          <div className="space-y-3">
            {loading && (
              <p className="flex items-center gap-2 text-[13px] text-muted-foreground">
                <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                Retrieving evidence…
              </p>
            )}

            {retrievalStage && (
              <p className="flex items-center gap-2 text-[13px] text-muted-foreground">
                {retrievalStage === "query" && (
                  <span>
                    <Clock className="size-3 animate-spin" aria-hidden="true" />
                    Understanding query
                  </span>
                )}
                {retrievalStage === "candidates" && (
                  <span>
                    <Clock className="size-3 animate-spin" aria-hidden="true" />
                    Finding candidate regions
                  </span>
                )}
                {retrievalStage === "ranking" && (
                  <span>
                    <Clock className="size-3 animate-spin" aria-hidden="true" />
                    Ranking evidence
                  </span>
                )}
                {retrievalStage === "verify" && (
                  <span>
                    <Clock className="size-3 animate-spin" aria-hidden="true" />
                    Verifying results
                  </span>
                )}
              </p>
            )}

            {renderEmptyState()}

            {renderResults()}
          </div>
        </div>
      </div>
    </div>
  );
}
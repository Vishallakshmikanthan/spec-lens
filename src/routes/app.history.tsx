import { createFileRoute, Link } from "@tanstack/react-router";
import { RotateCw, Trash2 } from "lucide-react";
import { useState } from "react";
import { PageHeader, EmptyState, DemoNotice } from "@/components/speclens/primitives";
import { Button } from "@/components/ui/button";
import { mockHistory } from "@/lib/speclens/mock-data";
import { Clock } from "lucide-react";

export const Route = createFileRoute("/app/history")({
  head: () => ({
    meta: [
      { title: "Search History — SpecLens" },
      { name: "description", content: "Review, re-run and manage previous evidence searches across your datasheets." },
      { property: "og:title", content: "Search History — SpecLens" },
      { property: "og:description", content: "Review, re-run and manage previous evidence searches across your datasheets." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: HistoryPage,
});

function HistoryPage() {
  const [items, setItems] = useState(mockHistory);
  return (
    <div>
      <PageHeader title="Recent" subtitle="Every search, with its best evidence match." />
      <div className="space-y-4 px-4 py-6 sm:px-6">
        {items.length === 0 ? (
          <EmptyState icon={Clock} title="No searches yet." description="Run a visual search to build your history."
            action={<Button asChild size="sm"><Link to="/app/search" search={{ q: "" }}>Open Visual Search</Link></Button>} />
        ) : (
          <ul className="divide-y divide-border overflow-hidden rounded-lg border border-border">
            {items.map((h) => (
              <li key={h.id} className="flex flex-wrap items-center gap-3 bg-surface px-3 py-3">
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[13px] font-medium">“{h.query}”</span>
                  <span className="block font-mono text-[11px] text-muted-foreground">
                    {h.mpn} · {h.results} results · best {(h.bestConfidence * 100).toFixed(1)}% · {h.at}
                  </span>
                </span>
                <Button asChild size="sm" variant="secondary">
                  <Link to="/app/search" search={{ q: h.query }}><RotateCw className="size-3.5" />Re-run</Link>
                </Button>
                <Button size="sm" variant="ghost" aria-label={`Delete search ${h.query}`}
                  onClick={() => setItems((s) => s.filter((x) => x.id !== h.id))}>
                  <Trash2 className="size-3.5" />
                </Button>
              </li>
            ))}
          </ul>
        )}
        <DemoNotice />
      </div>
    </div>
  );
}

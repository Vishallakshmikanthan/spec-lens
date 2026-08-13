import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { Grid2x2, List, Search, Star, Upload } from "lucide-react";
import { PageHeader, Section, EmptyState, DemoNotice } from "@/components/speclens/primitives";
import { DocPage } from "@/components/speclens/doc-page";
import { StatusPill } from "@/components/speclens/status-pill";
import { Button } from "@/components/ui/button";
import { mockDatasheets } from "@/lib/speclens/mock-data";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/app/datasheets")({
  head: () => ({
    meta: [
      { title: "Datasheet Library — SpecLens" },
      {
        name: "description",
        content:
          "Browse, filter and manage indexed engineering datasheets and their evidence regions.",
      },
      { property: "og:title", content: "Datasheet Library — SpecLens" },
      {
        property: "og:description",
        content:
          "Browse, filter and manage indexed engineering datasheets and their evidence regions.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Library,
});

function Library() {
  const [q, setQ] = useState("");
  const [view, setView] = useState<"grid" | "list">("grid");
  const [favOnly, setFavOnly] = useState(false);
  const [sort, setSort] = useState<"updated" | "evidence" | "pages">("updated");

  let items = mockDatasheets.filter((d) =>
    [d.mpn, d.manufacturer, d.title].join(" ").toLowerCase().includes(q.toLowerCase()),
  );
  if (favOnly) items = items.filter((d) => d.favorite);
  items = [...items].sort((a, b) =>
    sort === "evidence"
      ? b.evidenceCount - a.evidenceCount
      : sort === "pages"
        ? b.pages - a.pages
        : b.updatedAt.localeCompare(a.updatedAt),
  );

  return (
    <div>
      <PageHeader
        title="Datasheets"
        subtitle="Indexed engineering documents in this workspace."
        actions={
          <Button asChild size="sm">
            <Link to="/app/upload">
              <Upload className="size-3.5" />
              Upload
            </Link>
          </Button>
        }
      />
      <div className="space-y-5 px-4 py-6 sm:px-6">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative min-w-[220px] flex-1">
            <Search
              className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
              aria-hidden="true"
            />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search library…"
              aria-label="Search datasheets"
              className="h-9 w-full rounded-md border border-border bg-surface pl-9 pr-3 text-[13px] outline-none focus-visible:border-primary/60"
            />
          </div>
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value as typeof sort)}
            aria-label="Sort by"
            className="h-9 rounded-md border border-border bg-surface px-2.5 text-[12.5px]"
          >
            <option value="updated">Recently updated</option>
            <option value="evidence">Most evidence</option>
            <option value="pages">Most pages</option>
          </select>
          <Button
            variant={favOnly ? "secondary" : "outline"}
            size="sm"
            onClick={() => setFavOnly((f) => !f)}
            aria-pressed={favOnly}
          >
            <Star className="size-3.5" />
            Favorites
          </Button>
          <div className="flex overflow-hidden rounded-md border border-border">
            <button
              onClick={() => setView("grid")}
              aria-label="Grid view"
              aria-pressed={view === "grid"}
              className={cn("px-2.5 py-2", view === "grid" ? "bg-secondary" : "bg-surface")}
            >
              <Grid2x2 className="size-3.5" />
            </button>
            <button
              onClick={() => setView("list")}
              aria-label="List view"
              aria-pressed={view === "list"}
              className={cn(
                "border-l border-border px-2.5 py-2",
                view === "list" ? "bg-secondary" : "bg-surface",
              )}
            >
              <List className="size-3.5" />
            </button>
          </div>
        </div>

        {items.length === 0 ? (
          <EmptyState
            icon={Search}
            title="Your engineering library is empty."
            description="No datasheets match this filter yet."
            action={
              <Button asChild size="sm">
                <Link to="/app/upload">Upload your first datasheet</Link>
              </Button>
            }
          />
        ) : view === "grid" ? (
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
            {items.map((d) => (
              <article key={d.id} className="panel animate-rise overflow-hidden">
                <div className="border-b border-border bg-background/50 p-4">
                  <div className="mx-auto w-28">
                    <DocPage type="pinout" mpn={d.mpn} page={1} />
                  </div>
                </div>
                <div className="space-y-2.5 p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <h3 className="truncate font-mono text-[13px] font-medium">{d.mpn}</h3>
                      <p className="truncate text-[12px] text-muted-foreground">{d.manufacturer}</p>
                    </div>
                    <StatusPill status={d.status} />
                  </div>
                  <p className="truncate text-[12.5px]">{d.title}</p>
                  <p className="font-mono text-[11px] text-muted-foreground">
                    {d.pages} pages · {d.sizeMb} MB · {d.evidenceCount} evidence
                  </p>
                  <div className="flex gap-2 pt-1">
                    <Button asChild size="sm" variant="secondary" className="flex-1">
                      <Link to="/app/evidence" search={{ doc: d.id, ev: undefined }}>
                        Open
                      </Link>
                    </Button>
                    <Button asChild size="sm" variant="outline" className="flex-1">
                      <Link to="/app/search" search={{ q: d.mpn }}>
                        Search
                      </Link>
                    </Button>
                  </div>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <ul className="divide-y divide-border overflow-hidden rounded-lg border border-border">
            {items.map((d) => (
              <li key={d.id}>
                <Link
                  to="/app/evidence"
                  search={{ doc: d.id, ev: undefined }}
                  className="flex items-center gap-3 bg-surface px-3 py-3 hover:bg-surface-raised"
                >
                  <span className="w-10 shrink-0">
                    <DocPage type="pinout" mpn={d.mpn} dense />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[13px] font-medium">
                      {d.mpn} — {d.title}
                    </span>
                    <span className="block truncate text-[12px] text-muted-foreground">
                      {d.manufacturer} · {d.pages} pages · {d.sizeMb} MB · {d.evidenceCount}{" "}
                      evidence
                    </span>
                  </span>
                  <StatusPill status={d.status} />
                </Link>
              </li>
            ))}
          </ul>
        )}
        <DemoNotice />
      </div>
    </div>
  );
}

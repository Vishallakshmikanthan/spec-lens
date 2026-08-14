import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { Grid2x2, List, Search, Star, Upload } from "lucide-react";
import {
  PageHeader,
  Section,
  EmptyState,
  ErrorState,
  DemoNotice,
} from "@/components/speclens/primitives";
import { DocPage } from "@/components/speclens/doc-page";
import { StatusPill } from "@/components/speclens/status-pill";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { mockDatasheets, mockCollections } from "@/mock/data";

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
  const [filterManufacturer, setFilterManufacturer] = useState<string | undefined>(undefined);
  const [filterStatus, setFilterStatus] = useState<"indexed" | "indexing" | "queued" | "failed">(
    undefined,
  );
  const [filterCollection, setFilterCollection] = useState<string | undefined>(undefined);

  let items = mockDatasheets.filter((d) =>
    [d.mpn, d.manufacturer, d.title, d.fileName].join(" ").toLowerCase().includes(q.toLowerCase()),
  );
  if (filterManufacturer) items = items.filter((d) => d.manufacturer === filterManufacturer);
  if (filterStatus) items = items.filter((d) => d.status === filterStatus);
  if (filterCollection) items = items.filter((d) => d.collections.includes(filterCollection));
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
        <Section title="Filter" description="Refine your datasheet library view">
          <div className="flex flex-wrap gap-3">
            <div className="relative flex-1">
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
              value={filterManufacturer}
              onChange={(e) => setFilterManufacturer(e.target.value as string)}
              aria-label="Filter by manufacturer"
              className="h-9 rounded-md border border-border bg-surface px-2.5 text-[12.5px] w-48"
            >
              <option value="">All manufacturers</option>
              <option value="Texas Instruments">Texas Instruments</option>
              <option value="STMicroelectronics">STMicroelectronics</option>
              <option value="Espressif">Espressif</option>
            </select>
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value as typeof filterStatus)}
              aria-label="Filter by status"
              className="h-9 rounded-md border border-border bg-surface px-2.5 text-[12.5px] w-48"
            >
              <option value="">All statuses</option>
              <option value="indexed">Indexed</option>
              <option value="indexing">Indexing</option>
              <option value="queued">Queued</option>
              <option value="failed">Failed</option>
            </select>
            <select
              value={filterCollection}
              onChange={(e) => setFilterCollection(e.target.value as string)}
              aria-label="Filter by collection"
              className="h-9 rounded-md border border-border bg-surface px-2.5 text-[12.5px] w-48"
            >
              <option value="">All collections</option>
              {mockCollections.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
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
          </div>
        </Section>

        <Section>
          <div className="flex flex-col sm:flex-row gap-2">
            <Button
              variant={view === "grid" ? "secondary" : "outline"}
              size="icon"
              aria-label="Grid view"
              onClick={() => setView("grid")}
              className={cn("p-2", view === "grid" ? "bg-secondary" : "bg-surface")}
            >
              <Grid2x2 className="size-4" />
            </Button>
            <Button
              variant={view === "list" ? "secondary" : "outline"}
              size="icon"
              aria-label="List view"
              onClick={() => setView("list")}
              className={cn(
                "p-2 border-l border-border",
                view === "list" ? "bg-secondary" : "bg-surface",
              )}
            >
              <List className="size-4" />
            </Button>
            <Button
              variant="outline"
              size="icon"
              aria-label="Recent"
              onClick={() => setFilterStatus(undefined)}
              className={cn("p-2", "hover:bg-surface")}
            >
              <Star className="size-4" />
              Recent
            </Button>
          </div>
        </Section>

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
              <article
                key={d.id}
                className="panel animate-rise overflow-hidden border border-border rounded-lg"
              >
                <div className="p-4 flex flex-col h-48">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="truncate font-mono text-[12px] font-medium text-primary">
                      {d.mpn}
                    </h3>
                    <StatusPill status={d.status} />
                  </div>
                  <DocPage type="pinout" mpn={d.mpn} page={1} className="h-24 w-24 mx-auto mb-3" />
                  <p className="truncate text-[11px] text-muted-foreground line-clamp-2">
                    {d.title}
                  </p>
                </div>
                <div className="p-3 space-y-1.5">
                  <p className="text-[10px] text-muted-foreground flex items-center gap-2">
                    <span>{d.manufacturer}</span>
                    <span>·</span>
                    <span>{d.pages} pages</span>
                    <span>·</span>
                    <span>{d.sizeMb} MB</span>
                  </p>
                  <p className="text-[10px] text-muted-foreground flex items-center gap-2">
                    <span>{d.evidenceCount} evidence regions</span>
                    <span>·</span>
                    <span>{new Date(d.updatedAt).toLocaleDateString()}</span>
                  </p>
                  <div className="flex gap-1 pt-1">
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
                    <Button asChild size="sm" variant="ghost" className="flex-1">
                      More
                    </Button>
                  </div>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <ul className="divide-y divide-border overflow-hidden rounded-lg border border-border">
            {items.map((d) => (
              <li key={d.id} className="p-3 hover:bg-surface-raised transition-colors">
                <Link
                  to="/app/evidence"
                  search={{ doc: d.id, ev: undefined }}
                  className="flex items-center gap-3"
                >
                  <span className="w-12 shrink-0">
                    <DocPage type="pinout" mpn={d.mpn} dense className="size-6" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[12px] font-medium">
                      {d.mpn} — {d.title}
                    </span>
                    <span className="block truncate text-[11px] text-muted-foreground">
                      {d.manufacturer} · {d.pages} pages · {d.sizeMb} MB · {d.evidenceCount}{" "}
                      evidence
                    </span>
                  </span>
                  <StatusPill status={d.status} />
                </Link>
                <div className="mt-2 flex gap-2 text-[10px] text-muted-foreground">
                  <span>Updated: {new Date(d.updatedAt).toLocaleDateString()}</span>
                  <span>
                    Collections: {d.collections.length > 0 ? d.collections.join(", ") : "None"}
                  </span>
                </div>
              </li>
            ))}
          </ul>
        )}
        <DemoNotice />
      </div>
    </div>
  );
}

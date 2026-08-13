import { createFileRoute, Link } from "@tanstack/react-router";
import { FolderOpen, Plus } from "lucide-react";
import { PageHeader, DemoNotice } from "@/components/speclens/primitives";
import { Button } from "@/components/ui/button";
import { mockCollections } from "@/lib/speclens/mock-data";
import { toast } from "sonner";

export const Route = createFileRoute("/app/collections")({
  head: () => ({
    meta: [
      { title: "Collections — SpecLens" },
      { name: "description", content: "Organize verified evidence, datasheets and components into research collections." },
      { property: "og:title", content: "Collections — SpecLens" },
      { property: "og:description", content: "Organize verified evidence, datasheets and components into research collections." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: CollectionsPage,
});

function CollectionsPage() {
  return (
    <div>
      <PageHeader title="Collections" subtitle="Organize verified evidence beyond a single search."
        actions={<Button size="sm" onClick={() => toast.info("Creating collections requires the SpecLens backend.")}>
          <Plus className="size-3.5" />New collection</Button>} />
      <div className="space-y-4 px-4 py-6 sm:px-6">
        <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {mockCollections.map((c) => (
            <li key={c.id} className="panel p-4">
              <FolderOpen className="size-4 text-primary" aria-hidden="true" />
              <h2 className="mt-3 text-[14px] font-medium">{c.name}</h2>
              <p className="mt-1 text-[12.5px] text-muted-foreground">{c.description}</p>
              <p className="mt-3 font-mono text-[11px] text-muted-foreground">
                {c.datasheets} datasheets · {c.evidence} evidence · {c.components} components
              </p>
              <Button asChild size="sm" variant="secondary" className="mt-3 w-full">
                <Link to="/app/evidence" search={{ doc: undefined, ev: undefined }}>Open collection</Link>
              </Button>
            </li>
          ))}
        </ul>
        <DemoNotice />
      </div>
    </div>
  );
}

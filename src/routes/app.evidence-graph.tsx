import { createFileRoute, Link } from "@tanstack/react-router";
import { EvidenceGraph } from "@/components/speclens/evidence-graph";
import { PageHeader } from "@/components/speclens/primitives";
import { DemoNotice } from "@/components/speclens/primitives";

export const Route = createFileRoute("/app/evidence-graph")({
  head: () => ({
    meta: [
      { title: "Evidence Graph — SpecLens" },
      {
        name: "description",
        content: "Technical relationship graph for LM358 evidence types.",
      },
      { property: "og:title", content: "Evidence Graph — SpecLens" },
      {
        property: "og:description",
        content: "Technical relationship graph for LM358 evidence types.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: EvidenceGraphPage,
});

function EvidenceGraphPage() {
  return (
    <div>
      <PageHeader title="Evidence Graph" subtitle="Technical relationship graph for LM358" />
      <EvidenceGraph />
      <DemoNotice />
    </div>
  );
}

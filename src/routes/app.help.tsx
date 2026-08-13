import { createFileRoute, Link } from "@tanstack/react-router";
import { PageHeader, Section } from "@/components/speclens/primitives";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";

export const Route = createFileRoute("/app/help")({
  head: () => ({
    meta: [
      { title: "Help — SpecLens" },
      { name: "description", content: "How SpecLens retrieval, evidence verification and provenance work, plus keyboard shortcuts." },
      { property: "og:title", content: "Help — SpecLens" },
      { property: "og:description", content: "How SpecLens retrieval, evidence verification and provenance work, plus keyboard shortcuts." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: HelpPage,
});

const faqs = [
  ["How does visual search work?", "Queries are matched against detected visual regions — figures, tables and diagrams — using semantic similarity, visual similarity and figure classification, then ranked by retrieval score."],
  ["What makes evidence “verified”?", "A region is verified when its detected type, caption and surrounding context agree with the retrieved claim. Unverified and flagged regions remain visible but are labelled."],
  ["Why is there no AI answer at the top?", "SpecLens prioritises retrieved evidence. Copilot answers are always grounded in cited regions with page numbers, evidence IDs and confidence."],
  ["Is this data real?", "No. This build runs in demo mode against a typed mock dataset. Nothing shown is a real measurement or model output."],
];

const shortcuts = [["⌘K / Ctrl+K", "Open command palette"], ["⌘S", "Search evidence"], ["⌘U", "Upload datasheet"], ["⌘,", "Settings"]];

function HelpPage() {
  return (
    <div>
      <PageHeader title="Help" subtitle="How SpecLens works." />
      <div className="max-w-2xl space-y-8 px-4 py-6 sm:px-6">
        <Section title="Frequently asked">
          <Accordion type="single" collapsible className="rounded-lg border border-border">
            {faqs.map(([q, a]) => (
              <AccordionItem key={q} value={q!} className="px-3">
                <AccordionTrigger className="text-[13px]">{q}</AccordionTrigger>
                <AccordionContent className="text-[12.5px] text-muted-foreground">{a}</AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </Section>
        <Section title="Keyboard shortcuts">
          <ul className="divide-y divide-border overflow-hidden rounded-lg border border-border">
            {shortcuts.map(([k, v]) => (
              <li key={k} className="flex items-center justify-between bg-surface px-3 py-2.5 text-[12.5px]">
                <span>{v}</span>
                <kbd className="rounded border border-border bg-secondary px-1.5 py-0.5 font-mono text-[11px]">{k}</kbd>
              </li>
            ))}
          </ul>
        </Section>
        <p className="text-[12.5px] text-muted-foreground">
          Still stuck? <Link to="/app/developer" className="text-primary hover:underline">Open the developer console</Link> to inspect the API contract.
        </p>
      </div>
    </div>
  );
}

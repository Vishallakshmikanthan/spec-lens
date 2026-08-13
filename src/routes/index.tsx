import { createFileRoute, Link } from "@tanstack/react-router";
import {
  ArrowRight,
  Boxes,
  Check,
  FileSearch,
  Gauge,
  Layers,
  ScanSearch,
  ShieldCheck,
  Workflow,
} from "lucide-react";
import { SpecLensLogo } from "@/components/speclens/logo";
import { DocPage } from "@/components/speclens/doc-page";
import { Button } from "@/components/ui/button";
import { ConfidenceBar, EvidenceTypeBadge, VerificationBadge } from "@/components/speclens/evidence-ui";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "SpecLens — Visual Intelligence for Technical Specifications" },
      {
        name: "description",
        content:
          "SpecLens turns massive engineering datasheets into searchable, verifiable visual evidence with provenance and confidence.",
      },
      { property: "og:title", content: "SpecLens — Visual Intelligence for Technical Specifications" },
      {
        property: "og:description",
        content:
          "Search datasheets in natural language, retrieve exact document regions, and verify engineering evidence.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Landing,
});

const pipeline = [
  { label: "PDF", icon: FileSearch },
  { label: "Document Understanding", icon: Layers },
  { label: "Visual Retrieval", icon: ScanSearch },
  { label: "Evidence", icon: Boxes },
  { label: "Verification", icon: ShieldCheck },
];

function PipelineViz() {
  return (
    <div className="panel relative overflow-hidden p-5 sm:p-6">
      <div className="pointer-events-none absolute inset-0 grid-bg opacity-60" aria-hidden="true" />
      <div className="relative flex flex-col gap-3">
        {pipeline.map((step, i) => (
          <div key={step.label} className="flex items-center gap-3">
            <span className="grid size-8 shrink-0 place-items-center rounded-md border border-border bg-surface-raised">
              <step.icon className="size-4 text-primary" aria-hidden="true" />
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between gap-2">
                <span className="text-[13px] font-medium">{step.label}</span>
                <span className="font-mono text-[10.5px] text-muted-foreground">
                  {String(i + 1).padStart(2, "0")}
                </span>
              </div>
              <div className="mt-1.5 h-[3px] w-full overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full rounded-full bg-primary/70"
                  style={{ width: `${60 + i * 9}%`, transitionDelay: `${i * 80}ms` }}
                />
              </div>
            </div>
          </div>
        ))}
      </div>
      <svg className="pointer-events-none absolute inset-y-6 left-[34px] w-px" aria-hidden="true">
        <line x1="0" y1="0" x2="0" y2="100%" stroke="currentColor" className="flow-dash text-primary/40" />
      </svg>
    </div>
  );
}

function ProductPreview() {
  return (
    <div className="panel overflow-hidden shadow-[var(--shadow-lift)]">
      <div className="flex items-center gap-2 border-b border-border px-4 py-2.5">
        <span className="flex gap-1.5" aria-hidden="true">
          <span className="size-2 rounded-full bg-border-strong" />
          <span className="size-2 rounded-full bg-border-strong" />
          <span className="size-2 rounded-full bg-border-strong" />
        </span>
        <div className="ml-2 flex min-w-0 flex-1 items-center gap-2 rounded-md border border-border bg-background px-2.5 py-1.5">
          <ScanSearch className="size-3.5 shrink-0 text-primary" aria-hidden="true" />
          <span className="truncate text-[12.5px]">Find the pin configuration</span>
          <span className="ml-auto hidden font-mono text-[10.5px] text-muted-foreground sm:inline">
            LM358 · 218 ms
          </span>
        </div>
      </div>

      <div className="grid gap-0 lg:grid-cols-[1.35fr_1fr]">
        <div className="relative border-b border-border bg-background/60 p-5 lg:border-b-0 lg:border-r">
          <div className="mx-auto max-w-[320px]">
            <DocPage
              type="pinout"
              mpn="LM358"
              page={4}
              title="Pin Configuration"
              bbox={{ x: 0.12, y: 0.22, w: 0.5, h: 0.3 }}
              highlight
            />
          </div>
          <span className="absolute bottom-3 left-5 font-mono text-[10.5px] text-muted-foreground">
            LM358.pdf · page 4 / 243
          </span>
        </div>

        <div className="space-y-4 p-5">
          <EvidenceTypeBadge type="pinout" />
          <div>
            <h3 className="text-[15px] font-medium">Pin Configuration</h3>
            <p className="mt-1 text-[12.5px] text-muted-foreground">
              SOIC (D) package, 8 pins — top view.
            </p>
          </div>
          <dl className="grid grid-cols-2 gap-3 text-[12.5px]">
            <div>
              <dt className="text-muted-foreground">Page</dt>
              <dd className="font-mono">4</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Region</dt>
              <dd className="font-mono">EV-0017</dd>
            </div>
          </dl>
          <div>
            <p className="mb-1.5 text-[12px] text-muted-foreground">Confidence</p>
            <ConfidenceBar value={0.987} />
          </div>
          <VerificationBadge state="verified" />
          <ul className="space-y-1.5 border-t border-border pt-3 text-[12px] text-muted-foreground">
            {["semantic similarity", "visual similarity", "figure classification"].map((m) => (
              <li key={m} className="flex items-center gap-2">
                <Check className="size-3.5 text-success" aria-hidden="true" />
                {m}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}

const features = [
  {
    icon: Layers,
    title: "Document understanding",
    body: "Layout analysis segments every page into figures, tables, captions and text blocks before retrieval ever runs.",
  },
  {
    icon: ScanSearch,
    title: "Visual retrieval",
    body: "Natural language and MPN queries are matched against visual regions, not just extracted text.",
  },
  {
    icon: ShieldCheck,
    title: "Verified evidence",
    body: "Every result carries page, bounding box, retrieval method, confidence and model version.",
  },
  {
    icon: Workflow,
    title: "Engineering artifacts",
    body: "Evidence graphs, component intelligence and symbol specifications built on the same provenance chain.",
  },
  {
    icon: Gauge,
    title: "Retrieval analytics",
    body: "Precision@5, recall, latency and confidence distributions for the whole workspace.",
  },
  {
    icon: Boxes,
    title: "Collections",
    body: "Save verified regions into research collections that survive beyond a single search.",
  },
];

function Landing() {
  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-40 border-b border-border bg-background/80 backdrop-blur-md">
        <div className="mx-auto flex h-14 max-w-6xl items-center gap-4 px-4 sm:px-6">
          <SpecLensLogo />
          <nav className="ml-6 hidden items-center gap-5 text-[13px] text-muted-foreground md:flex" aria-label="Primary">
            <a href="#preview" className="transition-colors hover:text-foreground">Product</a>
            <a href="#capabilities" className="transition-colors hover:text-foreground">Capabilities</a>
            <a href="#pipeline" className="transition-colors hover:text-foreground">Pipeline</a>
          </nav>
          <div className="ml-auto flex items-center gap-2">
            <Button asChild variant="ghost" size="sm">
              <Link to="/login">Sign in</Link>
            </Button>
            <Button asChild size="sm">
              <Link to="/app">Explore SpecLens</Link>
            </Button>
          </div>
        </div>
      </header>

      <main>
        <section className="relative overflow-hidden border-b border-border">
          <div className="pointer-events-none absolute inset-0 grid-bg" aria-hidden="true" />
          <div className="pointer-events-none absolute inset-0 hero-glow" aria-hidden="true" />
          <div className="relative mx-auto grid max-w-6xl gap-10 px-4 py-16 sm:px-6 md:py-24 lg:grid-cols-[1.1fr_0.9fr] lg:items-center">
            <div>
              <span className="inline-flex items-center gap-2 rounded-full border border-border bg-surface px-3 py-1 font-mono text-[10.5px] uppercase tracking-[0.16em] text-muted-foreground">
                <span className="size-1.5 rounded-full bg-primary" />
                Visual retrieval research preview
              </span>
              <h1 className="mt-5 text-[40px] font-semibold leading-[1.05] tracking-tight sm:text-[54px]">
                SpecLens
              </h1>
              <p className="mt-3 text-[19px] font-medium text-gradient sm:text-[22px]">
                Visual Intelligence for Technical Specifications
              </p>
              <p className="mt-4 max-w-lg text-[14.5px] leading-relaxed text-muted-foreground">
                Transform massive engineering datasheets into searchable, verifiable evidence —
                every answer anchored to an exact region of an exact page.
              </p>
              <div className="mt-7 flex flex-wrap gap-3">
                <Button asChild size="lg">
                  <Link to="/app">
                    Explore SpecLens
                    <ArrowRight className="size-4" />
                  </Link>
                </Button>
                <Button asChild size="lg" variant="outline">
                  <Link to="/app/search">View Demo</Link>
                </Button>
              </div>
              <dl className="mt-10 grid max-w-md grid-cols-3 gap-4 border-t border-border pt-6">
                {[
                  ["1,284", "Datasheets indexed"],
                  ["48,921", "Evidence regions"],
                  ["0.912", "Precision@5"],
                ].map(([v, l]) => (
                  <div key={l}>
                    <dt className="sr-only">{l}</dt>
                    <dd className="text-[20px] font-semibold tabular-nums">{v}</dd>
                    <dd className="text-[11.5px] text-muted-foreground">{l}</dd>
                  </div>
                ))}
              </dl>
            </div>
            <div id="pipeline" className="scroll-mt-20">
              <PipelineViz />
            </div>
          </div>
        </section>

        <section id="preview" className="scroll-mt-16 border-b border-border">
          <div className="mx-auto max-w-6xl px-4 py-14 sm:px-6 md:py-20">
            <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
              <div>
                <h2 className="font-mono text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
                  Query → Evidence → Region → Verification
                </h2>
                <p className="mt-2 text-[20px] font-medium tracking-tight">
                  The search result is the document itself.
                </p>
              </div>
              <p className="max-w-sm text-[13px] text-muted-foreground">
                SpecLens does not answer with prose first. It returns ranked visual evidence and
                shows you exactly where it came from.
              </p>
            </div>
            <ProductPreview />
          </div>
        </section>

        <section id="capabilities" className="scroll-mt-16">
          <div className="mx-auto max-w-6xl px-4 py-14 sm:px-6 md:py-20">
            <h2 className="font-mono text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
              Capabilities
            </h2>
            <div className="mt-6 grid gap-px overflow-hidden rounded-lg border border-border bg-border sm:grid-cols-2 lg:grid-cols-3">
              {features.map((f) => (
                <div key={f.title} className="bg-surface p-5">
                  <f.icon className="size-4 text-primary" aria-hidden="true" />
                  <h3 className="mt-3 text-[14px] font-medium">{f.title}</h3>
                  <p className="mt-1.5 text-[12.5px] leading-relaxed text-muted-foreground">
                    {f.body}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="border-t border-border">
          <div className="mx-auto flex max-w-6xl flex-col items-start gap-4 px-4 py-14 sm:px-6 md:flex-row md:items-center md:justify-between">
            <div>
              <h2 className="text-[22px] font-semibold tracking-tight">
                Turn datasheets into engineering intelligence.
              </h2>
              <p className="mt-1.5 text-[13.5px] text-muted-foreground">
                Open the demo workspace — no backend connection required.
              </p>
            </div>
            <Button asChild size="lg">
              <Link to="/register">Create workspace</Link>
            </Button>
          </div>
        </section>
      </main>

      <footer className="border-t border-border">
        <div className="mx-auto flex max-w-6xl flex-col gap-3 px-4 py-8 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <SpecLensLogo />
          <p className="font-mono text-[11px] text-muted-foreground">
            Demo build — all data shown is illustrative mock data.
          </p>
        </div>
      </footer>
    </div>
  );
}

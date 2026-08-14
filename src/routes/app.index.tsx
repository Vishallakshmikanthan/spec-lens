import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import type { LucideIcon } from "lucide-react";
import {
  AlertTriangle,
  Boxes,
  FileCheck2,
  FileText,
  FolderOpen,
  Layers,
  ScanSearch,
  Search,
  SearchCheck,
  ShieldCheck,
  Star,
  Upload,
} from "lucide-react";
import { PageHeader, KpiCard, Section, DemoNotice } from "@/components/speclens/primitives";
import { DocPage } from "@/components/speclens/doc-page";
import { StatusPill } from "@/components/speclens/status-pill";
import {
  mockActivity,
  mockCommandCenterMetrics,
  mockDatasheets,
  mockPipelineStages,
} from "@/lib/speclens/mock-data";
import { cn } from "@/lib/utils";
import type { ActivityEvent } from "@/types/speclens";

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

const metricIcons: LucideIcon[] = [FileText, Boxes, Search, ShieldCheck];

const activityMeta: Record<
  ActivityEvent["kind"],
  { icon: LucideIcon; label: string; cls: string }
> = {
  index: {
    icon: FileCheck2,
    label: "Indexed",
    cls: "text-primary border-primary/30 bg-primary/10",
  },
  detect: {
    icon: ScanSearch,
    label: "Detected",
    cls: "text-primary border-primary/30 bg-primary/10",
  },
  verify: {
    icon: ShieldCheck,
    label: "Verified",
    cls: "text-success border-success/30 bg-success/10",
  },
  query: {
    icon: SearchCheck,
    label: "Query",
    cls: "text-muted-foreground border-border bg-secondary",
  },
  error: {
    icon: AlertTriangle,
    label: "Failed",
    cls: "text-destructive border-destructive/30 bg-destructive/10",
  },
};

const quickActions = [
  {
    label: "Upload Datasheet",
    description: "Add a PDF to the index",
    to: "/app/upload",
    icon: Upload,
  },
  {
    label: "Visual Search",
    description: "Search figures and regions",
    to: "/app/search",
    icon: ScanSearch,
  },
  {
    label: "Search Components",
    description: "Explore component intelligence",
    to: "/app/components",
    icon: Layers,
  },
  {
    label: "Open Collections",
    description: "Browse saved collections",
    to: "/app/collections",
    icon: FolderOpen,
  },
] as const;

function formatUpdated(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function IntelligenceGraph() {
  const stages = mockPipelineStages;
  const spineX = 30;
  const cardX = spineX + 20;
  const cardW = 420 - cardX - 16;
  const rowH = 40;
  const gap = 16;
  const startY = 26;
  const H = startY * 2 + stages.length * rowH + (stages.length - 1) * gap;

  return (
    <div className="panel overflow-hidden p-4">
      <svg
        viewBox={`0 0 420 ${H}`}
        className="w-full"
        role="img"
        aria-label="Intelligence pipeline: datasheets to verified evidence"
      >
        {stages.map((s, i) => {
          const cy = startY + i * (rowH + gap) + rowH / 2;
          const next = stages[i + 1];
          return (
            <g key={s.label}>
              {next && (
                <line
                  x1={spineX}
                  y1={cy + rowH / 2}
                  x2={spineX}
                  y2={cy + rowH / 2 + gap}
                  stroke="currentColor"
                  className="flow-dash text-primary/40"
                  strokeWidth="1.5"
                />
              )}
              <circle
                cx={spineX}
                cy={cy}
                r="5"
                className={
                  s.verified ? "fill-success/20 stroke-success" : "fill-primary/10 stroke-primary"
                }
                strokeWidth="1.5"
              />
              {s.verified && (
                <path
                  d={`M${spineX - 2.5} ${cy}l2 2 4-4.5`}
                  fill="none"
                  className="stroke-success"
                  strokeWidth="1.4"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              )}
              <rect
                x={cardX}
                y={cy - rowH / 2}
                width={cardW}
                height={rowH}
                rx="7"
                className="fill-surface-raised stroke-border"
              />
              <text
                x={cardX + 16}
                y={cy - 4}
                className="fill-foreground"
                style={{ fontSize: 12.5, fontWeight: 600 }}
              >
                {s.label}
              </text>
              <text
                x={cardX + 16}
                y={cy + 14}
                className="fill-muted-foreground"
                style={{ fontSize: 9.5 }}
              >
                {s.caption}
              </text>
              <text
                x={420 - 28}
                y={cy + 4}
                textAnchor="end"
                className={s.verified ? "fill-success" : "fill-muted-foreground"}
                style={{ fontSize: 11, fontFamily: "monospace" }}
              >
                {s.count}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

function CommandCenter() {
  const navigate = useNavigate();
  const [q, setQ] = useState("");

  return (
    <div>
      <PageHeader title="Command Center" subtitle="Your engineering intelligence workspace." />
      <div className="space-y-6 px-4 py-6 sm:px-6">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void navigate({ to: "/app/search", search: { q } });
          }}
          className="relative"
        >
          <Search
            className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden="true"
          />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            aria-label="Search datasheets, components, figures, evidence"
            placeholder="Search datasheets, components, figures, evidence…"
            className="h-12 w-full rounded-lg border border-border bg-surface pl-10 pr-16 text-[14px] outline-none transition-colors placeholder:text-muted-foreground focus-visible:border-primary/60"
          />
          <kbd className="absolute right-3.5 top-1/2 hidden -translate-y-1/2 items-center gap-1 rounded border border-border bg-secondary px-1.5 py-0.5 font-mono text-[10.5px] text-muted-foreground sm:flex">
            ⌘K
          </kbd>
        </form>

        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {mockCommandCenterMetrics.map((m, i) => (
            <KpiCard
              key={m.label}
              label={m.label}
              value={m.value}
              hint={m.hint}
              icon={metricIcons[i]}
              delta={m.delta}
            />
          ))}
        </div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <Section
            title="Recent datasheets"
            className="order-1 lg:order-none lg:col-span-2"
            actions={
              <Link
                to="/app/datasheets"
                className="text-[12px] text-muted-foreground transition-colors hover:text-foreground"
              >
                View all →
              </Link>
            }
          >
            <div className="grid gap-3 sm:grid-cols-2">
              {mockDatasheets.slice(0, 4).map((d, i) => (
                <Link
                  key={d.id}
                  to="/app/evidence"
                  search={{ doc: d.id, ev: undefined }}
                  className="panel animate-rise group relative flex gap-4 overflow-hidden p-3.5 transition-colors hover:border-border-strong"
                  style={{ animationDelay: `${i * 70}ms` }}
                >
                  <span className="w-[72px] shrink-0">
                    <DocPage type="pinout" mpn={d.mpn} />
                  </span>
                  <span className="flex min-w-0 flex-1 flex-col">
                    <span className="flex items-start justify-between gap-2">
                      <span className="truncate font-mono text-[12.5px] font-semibold tracking-tight">
                        {d.mpn}
                      </span>
                      {d.favorite && (
                        <Star
                          className="size-3.5 shrink-0 fill-warning text-warning"
                          aria-label="Favorite"
                        />
                      )}
                    </span>
                    <span className="truncate text-[12px]">{d.title}</span>
                    <span className="truncate text-[11.5px] text-muted-foreground">
                      {d.manufacturer}
                    </span>
                    <span className="mt-auto flex items-center justify-between gap-2 pt-2">
                      <span className="font-mono text-[10.5px] text-muted-foreground">
                        {d.pages} pages · {d.evidenceCount} evidence
                      </span>
                      <StatusPill status={d.status} />
                    </span>
                    <span className="font-mono text-[10px] text-muted-foreground/60">
                      Updated {formatUpdated(d.updatedAt)}
                    </span>
                  </span>
                </Link>
              ))}
            </div>
          </Section>

          <Section
            title="Intelligence activity"
            description="Live processing feed across workspaces"
            className="order-3 lg:order-none"
          >
            <div className="panel overflow-hidden">
              <div className="flex items-center justify-between border-b border-border px-3.5 py-2.5">
                <span className="font-mono text-[10.5px] uppercase tracking-[0.14em] text-muted-foreground">
                  Live feed
                </span>
                <span className="inline-flex items-center gap-1.5 font-mono text-[10px] text-success">
                  <span className="size-1.5 animate-pulse rounded-full bg-success" />
                  LIVE
                </span>
              </div>
              <ul className="divide-y divide-border">
                {mockActivity.map((a) => {
                  const meta = activityMeta[a.kind];
                  return (
                    <li key={a.id} className="flex gap-3 px-3.5 py-3">
                      <span
                        className={cn(
                          "mt-0.5 grid size-6 shrink-0 place-items-center rounded-sm border",
                          meta.cls,
                        )}
                      >
                        <meta.icon className="size-3" aria-hidden="true" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="flex items-center gap-2">
                          <span className="truncate text-[12.5px] font-medium">{a.title}</span>
                          <span
                            className={cn(
                              "shrink-0 rounded-sm border px-1.5 py-px font-mono text-[9.5px] uppercase tracking-wider",
                              meta.cls,
                            )}
                          >
                            {meta.label}
                          </span>
                        </span>
                        <span className="mt-0.5 block text-[12px] text-muted-foreground">
                          {a.detail}
                        </span>
                      </span>
                      <span className="shrink-0 font-mono text-[10.5px] text-muted-foreground/70">
                        {a.at}
                      </span>
                    </li>
                  );
                })}
              </ul>
            </div>
          </Section>

          <Section title="Quick actions" className="order-2 lg:order-none lg:col-span-2">
            <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
              {quickActions.map((a) => (
                <Link
                  key={a.to}
                  to={a.to}
                  className="panel group flex flex-col gap-3 p-4 transition-colors hover:border-primary/40"
                >
                  <span className="grid size-9 place-items-center rounded-md border border-border bg-secondary text-muted-foreground transition-colors group-hover:border-primary/40 group-hover:text-primary">
                    <a.icon className="size-4" aria-hidden="true" />
                  </span>
                  <span>
                    <span className="block text-[13px] font-medium">{a.label}</span>
                    <span className="mt-0.5 block text-[11.5px] text-muted-foreground">
                      {a.description}
                    </span>
                  </span>
                </Link>
              ))}
            </div>
          </Section>

          <Section
            title="Intelligence graph"
            description="From raw documents to verified evidence"
            className="order-4 lg:order-none"
          >
            <IntelligenceGraph />
          </Section>
        </div>

        <DemoNotice />
      </div>
    </div>
  );
}

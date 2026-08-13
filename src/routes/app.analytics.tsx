import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { PageHeader, Section, DemoNotice } from "@/components/speclens/primitives";
import { mockAnalytics } from "@/lib/speclens/mock-data";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/app/analytics")({
  head: () => ({
    meta: [
      { title: "Retrieval Analytics — SpecLens" },
      {
        name: "description",
        content:
          "Precision, recall, latency, confidence distribution and processing throughput for the workspace.",
      },
      { property: "og:title", content: "Retrieval Analytics — SpecLens" },
      {
        property: "og:description",
        content:
          "Precision, recall, latency, confidence distribution and processing throughput for the workspace.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: AnalyticsPage,
});

const ranges = ["24h", "7d", "30d", "90d"];
const chartColors = [
  "var(--chart-1)",
  "var(--chart-2)",
  "var(--chart-3)",
  "var(--chart-4)",
  "var(--chart-5)",
];

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Section title={title}>
      <div className="panel h-[240px] p-3">
        <ResponsiveContainer width="100%" height="100%">
          {children as never}
        </ResponsiveContainer>
      </div>
    </Section>
  );
}

function AnalyticsPage() {
  const [range, setRange] = useState("7d");
  const a = mockAnalytics;
  return (
    <div>
      <PageHeader
        title="Retrieval Analytics"
        subtitle="Engineering-specific retrieval and verification metrics."
        actions={
          <div
            className="flex overflow-hidden rounded-md border border-border"
            role="group"
            aria-label="Date range"
          >
            {ranges.map((r) => (
              <button
                key={r}
                onClick={() => setRange(r)}
                aria-pressed={range === r}
                className={cn(
                  "px-3 py-1.5 text-[12px]",
                  range === r ? "bg-secondary" : "bg-surface hover:bg-secondary/60",
                )}
              >
                {r}
              </button>
            ))}
          </div>
        }
      />
      <div className="space-y-6 px-4 py-6 sm:px-6">
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {a.metrics.map((m) => (
            <div key={m.label} className="panel p-4">
              <p className="font-mono text-[10.5px] uppercase tracking-[0.14em] text-muted-foreground">
                {m.label}
              </p>
              <p className="mt-2 flex items-baseline gap-2">
                <span className="text-[22px] font-semibold tabular-nums">{m.value}</span>
                <span
                  className={cn(
                    "font-mono text-[11px]",
                    m.positive ? "text-success" : "text-warning",
                  )}
                >
                  {m.delta}
                </span>
              </p>
            </div>
          ))}
        </div>

        <div className="grid gap-5 lg:grid-cols-2">
          <Panel title="Retrieval performance">
            <LineChart data={a.retrieval}>
              <CartesianGrid stroke="var(--border)" vertical={false} />
              <XAxis
                dataKey="day"
                stroke="var(--muted-foreground)"
                fontSize={11}
                tickLine={false}
                axisLine={false}
              />
              <YAxis
                domain={[0.7, 1]}
                stroke="var(--muted-foreground)"
                fontSize={11}
                tickLine={false}
                axisLine={false}
              />
              <Tooltip
                contentStyle={{
                  background: "var(--popover)",
                  border: "1px solid var(--border)",
                  borderRadius: 8,
                  fontSize: 12,
                }}
              />
              <Line
                type="monotone"
                dataKey="precision"
                stroke="var(--chart-1)"
                strokeWidth={2}
                dot={false}
              />
              <Line
                type="monotone"
                dataKey="recall"
                stroke="var(--chart-2)"
                strokeWidth={2}
                dot={false}
              />
            </LineChart>
          </Panel>
          <Panel title="Evidence distribution">
            <BarChart data={a.evidenceDistribution}>
              <CartesianGrid stroke="var(--border)" vertical={false} />
              <XAxis
                dataKey="type"
                stroke="var(--muted-foreground)"
                fontSize={10}
                tickLine={false}
                axisLine={false}
                interval={0}
                angle={-20}
                height={50}
                textAnchor="end"
              />
              <YAxis
                stroke="var(--muted-foreground)"
                fontSize={11}
                tickLine={false}
                axisLine={false}
              />
              <Tooltip
                contentStyle={{
                  background: "var(--popover)",
                  border: "1px solid var(--border)",
                  borderRadius: 8,
                  fontSize: 12,
                }}
              />
              <Bar dataKey="count" fill="var(--chart-1)" radius={[3, 3, 0, 0]} />
            </BarChart>
          </Panel>
          <Panel title="Query types">
            <PieChart>
              <Tooltip
                contentStyle={{
                  background: "var(--popover)",
                  border: "1px solid var(--border)",
                  borderRadius: 8,
                  fontSize: 12,
                }}
              />
              <Pie
                data={a.queryTypes}
                dataKey="value"
                nameKey="name"
                innerRadius={50}
                outerRadius={85}
                paddingAngle={2}
              >
                {a.queryTypes.map((_, i) => (
                  <Cell key={i} fill={chartColors[i % chartColors.length]} />
                ))}
              </Pie>
            </PieChart>
          </Panel>
          <Panel title="Processing throughput">
            <AreaChart data={a.throughput}>
              <CartesianGrid stroke="var(--border)" vertical={false} />
              <XAxis
                dataKey="hour"
                stroke="var(--muted-foreground)"
                fontSize={11}
                tickLine={false}
                axisLine={false}
              />
              <YAxis
                stroke="var(--muted-foreground)"
                fontSize={11}
                tickLine={false}
                axisLine={false}
              />
              <Tooltip
                contentStyle={{
                  background: "var(--popover)",
                  border: "1px solid var(--border)",
                  borderRadius: 8,
                  fontSize: 12,
                }}
              />
              <Area
                type="monotone"
                dataKey="pages"
                stroke="var(--chart-1)"
                fill="var(--chart-1)"
                fillOpacity={0.15}
                strokeWidth={2}
              />
            </AreaChart>
          </Panel>
          <Panel title="Confidence distribution">
            <BarChart data={a.confidence}>
              <CartesianGrid stroke="var(--border)" vertical={false} />
              <XAxis
                dataKey="bucket"
                stroke="var(--muted-foreground)"
                fontSize={11}
                tickLine={false}
                axisLine={false}
              />
              <YAxis
                stroke="var(--muted-foreground)"
                fontSize={11}
                tickLine={false}
                axisLine={false}
              />
              <Tooltip
                contentStyle={{
                  background: "var(--popover)",
                  border: "1px solid var(--border)",
                  borderRadius: 8,
                  fontSize: 12,
                }}
              />
              <Bar dataKey="count" fill="var(--chart-2)" radius={[3, 3, 0, 0]} />
            </BarChart>
          </Panel>
        </div>
        <DemoNotice />
      </div>
    </div>
  );
}

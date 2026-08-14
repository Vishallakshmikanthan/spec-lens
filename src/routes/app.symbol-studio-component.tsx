import { Check, Loader2, Shield, Zap } from "lucide-react";
import { useState } from "react";
import { PageHeader, Section, DemoNotice } from "@/components/speclens/primitives";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/speclens/api";
import { mockSymbolSpec } from "@/lib/speclens/mock-data";
import type { SymbolSpec } from "@/lib/speclens/types";
import { toast } from "sonner";

const flow = ["Verified Evidence", "Symbol Specification", "Validation", "Compilation", "Preview"];

function SymbolPreview({ spec }: { spec: SymbolSpec }) {
  const left = spec.pins.filter((p) => p.side === "left");
  const right = spec.pins.filter((p) => p.side === "right");
  return (
    <svg
      viewBox="0 0 320 220"
      className="w-full"
      role="img"
      aria-label={`${spec.mpn} schematic symbol preview`}
    >
      <rect
        x="100"
        y="50"
        width="120"
        height="120"
        className="fill-surface-raised stroke-foreground/70"
        strokeWidth="1.5"
      />
      <text
        x="160"
        y="105"
        textAnchor="middle"
        className="fill-foreground"
        style={{ fontSize: 13, fontWeight: 600 }}
      >
        {spec.mpn}
      </text>
      <text
        x="160"
        y="122"
        textAnchor="middle"
        className="fill-muted-foreground"
        style={{ fontSize: 9 }}
      >
        {spec.package}
      </text>
      {left.map((p, i) => (
        <g key={p.number}>
          <line
            x1="60"
            y1={70 + i * 26}
            x2="100"
            y2={70 + i * 26}
            className="stroke-primary"
            strokeWidth="1.2"
          />
          <text
            x="56"
            y={74 + i * 26}
            textAnchor="end"
            className="fill-foreground"
            style={{ fontSize: 10, fontFamily: "monospace" }}
          >
            {p.name}
          </text>
        </g>
      ))}
      {right.map((p, i) => (
        <g key={p.number}>
          <line
            x1="220"
            y1={80 + i * 40}
            x2="260"
            y2={80 + i * 40}
            className="stroke-primary"
            strokeWidth="1.2"
          />
          <text
            x="264"
            y={84 + i * 40}
            textAnchor="end"
            className="fill-foreground"
            style={{ fontSize: 10, fontFamily: "monospace" }}
          >
            {p.name}
          </text>
        </g>
      ))}
      <line x1="160" y1="20" x2="160" y2="50" className="stroke-primary" strokeWidth="1.2" />
      <text
        x="160"
        y="16"
        textAnchor="middle"
        className="fill-foreground"
        style={{ fontSize: 10, fontFamily: "monospace" }}
      >
        VCC
      </text>
      <line x1="160" y1="170" x2="160" y2="200" className="stroke-primary" strokeWidth="1.2" />
      <text
        x="160"
        y="212"
        textAnchor="middle"
        className="fill-foreground"
        style={{ fontSize: 10, fontFamily: "monospace" }}
      >
        GND
      </text>
    </svg>
  );
}

function SymbolStudio() {
  const [mpn, setMpn] = useState("LM358");
  const [spec, setSpec] = useState<SymbolSpec | null>(mockSymbolSpec);
  const [busy, setBusy] = useState(false);

  const generate = async () => {
    setBusy(true);
    const s = await api.generateSymbol(mpn);
    setSpec(s);
    setBusy(false);
  };

  return (
    <div>
      <PageHeader
        title="Symbol Studio"
        subtitle="Compose schematic symbols from verified evidence."
      />
      <div className="space-y-6 px-4 py-6 sm:px-6">
        <div className="flex flex-wrap items-center gap-2">
          <input
            value={mpn}
            onChange={(e) => setMpn(e.target.value)}
            aria-label="Component or MPN"
            className="h-9 w-48 rounded-md border border-border bg-surface px-3 font-mono text-[13px] outline-none focus-visible:border-primary/60"
          />
          <Button size="sm" onClick={generate} disabled={busy}>
            {busy && <Loader2 className="size-3.5 animate-spin" />}Generate Symbol
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              if (!spec) {
                toast.warning("No symbol generated yet. Click Generate Symbol first.");
                return;
              }
              let allOk = true;
              spec.validation.forEach((v: { ok: boolean; label: string }) => {
                if (!v.ok) allOk = false;
              });
              if (allOk) {
                toast.success("Validation passed against linked evidence.");
              } else {
                toast.error("Validation failed. Some pins do not match evidence.");
              }
            }}
          >
            Validate
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => {
              if (!spec) {
                toast.info("Export requires a generated symbol.");
                return;
              }
              toast.info("Export requires the SpecLens backend.");
            }}
          >
            Export
          </Button>
        </div>

        <ol className="flex flex-wrap gap-2">
          {flow.map((f, i) => (
            <li
              key={f}
              className="flex items-center gap-2 rounded-md border border-border bg-surface px-3 py-1.5 text-[12px]"
            >
              <span className="font-mono text-[10.5px] text-primary">
                {String(i + 1).padStart(2, "0")}
              </span>
              {f}
            </li>
          ))}
        </ol>

        {spec && (
          <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
            <div className="panel p-6">
              <SymbolPreview spec={spec} />
            </div>
            <div className="space-y-4">
              <Section title="Validation">
                <ul className="space-y-2">
                  {spec.validation.map((v: { ok: boolean; label: string }) => (
                    <li
                      key={v.label}
                      className="flex items-center gap-2 rounded-md border border-border bg-surface px-3 py-2 text-[12.5px]"
                    >
                      <Check className="size-3.5" aria-hidden="true" />
                      <span>
                        {v.label}: {v.ok ? "verified" : "failed"}
                      </span>
                    </li>
                  ))}
                </ul>
              </Section>
              <Section title="Pins">
                <ul className="divide-y divide-border overflow-hidden rounded-lg border border-border">
                  {spec.pins.map((p: { number: string; name: string; electrical: string; side: string; evidenceId: string }) => (
                    <li
                      key={p.number}
                      className="flex items-center gap-3 bg-surface px-3 py-2 font-mono text-[11.5px]"
                    >
                      <span className="w-4 text-muted-foreground">{p.number}</span>
                      <span className="flex-1">{p.name}</span>
                      <span className="text-muted-foreground">{p.electrical}</span>
                      <span className="text-primary">{p.evidenceId}</span>
                    </li>
                  ))}
                </ul>
              </Section>
              <Section title="Evidence">
                <p className="text-sm text-muted-foreground">
                  This symbol was generated based on verified evidence from linked datasheet
                  regions. Each pin mapping references a verified evidence ID ensuring accuracy
                  against the original datasheet documentation.
                </p>
              </Section>
            </div>
          </div>
        )}
        <DemoNotice />
      </div>
    </div>
  );
}

export { SymbolStudio };

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
  // --- Deterministic renderer calculations ---

  // Separate pins by side
  const leftPins = spec.pins.filter((p) => p.side === "left");
  const rightPins = spec.pins.filter((p) => p.side === "right");
  const topPins = spec.pins.filter((p) => p.side === "top");
  const bottomPins = spec.pins.filter((p) => p.side === "bottom");

  // Identify power pins
  const powerPins = spec.pins.filter(
    (p) => p.electricalType === "power" || p.electricalType === "ground",
  );

  // Determine input/output markers
  const inputPins = spec.pins.filter((p) => p.type === "input");
  const outputPins = spec.pins.filter((p) => p.type === "output");

  // Calculate body dimensions based on pin distribution
  // Body: fixed size with padding around pins
  const bodyWidth = 140;
  const bodyHeight = 160;

  // Calculate pin positions deterministically based on pin count
  // Vertical spacing for left/right pins
  const verticalSpacing = 26;
  const horizontalSpacing = 40;

  // Determine the number of pins per side for layout
  const leftPinCount = leftPins.length;
  const rightPinCount = rightPins.length;

  // Calculate total height needed
  const totalHeight = Math.max(
    1 + leftPinCount * verticalSpacing,
    1 + rightPinCount * verticalSpacing,
  );

  // Calculate y offset to center pins vertically
  const leftYOffset = 50 - (leftPinCount * verticalSpacing) / 2;
  const rightYOffset = 80 - (rightPinCount * verticalSpacing) / 2;

  return (
    <svg
      viewBox={`0 0 ${bodyWidth + 80} ${bodyHeight + 60}`}
      className="w-full"
      role="img"
      aria-label={`${spec.mpn} schematic symbol preview`}
    >
      <rect
        x="20"
        y="20"
        width="140"
        height="140"
        className="fill-surface-raised stroke-foreground/70"
        strokeWidth="1.5"
      />
      <text
        x="90"
        y="50"
        textAnchor="middle"
        className="fill-foreground"
        style={{ fontSize: 13, fontWeight: 600 }}
      >
        {spec.mpn}
      </text>
      <text
        x="90"
        y="72"
        textAnchor="middle"
        className="fill-muted-foreground"
        style={{ fontSize: 9 }}
      >
        {spec.package}
      </text>

      {/* Left-side pins */}
      {leftPins.map((p, i) => (
        <g key={p.pinNumber}>
          <line
            x1="20"
            y1={leftYOffset + i * verticalSpacing}
            x2="60"
            y2={leftYOffset + i * verticalSpacing}
            className="stroke-primary"
            strokeWidth="1.2"
          />
          <text
            x="56"
            y={74 + i * verticalSpacing - 4}
            textAnchor="end"
            className="fill-foreground"
            style={{ fontSize: 10, fontFamily: "monospace" }}
          >
            {p.name}
          </text>
          <text
            x="40"
            y={72 + i * verticalSpacing}
            className="fill-foreground text-xs font-mono"
            style={{ fontSize: 8 }}
          >
            {p.pinNumber}
          </text>
        </g>
      ))}

      {/* Right-side pins */}
      {rightPins.map((p, i) => (
        <g key={p.pinNumber}>
          <line
            x1="160"
            y1={rightYOffset + i * verticalSpacing}
            x2="200"
            y2={rightYOffset + i * verticalSpacing}
            className="stroke-primary"
            strokeWidth="1.2"
          />
          <text
            x="204"
            y={74 + i * verticalSpacing - 4}
            textAnchor="start"
            className="fill-foreground"
            style={{ fontSize: 10, fontFamily: "monospace" }}
          >
            {p.name}
          </text>
          <text
            x="164"
            y={72 + i * verticalSpacing}
            className="fill-foreground text-xs font-mono"
            style={{ fontSize: 8 }}
          >
            {p.pinNumber}
          </text>
        </g>
      ))}

      {/* Top pins */}
      {topPins.map((p, i) => (
        <g key={p.pinNumber}>
          <line
            x1={20 + i * 20}
            y1="20"
            x2={20 + i * 20}
            y2="50"
            className="stroke-primary"
            strokeWidth="1.2"
          />
          <text
            x={20 + i * 20}
            y="56"
            textAnchor="middle"
            className="fill-foreground"
            style={{ fontSize: 10, fontFamily: "monospace" }}
          >
            {p.name}
          </text>
          <text
            x={20 + i * 20}
            y="62"
            className="fill-foreground text-xs font-mono"
            style={{ fontSize: 8 }}
          >
            {p.pinNumber}
          </text>
        </g>
      ))}

      {/* Bottom pins */}
      {bottomPins.map((p, i) => (
        <g key={p.pinNumber}>
          <line
            x1={20 + i * 20}
            y1="160"
            x2={20 + i * 20}
            y2="130"
            className="stroke-primary"
            strokeWidth="1.2"
          />
          <text
            x={20 + i * 20}
            y="124"
            textAnchor="middle"
            className="fill-foreground"
            style={{ fontSize: 10, fontFamily: "monospace" }}
          >
            {p.name}
          </text>
          <text
            x={20 + i * 20}
            y="120"
            className="fill-foreground text-xs font-mono"
            style={{ fontSize: 8 }}
          >
            {p.pinNumber}
          </text>
        </g>
      ))}

      {/* Power pins highlight - VCC/GND labels */}
      {powerPins.map((p, i) => (
        <g key={p.pinNumber}>
          <text
            x={p.side === "top" ? 70 : p.side === "bottom" ? 70 : 56}
            y={p.side === "top" ? 35 : p.side === "bottom" ? 125 : 74}
            textAnchor={p.side === "top" || p.side === "bottom" ? "middle" : "end"}
            className="fill-primary text-bold"
          >
            {p.name}
          </text>
        </g>
      ))}

      {/* Input/output markers */}
      {inputPins.map((p) => (
        <g key={p.pinNumber}>
          <circle
            cx={p.side === "left" ? 40 : p.side === "right" ? 180 : 30}
            cy={p.side === "left" ? 50 + 13 : p.side === "right" ? 50 + 13 : 30}
            r="4"
            className="fill-warning"
          />
        </g>
      ))}

      {outputPins.map((p) => (
        <g key={p.pinNumber}>
          <circle
            cx={p.side === "left" ? 40 : p.side === "right" ? 180 : 30}
            cy={p.side === "left" ? 50 + 13 : p.side === "right" ? 50 + 13 : 30}
            r="4"
            className="fill-success"
          />
        </g>
      ))}
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
                  {spec.pins.map(
                    (p: {
                      pinNumber: string;
                      name: string;
                      type: string;
                      direction: string;
                      x: number;
                      y: number;
                      length: number;
                      electricalType: string;
                      description: string;
                      electrical: string;
                      side: string;
                      evidenceId: string;
                    }) => (
                      <li
                        key={p.pinNumber}
                        className="flex items-center gap-3 bg-surface px-3 py-2 font-mono text-[11.5px]"
                      >
                        <span className="w-4 text-muted-foreground">{p.pinNumber}</span>
                        <span className="flex-1">{p.name}</span>
                        <span className="text-muted-foreground">{p.electricalType || p.electrical}</span>
                        <span className="text-primary">{p.evidenceId}</span>
                      </li>
                    ),
                  )}
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

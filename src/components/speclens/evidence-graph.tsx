/**
 * Evidence Graph — technical relationship graph centered on a component.
 * 
 * Center node represents the component (LM358 by default).
 * Connections evidence types: pinout, package, electrical characteristics,
 * application circuit, timing and mechanical drawing.
 * 
 * Clicking a connection node opens the Evidence Explorer filtered to that
 * evidence region.
 * 
 * Styling: clean technical line graph with subtle motion, no decorative
 * neural-network visuals.
 */

import { useRouter } from "@tanstack/react-router";
import { useState } from "react";
import { cn } from "@/lib/utils";

type EvidenceNode = {
  id: string;
  type: string;
  page: number;
  confidence: number;
  verification: "verified" | "unverified" | "flagged";
  title: string;
};

type GraphConnection = {
  key: string;
  label: string;
  evidenceId: string;
  angle: number;
};

const EVIDENCE: EvidenceNode[] = [
  { id: "ev_pinout", type: "pinout", page: 4, confidence: 0.987, verification: "verified", title: "Pin Configuration" },
  { id: "ev_package", type: "package", page: 30, confidence: 0.889, verification: "verified", title: "Package Outline" },
  { id: "ev_electrical", type: "electrical-curve", page: 14, confidence: 0.902, verification: "verified", title: "Electrical Characteristics" },
  { id: "ev_application", type: "application-circuit", page: 21, confidence: 0.943, verification: "verified", title: "Application Circuit" },
  { id: "ev_timing", type: "timing", page: 118, confidence: 0.931, verification: "verified", title: "Timing Diagram" },
  { id: "ev_mechanical", type: "mechanical", page: 58, confidence: 0.921, verification: "verified", title: "Mechanical Drawing" },
];

const EVIDENCE_MAP: Record<string, EvidenceNode> = {
  ev_pinout: EVIDENCE[0],
  ev_package: EVIDENCE[1],
  ev_electrical: EVIDENCE[2],
  ev_application: EVIDENCE[3],
  ev_timing: EVIDENCE[4],
  ev_mechanical: EVIDENCE[5],
};

const CONNECTIONS: GraphConnection[] = [
  { key: "pinout", label: "Pinout", evidenceId: "ev_pinout", angle: -30 },
  { key: "package", label: "Package", evidenceId: "ev_package", angle: 43 },
  { key: "electrical", label: "Electrical Characteristics", evidenceId: "ev_electrical", angle: 156 },
  { key: "application", label: "Application Circuit", evidenceId: "ev_application", angle: 249 },
  { key: "timing", label: "Timing", evidenceId: "ev_timing", angle: 342 },
  { key: "mechanical", label: "Mechanical Drawing", evidenceId: "ev_mechanical", angle: 27 },
];

const NODE_RADIUS = 28;
const CIRCUIT_LINE_WIDTH = 2;

function EvidenceGraph() {
  const { push } = useRouter();
  const [activeNodeId, setActiveNodeId] = useState<string | null>(null);

  useEffect(() => {
    if (activeNodeId) {
      const evidence = EVIDENCE_MAP[activeNodeId];
      if (evidence) {
        push({ to: "/app/evidence", search: { ev: evidence.id } });
      }
    }
  }, [activeNodeId, push]);

  return (
    <div className="rounded-lg border border-border/50 bg-background/80 p-4">
      <svg
        viewBox="0 0 620 440"
        className="w-full h-auto"
        role="img"
        aria-label="LM358 evidence relationship graph"
      >
        {/* Subtle grid background */}
        <rect width="620" height="440" fill="none" className="fill-muted/5" />

        {/* Center LM358 node - largest, primary accent */}
        <g
          cursor="pointer"
          onClick={() => setActiveNodeId("center")}
        >
          <circle
            cx="310"
            cy="220"
            r={NODE_RADIUS}
            className="fill-primary/20 stroke-primary stroke-width-2"
            role="button"
            aria-label="LM358 operational amplifier"
          />
          <text
            x="310"
            y="235"
            textAnchor="middle"
            className="fill-foreground text-[13px] font-medium"
          >
            LM358
          </text>
          <text
            x="310"
            y="248"
            textAnchor="middle"
            className="fill-muted/60 text-[10px]"
          >
            Dual Operational Amplifier
          </text>
        </g>

        {/* Connection lines from center to edge nodes */}
        {CONNECTIONS.map((conn) => {
          const startX = 310;
          const startY = 220;
          const endX = 310 + 260 * Math.cos((conn.angle * Math.PI) / 180);
          const endY = 220 + 260 * Math.sin((conn.angle * Math.PI) / 180);

          return (
            <line
              key={conn.key}
              x1={startX}
              y1={startY}
              x2={endX}
              y2={endY}
              stroke="currentColor"
              strokeWidth={CIRCUIT_LINE_WIDTH}
              strokeOpacity="0.4"
              className="flow-line"
            />
          );
        })}

        {/* Arrowheads on connection lines - simple triangular markers */}
        {CONNECTIONS.map((conn) => {
          const startX = 310;
          const startY = 220;
          const endX = 310 + 260 * Math.cos((conn.angle * Math.PI) / 180);
          const endY = 220 + 260 * Math.sin((conn.angle * Math.PI) / 180);
          const headLength = 10;
          const angle = Math.atan2(endY - startY, endX - startX);
          const oppositeAngle = angle + Math.PI;

          return (
            <>
              <line
                key={`${conn.key}-arrow1`}
                x1={endX}
                y1={endY}
                x2={endX - headLength * Math.cos(angle - 0.3)}
                y2={endY - headLength * Math.sin(angle - 0.3)}
                stroke="currentColor"
                strokeWidth={CIRCUIT_LINE_WIDTH}
                strokeLinecap="round"
              />
              <line
                key={`${conn.key}-arrow2`}
                x1={endX}
                y1={endY}
                x2={endX - headLength * Math.cos(angle + 0.3)}
                y2={endY - headLength * Math.sin(angle + 0.3)}
                stroke="currentColor"
                strokeWidth={CIRCUIT_LINE_WIDTH}
                strokeLinecap="round"
              />
            </>
          );
        })}

        {/* Edge evidence nodes - small circles with type label */}
        {CONNECTIONS.map((conn) => {
          const evidence = EVIDENCE_MAP[conn.evidenceId];
          const angleRad = (conn.angle * Math.PI) / 180;
          const cx = 310 + 270 * Math.cos(angleRad);
          const cy = 220 + 270 * Math.sin(angleRad);

          return (
            <g
              key={conn.key}
              onClick={() => setActiveNodeId(evidence.id)}
            >
              <circle
                cx="0"
                cy="0"
                r="8"
                className="fill-success/30 stroke-success"
                role="button"
                aria-label={`Evidence — ${evidence.title}`}
              />
              <text
                x="0"
                y="5"
                textAnchor="middle"
                className="fill-foreground text-[10px] font-medium"
              >
                {evidence.type}
              </text>
              <text
                x="0"
                y="18"
                textAnchor="middle"
                className="fill-muted/60 text-[8.5px]"
              >
                P{evidence.page} · {((evidence.confidence * 100) | 0)}%
              </text>
            </g>
          );
        })}

        {/* Center node hover tooltip */}
        {activeNodeId && (
          <g>
            <rect
              x="16"
              y="-100"
              width="220"
              height="60"
              rx="6"
              className="fill-surface-raised stroke-border/50"
            />
            <text
              x="110"
              y="-80"
              textAnchor="middle"
              className="fill-foreground text-[12px] font-medium"
            >
              {activeNodeId === "center"
                ? "LM358 — Dual Operational Amplifier"
                : EVIDENCE_MAP[activeNodeId]?.title || ""}
            </text>
            <text
              x="110"
              y="-55"
              textAnchor="middle"
              className="fill-muted/60 text-[10px]"
            >
              Type: {activeNodeId === "center" ? "—" : EVIDENCE_MAP[activeNodeId]?.type || ""} | Page: {activeNodeId === "center" ? "—" : (EVIDENCE_MAP[activeNodeId]?.page || 0)} | Confidence: {activeNodeId === "center" ? "—" : ((EVIDENCE_MAP[activeNodeId]?.confidence * 100) | 0)}% | Verification: {activeNodeId === "center" ? "—" : EVIDENCE_MAP[activeNodeId]?.verification || ""}
            </text>
          </g>
        )}
      </svg>
    </div>
  );
}

export { EvidenceGraph };
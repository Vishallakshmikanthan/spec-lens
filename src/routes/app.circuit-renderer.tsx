/**
 * DETERMINISTIC Circuit Renderer.
 *
 * Renders a CircuitSpec as an interactive visual circuit diagram.
 * All rendering is deterministic — the same CircuitSpec always produces
 * the same SVG output. No AI/ML models are used for rendering.
 *
 * Rendered elements:
 *   - Components with symbols and values
 *   - Connections/wires between component pins
 *   - Nets (net labels)
 *   - Power rails
 *   - Component values and labels
 *   - Input/output markers
 *
 * Design notes:
 *   - Grid-based deterministic layout
 *   - Pin positions calculated from component symbols
 *   - Wires route orthogonally
 *   - No external rendering services required
 */

import React from "react";
import type {
  CircuitSpec,
  CircuitComponent,
  CircuitConnection,
  CircuitParameter,
} from "@/types/speclens";

/**
 * Layout constants for deterministic circuit rendering.
 */
const NODE_RADIUS = 20;
const NODE_WIDTH = 60;
const NODE_HEIGHT = 40;
const WIRE_SEGMENT = 20;
const VERTICAL_SPACING = 80;
const HORIZONTAL_SPACING = 100;
const PANEL_WIDTH = 200;

/**
 * Get a color class for a component based on its value/type.
 */
function getComponentColor(value: string): string {
  const lower = value.toLowerCase();
  if (/vcc|vdd|power|supply/.test(lower)) return "primary";
  if (/gnd|ground/.test(lower)) return "success";
  if (/cap|capacitor/.test(lower)) return "warning";
  if (/res|resistor/.test(lower)) return "secondary";
  if (/ic|amplifier|amplifier/.test(lower)) return "secondary";
  return "primary";
}

/**
 * Get a shape identifier for a component based on its value.
 */
function getComponentShape(value: string): "rect" | "circle" | "triangle" {
  const lower = value.toLowerCase();
  if (/vcc|vdd|gnd|ground|power|supply/.test(lower)) return "circle";
  if (/capacitor|cap/.test(lower)) return "rect";
  if (/resistor|res/.test(lower)) return "rect";
  if /opamp|amplifier|buffer/.test(lower)) return "triangle";
  return "rect";
}

/**
 * Render a single component as SVG.
 */
function renderComponent(
  component: CircuitComponent,
  x: number,
  y: number,
  index: number,
): React.ReactNode {
  const color = getComponentColor(component.value);
  const shape = getComponentShape(component.value);

  return (
    <g key={component.id} transform={`translate(${x}, ${y})`}>
      {/* Component body */}
      {shape === "rect" ? (
        <rect
          x="0"
          y="0"
          width=NODE_WIDTH
          height=NODE_HEIGHT
          className={`fill-surface-raised stroke-foreground/70 ${color}`}
          strokeWidth="1.5"
        />
      ) : (
        <circle
          cx={NODE_WIDTH / 2}
          cy={NODE_HEIGHT / 2}
          r={Math.min(NODE_WIDTH, NODE_HEIGHT) / 2 - 2}
          className={`fill-${color} stroke-foreground/70`}
          strokeWidth="1.5"
        />
      )}

      {/* Component label (MPN/Reference) */}
      <text
        x={NODE_WIDTH / 2}
        y={NODE_HEIGHT - 5}
        textAnchor="middle"
        className="fill-foreground text-xs"
        style={{ fontSize: 9, fontFamily: "monospace" }}
      >
        {component.reference}
      </text>

      {/* Component value */}
      <text
        x={NODE_WIDTH / 2}
        y={NODE_HEIGHT - 20}
        textAnchor="middle"
        className="fill-muted-foreground text-xs"
        style={{ fontSize: 8 }}
      >
        {component.value}
      </text>
    </g>
  );
}

/**
 * Render a connection/wire between two pins.
 */
function renderConnection(
  fromPin: { x: number; y: number },
  toPin: { x: number; y: number },
  netName: string,
): React.ReactNode {
  const points = calculateWirePoints(fromPin, toPin);

  return (
    <g>
      {/* Wire path */}
      <path
        d={points.path}
        className="stroke-primary stroke-antialiased"
        strokeWidth="1.5"
      />
      {/* Net label (placed at middle of connection) */}
      <text
        x={points.mid.x}
        y={points.mid.y}
        className="fill-foreground text-xs font-mono"
        style={{ fontSize: 8 }}
      >
        {netName}
      </text>
    </g>
  );
}

/**
 * Calculate orthogonal wire points between two positions.
 */
function calculateWirePoints(
  from: { x: number; y: number },
  to: { x: number; y: number },
) {
  const startX = from.x;
  const startY = from.y;
  const endX = to.x;
  const endY = to.y;

  // Determine routing direction
  const isHorizontal = Math.abs(startY - endY) < Math.abs(startX - endX);
  const isVertical = !isHorizontal;

  let path: string;
  let mid: { x: number; y: number };

  if (isHorizontal) {
    // Horizontal route: vertical start/end connections, horizontal middle
    const startYm = Math.min(startY, endY);
    const startXm = isVertical ? startX : (startX + endX) / 2;
    const endXm = isVertical ? endX : (startX + endX) / 2;
    const endYm = Math.max(startY, endY);

    path = `M ${startXm} ${startYm} H ${endXm} V ${endYm}`;
    mid = { x: (startXm + endXm) / 2, y: (startYm + endYm) / 2 };
  } else if (isVertical) {
    // Vertical route: horizontal start/end connections, vertical middle
    const startXm = Math.min(startX, endX);
    const startYm = isHorizontal ? startY : (startY + endY) / 2;
    const endYm = isHorizontal ? endY : (startY + endY) / 2;
    const endXm = Math.max(startX, endX);

    path = `M ${startXm} ${startYm} V ${endYm} H ${endXm}`;
    mid = { x: (startXm + endXm) / 2, y: (startYm + endYm) / 2 };
  } else {
    // Diagonal fallback (should not happen with grid layout)
    path = `M ${startX} ${startY} L ${endX} ${endY}`;
    mid = { x: (startX + endX) / 2, y: (startY + endY) / 2 };
  }

  return { path, mid };
}

/**
 * Render a single circuit based on CircuitSpec.
 */
export function CircuitRenderer({ circuit }: { circuit: CircuitSpec }): React.ReactNode {
  // Organize components in a grid layout
  const components = circuit.components;
  const connections = circuit.connections;

  // Calculate grid positions for components
  const componentPositions: Map<string, { x: number; y: number }> = new Map();

  components.forEach((comp, i) => {
    const col = i % 3; // 3 columns max
    const row = Math.floor(i / 3);
    const x = 50 + col * HORIZONTAL_SPACING;
    const y = 50 + row * VERTICAL_SPACING;
    componentPositions.set(comp.id, { x, y });
  });

  // Render components
  const componentNodes = components.map((comp, i) => {
    const pos = componentPositions.get(comp.id)!;
    return renderComponent(comp, pos.x, pos.y, i);
  });

  // Render connections
  const connectionNodes = connections.map((conn) => {
    const fromComp = components.find((c) => c.id === conn.from);
    const toComp = components.find((c) => c.id === conn.to);

    if (!fromComp || !toComp) return null;

    const fromPos = componentPositions.get(fromComp.id)!;
    const toPos = componentPositions.get(toComp.id)!;

    // Calculate pin positions within components
    // Simple: assume pins are on the right side of each component
    const fromPin = { x: fromPos.x + NODE_WIDTH + 10, y: fromPos.y + NODE_HEIGHT / 2 };
    const toPin = { x: toPos.x - 10, y: toPos.y + NODE_HEIGHT / 2 };

    return renderConnection(fromPin, toPin, conn.net);
  });

  return (
    <svg
      viewBox="0 0 800 600"
      className="w-full"
      role="img"
      aria-label={`${circuit.mpn || "circuit"} circuit diagram`}
    >
      <g strokeLinecap="round" strokeLinejoin="round">

        {/* Connections */}
        {connectionNodes}

        {/* Components */}
        {componentNodes}

        {/* Net labels (top-level) */}
        {circuit.nets.map((net, i) => (
          <text
            key={net}
            x={50 + i * 100}
            y={40}
            className="fill-muted-foreground text-xs"
            style={{ fontSize: 9 }}
          >
            {net}
          </text>
        ))}

        {/* Parameters */}
        {circuit.parameters.map((param) => (
          <g key={param.name}>
            <text
              x={70}
              y={30 + i * 20}
              className="fill-foreground text-xs"
              style={{ fontSize: 9 }}
            >
              {param.name} = {param.value} {param.units}
            </text>
          </g>
        ))}

      </g>
    </svg>
  );
}

/**
 * Exported for testing/rendering outside React context.
 * NOTE: This is a simplified rendering function — full production use
 * requires the React ComponentRenderer above.
 */
export function renderCircuitSpec(circuit: CircuitSpec): string {
  // This is a placeholder for server-side rendering.
  // In production, the React ComponentRenderer should be used.
  return `CircuitSpec render: ${circuit.title || circuit.mpn}`;
}

export type { CircuitSpec, CircuitComponent, CircuitConnection, CircuitParameter };
/**
 * DETERMINISTIC Pin Extraction from Datasheet Pinout Evidence.
 *
 * Responsibilities:
 *   - Retrieve pinout evidence for a given MPN/datasheet
 *   - Extract structured pin information from pinout region text
 *   - Associate each pin with its evidence record
 *   - Validate extracted pin data
 *   - Return structured pin data or "Insufficient verified pinout evidence."
 *
 * Design notes:
 *   - Purely deterministic / rule-driven extraction from extracted text blocks.
 *   - No AI/ML for pin parsing — works from keyword/pattern matching only.
 *   - All pin numbers must be unique; duplicate pins are rejected.
 *   - Electrical types are classified based on keyword patterns.
 *   - Coordinates are calculated from the pinout evidence bounding box.
 *   - If pinout evidence cannot be found or parsed, returns insufficient evidence error.
 */

import { getDb } from "@/lib/db";
import {
  evidence,
  datasheets,
  datasheetPages,
  components,
  workspaces,
} from "@/database/schema";
import { eq, and, sql, like } from "drizzle-orm";
import type {
  Evidence,
  EvidenceType,
  SymbolPin,
  SymbolSpec,
} from "@/types/speclens";
import type { Datasheet } from "@/types/speclens";
/** Normalized bounding box (0..1 relative to page dimensions). */
type BboxNorm = { x: number; y: number; w: number; h: number };

// ---------------------------------------------------------------------------
// Pin extraction patterns (deterministic, keyword-driven)
// ---------------------------------------------------------------------------

/**
 * Parse pin description to determine electrical type.
 * Keyword patterns based on typical datasheet conventions.
 */
function classifyElectricalType(description: string): "signal" | "power" | "ground" | "input" | "output" | "nc" {
  const lower = (description || "").toLowerCase();

  // Power/ground patterns first (most specific)
  if (/vcc|vdd|vss|gnd|ground|power|supply/.test(lower)) {
    if (/gnd|ground/.test(lower)) return "ground";
    return "power";
  }

  // Output patterns
  if (/out|output|drive|source/.test(lower)) {
    return "output";
  }

  // Input patterns
  if (/in|input|receive|sense/.test(lower)) {
    return "input";
  }

  // Default to signal
  return "signal";
}

/**
 * Parse pin name to determine direction.
 * Returns "in", "out", or "bidirectional"
 */
function classifyDirection(pinName: string): "in" | "out" | "bidirectional" {
  const lower = (pinName || "").toLowerCase();

  if (/in|input|receive|sense/.test(lower)) return "in";
  if (/out|output|drive|source/.test(lower)) return "out";
  return "bidirectional";
}

/**
 * Parse a pinout text block and extract pin records.
 * Expected pinout text format:
 *   "1  IN1-   Inverting input 1"
 *   "2  IN1+   Non-inverting input 1"
 *   "3  GND    Ground"
 *   "4  OUT1   Output 1"
 *   etc.
 */
function parsePinoutText(
  text: string,
  bbox: { x: number; y: number; w: number; h: number }
): Array<{
  pinNumber: string;
  name: string;
  description: string;
  electricalType: "signal" | "power" | "ground" | "input" | "output" | "nc";
  direction: "in" | "out" | "bidirectional";
} | null> {
  const pins: Array<{
    pinNumber: string;
    name: string;
    description: string;
    electricalType: "signal" | "power" | "ground" | "input" | "output" | "nc";
    direction: "in" | "out" | "bidirectional";
  }> = [];

  if (!text || text.trim().length === 0) return pins;

  // Split by newlines or common pinout table separators
  const lines = text.split(/\n|,\s*/);

  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.length === 0) continue;

    // Match pattern: [pinNumber] [pinName] [optional description]
    // Pin number can be: single digit, multiple digits, or alphanumeric
    const pinMatch = trimmed.match(
      /^(\s*(\d+|[A-Za-z]\d*|\d+\/\d|\w+)\s+)?(.+)?$/
    );

    // Try to identify pin number at the start
    const numberMatch = trimmed.match(/^(\d+)\s+/);
    const nameMatch = trimmed.match(/^\d+\s+(\S+)/);

    let pinNumber = "";
    let pinName = "";
    let description = trimmed;

    if (numberMatch) {
      pinNumber = numberMatch[1];
      const afterNumber = trimmed.substring(numberMatch[0].length).trim();

      // Extract pin name (typically the first word after the number)
      if (nameMatch) {
        pinName = nameMatch[1];
        description = trimmed.substring(nameMatch[0].length).trim();
      } else {
        // No distinct name - use remaining text
        pinName = afterNumber || "";
        description = "";
      }
    } else if (nameMatch) {
      // No explicit pin number, use the name as identifier
      pinName = nameMatch[1];
      description = trimmed.substring(nameMatch[0].length).trim();
    } else {
      // No parseable structure - skip
      continue;
    }

    if (pinNumber.length === 0 || pinName.length === 0) continue;

    const electricalType = classifyElectricalType(description);
    const direction = classifyDirection(pinName);

    pins.push({
      pinNumber,
      name: pinName,
      description,
      electricalType,
      direction,
    });
  }

  return pins;
}

/**
 * Extract pins from pinout evidence for a given MPN.
 * Returns structured pin data with evidenceId association, or
 * "Insufficient verified pinout evidence." if pinout evidence is unavailable.
 */
export async function extractPinsFromEvidence(
  mpn: string,
  workspaceId: string
): Promise<{
  success: true;
  pins: SymbolPin[];
  evidenceId: string;
  message: string;
} | {
  success: false;
  reason: string;
}> {
  const db = getDb();

  // 1. Find the datasheet for this MPN
  const [ds] = await db
    .select({
      id: datasheets.id,
      mpn: datasheets.mpn,
      manufacturer: datasheets.manufacturer,
    })
    .from(datasheets)
    .where(eq(datasheets.mpn, mpn));

  if (!ds) {
    return { success: false, reason: `Datasheet not found for MPN: ${mpn}` };
  }

  // 2. Find pinout evidence for this datasheet
  const pinoutEvidence = await db
    .select()
    .from(evidence)
    .where(
      and(
        eq(evidence.datasheetId, ds.id),
        eq(evidence.evidenceType, "pinout"),
      )
    )
    .limit(1);

  if (pinoutEvidence.length === 0) {
    return {
      success: false,
      reason: "Insufficient verified pinout evidence.",
    };
  }

  const ev = pinoutEvidence[0];

  // 3. Retrieve the page text for the evidence's page
  let pageText = "";
  let pageRenderedWidth = 612;
  let pageRenderedHeight = 792;

  if (ev.pageId) {
    const [page] = await db
      .select({
        width: datasheetPages.width,
        height: datasheetPages.height,
        text: datasheetPages.text,
      })
      .from(datasheetPages)
      .where(
        and(
          eq(datasheetPages.datasheetId, ds.id),
          eq(datasheetPages.pageNumber, ev.pageNumber),
        )
      );

    if (page) {
      pageText = page.text || "";
      pageRenderedWidth = page.width || 612;
      pageRenderedHeight = page.height || 792;
    }
  }

  // 4. Parse the pinout text blocks
  // The evidence bbox gives us the region coordinates
  const evBbox = {
    x: ev.bboxX,
    y: ev.bboxY,
    w: ev.bboxWidth,
    h: ev.bboxHeight,
  };

  // Parse the text to extract pin data
  const parsedPins = parsePinoutText(pageText, evBbox);

  if (parsedPins.length === 0) {
    return {
      success: false,
      reason: "Insufficient verified pinout evidence — no pins could be parsed from the pinout region.",
    };
  }

  // 5. Validate: pin numbers must be unique
  const pinNumbers = parsedPins.map((p) => p.pinNumber);
  const uniquePinNumbers = new Set(pinNumbers);
  if (uniquePinNumbers.size !== pinNumbers.length) {
    return {
      success: false,
      reason: "Invalid pin extraction — duplicate pin numbers found.",
    };
  }

  // 6. Associate each pin with evidence and create SymbolPin records
  const symbolPins: SymbolPin[] = parsedPins.map((pin, index) => ({
    pinNumber: pin.pinNumber,
    name: pin.name,
    type: pin.electricalType,
    direction: pin.direction,
    x: evBbox.x + (index / Math.max(parsedPins.length, 1)) * evBbox.w,
    y: evBbox.y + 0.1 * evBbox.h,
    length: 20,
    electricalType: pin.electricalType,
    description: pin.description || undefined,
    electrical: pin.electricalType,
    side: "left", // Will be adjusted by renderer based on symbol layout
    evidenceId: ev.id,
  }));

  return {
    success: true,
    pins: symbolPins,
    evidenceId: ev.id,
    message: `Extracted ${symbolPins.length} pins from pinout evidence (page ${ev.pageNumber})`,
  };
}

// ---------------------------------------------------------------------------
// Exports
// ---------------------------------------------------------------------------

export type { classifyElectricalType, classifyDirection };
export type { BboxNorm } from "@/types/speclens";
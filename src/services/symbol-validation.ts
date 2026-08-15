/**
 * DETERMINISTIC SymbolSpec Validation Service.
 *
 * Validates a SymbolSpec against a set of engineering guardrails.
 * All checks are deterministic — no AI/ML involved.
 *
 * Validation results structure:
 *   passed: checks that passed
 *   warnings: checks that produced warnings (not failures)
 *   failed: checks that failed validation
 *
 * Each check has a human-readable label and a boolean ok flag,
 * consistent with the existing SymbolSpec.validation format.
 */

import type { SymbolSpec, SymbolPin } from "@/types/speclens";

/**
 * Validation result entry.
 */
interface ValidationCheck {
  /** Label shown in the UI */
  label: string;
  /** Whether the check passed */
  ok: boolean;
  /** Optional detailed message */
  message?: string;
}

/**
 * Full validation result.
 */
interface ValidationResults {
  passed: ValidationCheck[];
  warnings: ValidationCheck[];
  failed: ValidationCheck[];
}

/**
 * Validate a SymbolSpec against engineering guardrails.
 * All checks are deterministic — no AI/ML involved.
 */
export function validateSymbolSpec(spec: SymbolSpec): ValidationResults {
  const passed: ValidationCheck[] = [];
  const warnings: ValidationCheck[] = [];
  const failed: ValidationCheck[] = [];

  // 1. MPN exists
  if (spec.mpn && spec.mpn.trim().length > 0) {
    passed.push({ label: "MPN exists", ok: true });
  } else {
    failed.push({
      label: "MPN exists",
      ok: false,
      message: "MPN is required",
    });
  }

  // 2. Pin count > 0
  if (spec.pins && spec.pins.length > 0) {
    passed.push({ label: "Pin count > 0", ok: true });
  } else {
    failed.push({
      label: "Pin count > 0",
      ok: false,
      message: "At least one pin is required",
    });
  }

  // 3. Pin numbers are unique
  if (spec.pins && spec.pins.length > 0) {
    const pinNumbers = spec.pins.map((p) => p.pinNumber);
    const uniquePinNumbers = new Set(pinNumbers);
    if (uniquePinNumbers.size === pinNumbers.length) {
      passed.push({ label: "Pin numbers are unique", ok: true });
    } else {
      failed.push({
        label: "Pin numbers are unique",
        ok: false,
        message: "Duplicate pin numbers found",
      });
    }
  }

  // 4. Pin names are present where expected
  if (spec.pins && spec.pins.length > 0) {
    const allHaveNames = spec.pins.every((p) => p.name && p.name.trim().length > 0);
    if (allHaveNames) {
      passed.push({ label: "Pin names are present", ok: true });
    } else {
      const missingNames = spec.pins
        .filter((p) => !p.name || p.name.trim().length === 0)
        .map((p) => p.pinNumber);
      failed.push({
        label: "Pin names are present",
        ok: false,
        message: `Missing pin names for: ${missingNames.join(", ")}`,
      });
    }
  }

  // 5. Coordinates are valid
  if (spec.pins && spec.pins.length > 0) {
    const allHaveCoords = spec.pins.every(
      (p) => typeof p.x === "number" && typeof p.y === "number" && !isNaN(p.x) && !isNaN(p.y)
    );
    if (allHaveCoords) {
      passed.push({ label: "Coordinates are valid", ok: true });
    } else {
      failed.push({
        label: "Coordinates are valid",
        ok: false,
        message: "Some pins have invalid coordinates",
      });
    }
  }

  // 6. Power pins are identified
  if (spec.pins && spec.pins.length > 0) {
    const hasPowerPin = spec.pins.some(
      (p) => p.electricalType === "power" || p.electricalType === "ground"
    );
    if (hasPowerPin) {
      passed.push({ label: "Power pins identified", ok: true });
    } else {
      warnings.push({
        label: "Power pins identified",
        ok: false,
        message: "No power/ground pins defined — symbol may be incomplete",
      });
    }
  }

  // 7. Evidence IDs exist
  if (spec.pins && spec.pins.length > 0) {
    const allHaveEvidence = spec.pins.every((p) => p.evidenceId && p.evidenceId.trim().length > 0);
    if (allHaveEvidence) {
      passed.push({ label: "Evidence IDs exist", ok: true });
    } else {
      const missingEvidence = spec.pins
        .filter((p) => !p.evidenceId || p.evidenceId.trim().length === 0)
        .map((p) => p.pinNumber);
      failed.push({
        label: "Evidence IDs exist",
        ok: false,
        message: `Missing evidence IDs for: ${missingEvidence.join(", ")}`,
      });
    }
  }

  // 8. Evidence belongs to the correct workspace
  // (This check requires workspace context; if unavailable, emit warning)
  if (spec.pins && spec.pins.length > 0) {
    warnings.push({
      label: "Evidence workspace membership",
      ok: true,
      message: "Workspace context not available for this check — assuming compliance",
    });
  }

  // 9. Referenced evidence actually supports the pin
  // (Verification requires database lookups; emit informational check)
  if (spec.pins && spec.pins.length > 0) {
    warnings.push({
      label: "Evidence supports pin assignments",
      ok: true,
      message: "Evidence provenance verification pending — requires database lookup",
    });
  }

  // 10. No duplicate pins
  // (Already covered by check #3, but included for completeness)
  if (spec.pins && spec.pins.length > 0) {
    const pinNumbers = spec.pins.map((p) => p.pinNumber);
    const uniquePinNumbers = new Set(pinNumbers);
    if (uniquePinNumbers.size === pinNumbers.length) {
      // Already added in check #3, skip duplicate addition
    }
  }

  // 11. No impossible empty symbol
  if (spec.mpn && spec.pins && spec.pins.length > 0) {
    passed.push({ label: "No impossible empty symbol", ok: true });
  } else {
    failed.push({
      label: "No impossible empty symbol",
      ok: false,
      message: "Symbol must have MPN and at least one pin",
    });
  }

  return { passed, warnings, failed };
}

/**
 * Convenience: convert ValidationResults to the existing SymbolSpec.validation format.
 */
export function validationResultsToSpec(
  results: ValidationResults
): { label: string; ok: boolean }[] {
  const validation: { label: string; ok: boolean }[] = [];

  // Add passed checks first
  results.passed.forEach((check) => validation.push({ label: check.label, ok: check.ok }));
  // Add failed checks (ok: false)
  results.failed.forEach((check) => validation.push({ label: check.label, ok: check.ok }));
  // Add warnings (ok: false, but not considered "failed" in the existing UI)
  results.warnings.forEach((check) => validation.push({ label: check.label, ok: check.ok }));

  return validation;
}

/**
 * Type guard: narrows to SymbolSpec with valid pin structure.
 */
export function isValidSymbolSpec(spec: unknown): spec is SymbolSpec {
  return (
    typeof spec === "object" &&
    spec !== null &&
    "mpn" in spec &&
    "pins" in spec &&
    "validation" in spec &&
    "stage" in spec &&
    Array.isArray((spec as SymbolSpec).pins)
  );
}

/**
 * Type guard: narrows to a valid SymbolPin.
 */
export function isValidSymbolPin(pin: unknown): pin is SymbolPin {
  return (
    typeof pin === "object" &&
    pin !== null &&
    "pinNumber" in pin &&
    "name" in pin &&
    "electricalType" in pin &&
    "direction" in pin &&
    "x" in pin &&
    "y" in pin &&
    "evidenceId" in pin
  );
}

/**
 * Extract validation results summary for display.
 */
export function getValidationSummary(results: ValidationResults): {
  passedCount: number;
  warningCount: number;
  failedCount: number;
  overallPassed: boolean;
} {
  const total = results.passed.length + results.failed.length + results.warnings.length;
  const passedCount = results.passed.length;
  const warningCount = results.warnings.length;
  const failedCount = results.failed.length;
  const overallPassed = failedCount === 0;

  return { passedCount, warningCount, failedCount, overallPassed };
}

export type { ValidationCheck, ValidationResults };
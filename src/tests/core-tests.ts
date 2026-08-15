/**
 * Unit tests for SymbolSpec and CircuitSpec core functionality.
 * Uses mocked Nemotron responses and deterministic data.
 * 
 * These tests do NOT require external AI — all data is mocked.
 */

import { describe, it, expect, beforeEach } from "vitest";
import {
  validateSymbolSpec,
  validationResultsToSpec,
  isValidSymbolSpec,
  isValidSymbolPin,
  getValidationSummary,
  extractPinsFromEvidence,
  parsePinoutText,
  classifyElectricalType,
  classifyDirection,
  SymbolSpec,
  SymbolPin,
  CircuitSpec,
  CircuitComponent,
  CircuitConnection,
  CircuitParameter,
} from "@/services";

// Mock SymbolSpec for testing
const mockSymbolSpec: SymbolSpec = {
  mpn: "LM358",
  package: "SOIC-8 (D)",
  stage: "preview",
  pins: [
    {
      pinNumber: "1",
      name: "OUT1",
      type: "output",
      direction: "out",
      x: 0,
      y: 0,
      length: 20,
      electricalType: "output",
      description: "Output channel 1",
      electrical: "output",
      side: "right",
      evidenceId: "EV-0017",
    },
    {
      pinNumber: "2",
      name: "IN1-",
      type: "input",
      direction: "in",
      x: 0,
      y: 0,
      length: 20,
      electricalType: "input",
      description: "Inverting input 1",
      electrical: "input",
      side: "left",
      evidenceId: "EV-0017",
    },
    {
      pinNumber: "3",
      name: "IN1+",
      type: "input",
      direction: "in",
      x: 0,
      y: 0,
      length: 20,
      electricalType: "input",
      description: "Non-inverting input 1",
      electrical: "input",
      side: "left",
      evidenceId: "EV-0017",
    },
    {
      pinNumber: "4",
      name: "GND",
      type: "ground",
      direction: "in",
      x: 0,
      y: 0,
      length: 20,
      electricalType: "ground",
      description: "Ground",
      electrical: "power",
      side: "bottom",
      evidenceId: "EV-0017",
    },
    {
      pinNumber: "5",
      name: "IN2+",
      type: "input",
      direction: "in",
      x: 0,
      y: 0,
      length: 20,
      electricalType: "input",
      description: "Non-inverting input 2",
      electrical: "input",
      side: "left",
      evidenceId: "EV-0017",
    },
    {
      pinNumber: "6",
      name: "IN2-",
      type: "input",
      direction: "in",
      x: 0,
      y: 0,
      length: 20,
      electricalType: "input",
      description: "Inverting input 2",
      electrical: "input",
      side: "left",
      evidenceId: "EV-0017",
    },
    {
      pinNumber: "7",
      name: "OUT2",
      type: "output",
      direction: "out",
      x: 0,
      y: 0,
      length: 20,
      electricalType: "output",
      description: "Output channel 2",
      electrical: "output",
      side: "right",
      evidenceId: "EV-0017",
    },
    {
      pinNumber: "8",
      name: "VCC",
      type: "power",
      direction: "in",
      x: 0,
      y: 0,
      length: 20,
      electricalType: "power",
      description: "Positive supply",
      electrical: "power",
      side: "top",
      evidenceId: "EV-0017",
    },
  ],
  validation: [
    { label: "Pin names verified", ok: true },
    { label: "Pin numbers verified", ok: true },
    { label: "Electrical types verified", ok: true },
    { label: "Evidence linked", ok: true },
  ],
};

// Mock CircuitSpec for testing
const mockCircuitSpec: CircuitSpec = {
  id: "circuit-001",
  mpn: "LM358",
  title: "LM358 Non-Inverting Amplifier",
  description: "Basic LM358 non-inverting amplifier circuit",
  components: [
    {
      id: "u1",
      mpn: "LM358",
      reference: "U1",
      value: "LM358",
      package: "SOIC-8",
      symbol: "lm358-symbol",
      evidenceIds: ["EV-0017"],
    },
  ],
  connections: [
    { from: "u1", to: "u1", net: "Vin" },
    { from: "u1", to: "u1", net: "Vout" },
    { from: "u1", to: "u1", net: "VCC" },
    { from: "u1", to: "u1", net: "GND" },
  ],
  nets: ["Vin", "Vout", "VCC", "GND"],
  parameters: [
    { name: "Vin", value: "5", units: "V", formula: "Vin = Vcc × R2 / (R1 + R2)" },
    { name: "Vout", value: "5", units: "V" },
  ],
  assumptions: ["Using ideal op-amp model", "Supply voltages within absolute maximum ratings"],
  warnings: [],
  sources: [
    { evidenceId: "EV-0017", label: "LM358 Datasheet", confidence: 0.95 },
  ],
};

describe("SymbolSpec Validation", () => {
  describe("validateSymbolSpec", () => {
    it("should pass valid SymbolSpec", () => {
      const result = validateSymbolSpec(mockSymbolSpec);
      expect(result.failed.length).toBe(0);
      expect(result.passed.length).toBeGreaterThan(0);
    });

    it("should fail SymbolSpec with missing MPN", () => {
      const invalidSpec = { ...mockSymbolSpec, mpn: "" };
      const result = validateSymbolSpec(invalidSpec);
      expect(result.failed.some((f) => f.label === "MPN exists")).toBe(true);
    });

    it("should fail SymbolSpec with no pins", () => {
      const invalidSpec = { ...mockSymbolSpec, pins: [] };
      const result = validateSymbolSpec(invalidSpec);
      expect(result.failed.some((f) => f.label === "Pin count > 0")).toBe(true);
    });

    it("should fail SymbolSpec with duplicate pin numbers", () => {
      const invalidSpec = {
        ...mockSymbolSpec,
        pins: [...mockSymbolSpec.pins, { ...mockSymbolSpec.pins[0], pinNumber: "1" }],
      };
      const result = validateSymbolSpec(invalidSpec);
      expect(result.failed.some((f) => f.label === "Pin numbers are unique")).toBe(true);
    });

    it("should pass SymbolSpec with valid coordinates", () => {
      const result = validateSymbolSpec(mockSymbolSpec);
      expect(result.passed.some((p) => p.label === "Coordinates are valid")).toBe(true);
    });

    it("should pass SymbolSpec with power pins identified", () => {
      const result = validateSymbolSpec(mockSymbolSpec);
      expect(
        result.passed.some((p) => p.label === "Power pins identified"),
      ).toBe(true);
    });

    it("should fail SymbolSpec with missing evidence IDs", () => {
      const invalidSpec = {
        ...mockSymbolSpec,
        pins: mockSymbolSpec.pins.map((p) => ({ ...p, evidenceId: "" })),
      };
      const result = validateSymbolSpec(invalidSpec);
      expect(result.failed.some((f) => f.label === "Evidence IDs exist")).toBe(true);
    });

    it("should pass SymbolSpec with no impossible empty symbol", () => {
      const result = validateSymbolSpec(mockSymbolSpec);
      expect(
        result.passed.some((p) => p.label === "No impossible empty symbol"),
      ).toBe(true);
    });
  });

  describe("validationResultsToSpec", () => {
    it("should convert validation results to spec format", () => {
      const results = validateSymbolSpec(mockSymbolSpec);
      const specValidation = validationResultsToSpec(results);
      expect(specValidation.length).toBeGreaterThan(0);
      expect(specValidation.every((v) => typeof v.ok === "boolean")).toBe(true);
    });
  });

  describe("isValidSymbolSpec", () => {
    it("should return true for valid SymbolSpec", () => {
      expect(isValidSymbolSpec(mockSymbolSpec)).toBe(true);
    });

    it("should return false for invalid object", () => {
      expect(isValidSymbolSpec({} as any)).toBe(false);
    });

    it("should return false for null", () => {
      expect(isValidSymbolSpec(null)).toBe(false);
    });
  });

  describe("isValidSymbolPin", () => {
    it("should return true for valid SymbolPin", () => {
      const validPin: SymbolPin = {
        pinNumber: "1",
        name: "TEST",
        type: "signal",
        direction: "in",
        x: 0,
        y: 0,
        length: 20,
        electricalType: "signal",
        description: "Test pin",
        electrical: "signal",
        side: "left",
        evidenceId: "EV-0017",
      };
      expect(isValidSymbolPin(validPin)).toBe(true);
    });

    it("should return false for missing pinNumber", () => {
      expect(isValidSymbolPin({ name: "TEST" } as any)).toBe(false);
    });

    it("should return false for missing evidenceId", () => {
      expect(isValidSymbolPin({ pinNumber: "1", name: "TEST" } as any)).toBe(false);
    });
  });

  describe("getValidationSummary", () => {
    it("should return correct summary counts", () => {
      const results = validateSymbolSpec(mockSymbolSpec);
      const summary = getValidationSummary(results);
      expect(summary.passedCount).toBeGreaterThan(0);
      expect.summary.warningCount).toBe(0);
      expect.summary.failedCount).toBe(0);
      expect.summary.overallPassed).toBe(true);
    });

    it("should return summary with failures", () => {
      const invalidSpec = { ...mockSymbolSpec, mpn: "" };
      const results = validateSymbolSpec(invalidSpec);
      const summary = getValidationSummary(results);
      expect.summary.failedCount).toBeGreaterThan(0);
      expect.summary.overallPassed).toBe(false);
    });
  });
});

describe("Pin Extraction", () => {
  describe("parsePinoutText", () => {
    it("should parse simple pinout text", () => {
      const result = parsePinoutText("1  IN1-  Inverting input 1\n2  IN1+  Non-inverting input 1", { x: 0, y: 0, w: 1, h: 1 });
      expect(result.length).toBeGreaterThan(0);
    });

    it("should classify electrical type correctly", () => {
      expect(classifyElectricalType("VCC")).toBe("power");
      expect(classifyElectricalType("GND")).toBe("ground");
      expect(classifyElectricalType("IN")).toBe("input");
      expect(classifyElectricalType("OUT")).toBe("output");
      expect(classifyElectricalType("SIG")).toBe("signal");
    });

    it("should classify direction correctly", () => {
      expect(classifyDirection("IN1-")).toBe("in");
      expect(classifyDirection("OUT1")).toBe("out");
      expect(classifyDirection("BIDIR")).toBe("bidirectional");
    });
  });
});

describe("CircuitSpec Validation", () => {
  describe("circuit structure validation", () => {
    it("should validate valid CircuitSpec", () => {
      expect(CircuitSpecSchema.safeParse(mockCircuitSpec)).toMatchObject({
        success: true,
      });
    });

    it("should reject CircuitSpec with empty components", () => {
      const invalidCircuit = { ...mockCircuitSpec, components: [] };
      const result = CircuitSpecSchema.safeParse(invalidCircuit);
      expect(result.success).toBe(false);
    });

    it("should reject CircuitSpec with duplicate component references", () => {
      const invalidCircuit = {
        ...mockCircuitSpec,
        components: [...mockCircuitSpec.components, { ...mockCircuitSpec.components[0], id: "u2" }],
      };
      const result = CircuitSpecSchema.safeParse(invalidCircuit);
      expect(result.success).toBe(false);
    });

    it("should validate CircuitParameter with formula", () => {
      const param: CircuitParameter = {
        name: "Vout",
        value: "5",
        units: "V",
        formula: "Vout = Vin × R2 / (R1 + R2)",
        inputs: { Vin: "5", R1: "1k", R2: "2k" },
      };
      const result = CircuitParameterSchema.safeParse(param);
      expect(result.success).toBe(true);
    });
  });
});

describe("Mock pin extraction from evidence", () => {
  // This test uses the extractPinsFromEvidence function with mocked data
  it("should handle insufficient evidence case", async () => {
    const result = await extractPinsFromEvidence("NONEXISTENT", "workspace-1");
    expect(result.success).toBe(false);
    expect(result.reason).toContain("Insufficient verified pinout evidence");
  });
});
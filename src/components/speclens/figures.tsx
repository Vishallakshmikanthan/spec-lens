import { cn } from "@/lib/utils";
import {
  Cpu,
  Box,
  Layers,
  Waves,
  CircuitBoard,
  Ruler,
  ShieldCheck,
  Table2,
  Grid3x3,
} from "lucide-react";

type EvidenceType =
  | "pinout"
  | "package"
  | "block-diagram"
  | "timing"
  | "application-circuit"
  | "electrical-curve"
  | "mechanical"
  | "table"
  | "absolute-maximum"
  | "functional-diagram"
  | "other";

export function Figure({ type }: { type: EvidenceType }) {
  return (
    <div className="h-8 w-8 rounded-md bg-primary/10 flex items-center justify-center">
      {type === "pinout" && <Cpu className="size-4" />}
      {type === "package" && <Box className="size-4" />}
      {type === "block-diagram" && <Layers className="size-4" />}
      {type === "timing" && <Waves className="size-4" />}
      {type === "application-circuit" && <CircuitBoard className="size-4" />}
      {type === "electrical-curve" && <ShieldCheck className="size-4" />}
      {type === "mechanical" && <Ruler className="size-4" />}
      {type === "table" && <Table2 className="size-4" />}
      {type === "absolute-maximum" && <ShieldCheck className="size-4" />}
      {type === "functional-diagram" && <Grid3x3 className="size-4" />}
      {type === "other" && <Grid3x3 className="size-4" />}
    </div>
  );
}

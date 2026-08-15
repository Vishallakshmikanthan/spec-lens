/**
 * Evidence inspector component.
 *
 * Display detailed information about a selected evidence region.
 * Appears in the right panel of the investigation workspace.
 *
 * Features:
 * - Evidence type, title, caption, confidence
 * - Verification state
 * - Source document, page, component info
 * - Model version and extraction timestamp
 * - Actions: View source, Open page, Open crop, Ask Copilot
 */
import { cn } from "@/lib/utils";
import { EvidenceTypeBadge } from "./evidence-ui";
import { BboxOverlay } from "./bbox-overlay";
import type { Evidence, EvidenceType, BoundingBox } from "@/types/speclens";

/**
 * Props for the evidence inspector.
 */
interface EvidenceInspectorProps {
  /** The evidence record to display */
  evidence: Evidence;
  /** Whether the inspector is open */
  isOpen: boolean;
  /** Callback when the inspector is closed */
  onClose: () => void;
  /** Callback when "View source" is clicked */
  onViewSource: () => void;
  /** Callback when "Open page" is clicked */
  onOpenPage: () => void;
  /** Callback when "Open crop" is clicked */
  onOpenCrop: () => void;
  /** Callback when "Ask Copilot" is clicked */
  onAskCopilot: () => void;
  /** Evidence regions for overlay highlighting */
  evidenceRegions?: Array<{ bbox: BoundingBox; evidenceType: string; title: string }>;
}

/**
 * Render the evidence type badge.
 */
function EvidenceTypeBadgeInline(type: EvidenceType) {
  const typeLabels: Record<EvidenceType, string> = {
    pinout: "Pinout",
    package: "Package",
    "block-diagram": "Block diagram",
    timing: "Timing",
    "application-circuit": "Application circuit",
    "electrical-curve": "Electrical curve",
    mechanical: "Mechanical",
    table: "Table",
    "absolute-maximum": "Absolute maximum",
    "functional-diagram": "Functional diagram",
    other: "Other",
  };

  const label = typeLabels[type] || type;
  return (
    <span className="inline-flex items-center rounded-md bg-primary/10 px-2.5 py-0.5 text-[9px] text-primary/80">
      {label}
    </span>
  );
}

/**
 * Render the evidence inspector panel.
 */
export function EvidenceInspector({
  evidence,
  isOpen,
  onClose,
  onViewSource,
  onOpenPage,
  onOpenCrop,
  onAskCopilot,
  evidenceRegions,
}: EvidenceInspectorProps) {
  return (
    <div
      className={cn(
        "fixed right-0 top-0 inset-y-0 w-80 bg-background border-l border-border min-h-screen z-50 overflow-y-auto",
        isOpen && "show"
      )}
      onClick={isOpen && (e) => e.target === e.currentTarget && onClose()}
    >
      <div className="p-6 flex flex-col max-h-screen">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border pb-4">
          <h2 className="text-lg font-semibold">
            {evidence.title || "Evidence Region"}
          </h2>
          <button
            onClick={onClose}
            className="p-1 rounded-hover:bg-accent"
            aria-label="Close inspector"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-5 w-5"
              viewBox="0 0 20 20"
              fill="currentColor"
            >
              <path d="M9.293 9.293a1 1 0 011.414 0L10 4.414l1.414 1.414a1 1 0 01-1.414 1.414L10 5.828l-1.414 1.414a1 1 0 010-1.414z" />
            </svg>
          </button>
        </div>

        {/* Evidence details */}
        <div className="space-y-4 flex-1">
          {/* Evidence type and confidence */}
          <div className="flex items-center gap-3">
            <EvidenceTypeBadgeInline type={evidence.type} />
            <ConfidenceBar value={evidence.confidence} />
          </div>

          {/* Title */}
          {evidence.title && (
            <div>
              <h3 className="font-medium text-foreground">{evidence.title}</h3>
            </div>
          )}

          {/* Caption */}
          {evidence.caption && (
            <p className="text-sm text-foreground/70 line-clamp-3">
              {evidence.caption}
            </p>
          )}

          {/* Verification state */}
          <div>
            <label className="text-[9px] text-foreground/60 uppercase tracking-wider">Verification</label>
            <span className="ml-2 rounded-md px-2 py-0.5 text-[9px] {
              evidence.verification === "verified"
                ? "bg-primary/10 text-primary"
                : evidence.verification === "flagged"
                  ? "bg-error/10 text-error"
                  : "bg-muted/10 text-muted-foreground"
            }">
              {evidence.verification === "verified"
                ? "Verified"
                : evidence.verification === "flagged"
                  ? "Flagged"
                  : "Unverified"}
            </span>
          </div>

          {/* Provenance information */}
          <div className="grid grid-cols-2 gap-3 text-[9px] text-foreground/60">
            <div>
              <span className="font-medium">Page</span>
              <span>{evidence.page}</span>
            </div>
            <div>
              <span className="font-medium">Document</span>
              <span>{evidence.mpn || "—"}</span>
            </div>
            <div>
              <span className="font-medium">Model version</span>
              <span>{evidence.modelVersion || "—"}</span>
            </div>
            <div>
              <span className="font-medium">Extraction timestamp</span>
              <span>{new Date(evidence.timestamp).toLocaleString()}</span>
            </div>
          </div>

          {/* Component reference */}
          {evidence.componentId !== null && evidence.componentId !== undefined && (
            <div>
              <span className="font-medium">Component</span>
              <span>Component ID: {evidence.componentId}</span>
            </div>
          )}

          {/* Crop URI */}
          {evidence.cropStorageKey && (
            <div className="my-4 pt-4 border-t border-border">
              <h3 className="text-[9px] font-medium text-foreground/60 mb-2">Crop image</h3>
              <p className="text-[11px] text-foreground/60 line-clamp-2">
                Crop storage key: {evidence.cropStorageKey}
              </p>
            </div>
          )}

          {/* Action buttons */}
          <div className="pt-4 border-t border-border flex flex-col gap-2">
            <button
              onClick={() => {
                onViewSource();
                onClose();
              }}
              className="w-full justify-start rounded-md px-3 py-2 text-[11px] text-primary hover:bg-primary/5"
              title="View source document"
            >
              View source
            </button>
            <button
              onClick={() => {
                onOpenPage();
                onClose();
              }}
              className="w-full justify-start rounded-md px-3 py-2 text-[11px] text-foreground hover:bg-foreground/5"
              title="Open page in document"
            >
              Open page
            </button>
            {evidence.cropStorageKey && (
              <button
                onClick={() => {
                  onOpenCrop();
                  onClose();
                }}
                className="w-full justify-start rounded-md px-3 py-2 text-[11px] text-foreground hover:bg-foreground/5"
                title="Open crop image"
              >
                Open crop
              </button>
            )}
            <button
              onClick={() => {
                onAskCopilot();
                onClose();
              }}
              className="w-full justify-start rounded-md px-3 py-2 text-[11px] text-primary hover:bg-primary/5"
              title="Ask Copilot about this evidence"
            >
              Ask Copilot
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
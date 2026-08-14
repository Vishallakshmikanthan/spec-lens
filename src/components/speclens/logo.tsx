import { cn } from "@/lib/utils";

/**
 * SpecLens mark — an aperture (lens) seated inside a silicon-package frame.
 * Communicates "optical inspection of engineering documents".
 */
export function SpecLensMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 32 32"
      aria-hidden="true"
      className={cn("size-7 text-primary", className)}
      fill="none"
    >
      {/* package frame */}
      <rect
        x="2.5"
        y="2.5"
        width="27"
        height="27"
        rx="7"
        stroke="currentColor"
        strokeOpacity="0.45"
      />
      {/* pin traces */}
      <path
        d="M2.5 11h3M2.5 16h4M2.5 21h3M26.5 11h3M26 16h3.5M26.5 21h3M11 2.5v3M16 2.5v3.5M21 2.5v3M11 26.5v3M16 26v3.5M21 26.5v3"
        stroke="currentColor"
        strokeOpacity="0.35"
        strokeLinecap="round"
      />
      {/* aperture blades */}
      <circle cx="16" cy="16" r="7.5" stroke="currentColor" strokeWidth="1.4" />
      <path
        d="M16 8.5 L22.5 12.25 M22.5 12.25 L22.5 19.75 M22.5 19.75 L16 23.5 M16 23.5 L9.5 19.75 M9.5 19.75 L9.5 12.25 M9.5 12.25 L16 8.5"
        stroke="currentColor"
        strokeOpacity="0.55"
        strokeWidth="1"
      />
      <path
        d="M16 16 L22.5 12.25 M16 16 L22.5 19.75 M16 16 L16 23.5 M16 16 L9.5 19.75 M16 16 L9.5 12.25 M16 16 L16 8.5"
        stroke="currentColor"
        strokeOpacity="0.28"
        strokeWidth="0.9"
      />
      <circle cx="16" cy="16" r="2.4" fill="currentColor" />
    </svg>
  );
}

export function SpecLensLogo({
  className,
  showText = true,
}: {
  className?: string;
  showText?: boolean;
}) {
  return (
    <span className={cn("flex items-center gap-2.5", className)}>
      <SpecLensMark />
      {showText && (
        <span className="text-[15px] font-semibold uppercase tracking-[0.14em]">
          Spec<span className="text-primary">Lens</span>
        </span>
      )}
    </span>
  );
}

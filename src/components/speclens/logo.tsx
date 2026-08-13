import { cn } from "@/lib/utils";

export function SpecLensMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 32 32"
      aria-hidden="true"
      className={cn("size-7 text-primary", className)}
      fill="none"
    >
      <rect x="1" y="1" width="30" height="30" rx="8" stroke="currentColor" strokeOpacity="0.35" />
      <rect x="7.5" y="6.5" width="12" height="16" rx="2" stroke="currentColor" strokeOpacity="0.5" />
      <path d="M10 11h7M10 14h5M10 17h7" stroke="currentColor" strokeOpacity="0.55" strokeLinecap="round" />
      <circle cx="19.5" cy="18.5" r="6" stroke="currentColor" strokeWidth="1.6" />
      <path d="M24 23l3.5 3.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M17 18.5h5M19.5 16v5" stroke="currentColor" strokeOpacity="0.9" strokeWidth="1.2" strokeLinecap="round" />
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
        <span className="text-[15px] font-semibold tracking-tight">
          Spec<span className="text-primary">Lens</span>
        </span>
      )}
    </span>
  );
}

import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { DEMO_MODE } from "@/lib/speclens/config";

export function PageHeader({
  title,
  subtitle,
  actions,
  className,
}: {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col gap-3 border-b border-border px-4 py-5 sm:px-6 md:flex-row md:items-center md:justify-between md:py-6",
        className,
      )}
    >
      <div className="min-w-0">
        <h1 className="text-[19px] font-semibold tracking-tight">{title}</h1>
        {subtitle && <p className="mt-1 text-[13px] text-muted-foreground">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

export function Section({
  title,
  description,
  actions,
  children,
  className,
}: {
  title?: string;
  description?: string;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("space-y-3", className)}>
      {(title || actions) && (
        <div className="flex items-end justify-between gap-3">
          <div>
            {title && (
              <h2 className="font-mono text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
                {title}
              </h2>
            )}
            {description && <p className="mt-1 text-[13px] text-muted-foreground">{description}</p>}
          </div>
          {actions}
        </div>
      )}
      {children}
    </section>
  );
}

export function KpiCard({
  label,
  value,
  hint,
  icon: Icon,
  delta,
}: {
  label: string;
  value: string;
  hint?: string;
  icon?: LucideIcon;
  delta?: { text: string; positive: boolean };
}) {
  return (
    <div className="panel relative overflow-hidden p-4">
      <div className="flex items-start justify-between">
        <span className="font-mono text-[10.5px] uppercase tracking-[0.14em] text-muted-foreground">
          {label}
        </span>
        {Icon && <Icon className="size-4 text-muted-foreground/60" aria-hidden="true" />}
      </div>
      <div className="mt-3 flex items-baseline gap-2">
        <span className="text-[26px] font-semibold tabular-nums tracking-tight">{value}</span>
        {delta && (
          <span
            className={cn(
              "font-mono text-[11px]",
              delta.positive ? "text-success" : "text-warning",
            )}
          >
            {delta.text}
          </span>
        )}
      </div>
      <p className="mt-1 text-[11.5px] text-muted-foreground">
        {hint ?? (DEMO_MODE ? "Demo value" : "")}
      </p>
    </div>
  );
}

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  suggestions,
}: {
  icon: LucideIcon;
  title: string;
  description: string;
  action?: ReactNode;
  suggestions?: string[];
}) {
  return (
    <div className="panel flex flex-col items-center justify-center px-6 py-16 text-center">
      <span className="grid size-11 place-items-center rounded-lg border border-border bg-secondary">
        <Icon className="size-5 text-muted-foreground" aria-hidden="true" />
      </span>
      <h3 className="mt-4 text-[15px] font-medium">{title}</h3>
      <p className="mt-1.5 max-w-sm text-[13px] text-muted-foreground">{description}</p>
      {suggestions && (
        <ul className="mt-4 flex flex-wrap justify-center gap-2">
          {suggestions.map((s) => (
            <li
              key={s}
              className="rounded-full border border-border bg-secondary px-3 py-1 text-[12px] text-muted-foreground"
            >
              {s}
            </li>
          ))}
        </ul>
      )}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

export function ErrorState({
  title,
  reason,
  details,
  onRetry,
}: {
  title: string;
  reason: string;
  details?: string;
  onRetry?: () => void;
}) {
  return (
    <div className="panel border-destructive/30 p-5">
      <h3 className="text-[14px] font-medium text-destructive">{title}</h3>
      <p className="mt-1.5 text-[13px] text-muted-foreground">{reason}</p>
      <div className="mt-4 flex items-center gap-2">
        {onRetry && (
          <button
            onClick={onRetry}
            className="rounded-md border border-border bg-secondary px-3 py-1.5 text-[12.5px] transition-colors hover:bg-surface-raised"
          >
            Retry
          </button>
        )}
        {details && (
          <details className="text-[12.5px] text-muted-foreground">
            <summary className="cursor-pointer select-none">Technical details</summary>
            <pre className="mt-2 overflow-x-auto rounded-md border border-border bg-background p-3 font-mono text-[11px]">
              {details}
            </pre>
          </details>
        )}
      </div>
    </div>
  );
}

export function DemoNotice({ className }: { className?: string }) {
  if (!DEMO_MODE) return null;
  return (
    <p className={cn("font-mono text-[11px] text-muted-foreground/80", className)}>
      Demo data — values are illustrative until the SpecLens backend is connected.
    </p>
  );
}

import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { cva, type VariantProps } from "class-variance-authority";
import { Dialog, DialogTrigger, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { Button, buttonVariants } from "@/components/ui/button";
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";
import { DEMO_MODE } from "@/lib/speclens/config";

const badgeVariants = cva(
  "inline-flex items-center rounded-md border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
  {
    variants: {
      variant: {
        default: "border-transparent bg-primary text-primary-foreground shadow hover:bg-primary/80",
        secondary:
          "border-transparent bg-secondary text-secondary-foreground hover:bg-secondary/80",
        destructive:
          "border-transparent bg-destructive text-destructive-foreground shadow hover:bg-destructive/80",
        outline: "text-foreground",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
);

export function SpecLensButton({
  variant = "default",
  size = "default",
  className,
  children,
}: {
  variant?: "default" | "secondary" | "destructive" | "outline" | "ghost" | "link";
  size?: "default" | "sm" | "lg" | "icon";
  className?: string;
  children: ReactNode;
}) {
  return (
    <button
      className={cn(
        "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium cursor-pointer transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 disabled:cursor-not-allowed [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
        buttonVariants({ variant, size, className }),
      )}
    >
      {children}
    </button>
  );
}

export function SpecLensCard({ className, children }: { className?: string; children: ReactNode }) {
  return (
    <div className={cn("rounded-xl border bg-card text-card-foreground shadow", className)}>
      {children}
    </div>
  );
}

export function SpecLensCardHeader({
  className,
  children,
}: {
  className?: string;
  children: ReactNode;
}) {
  return <div className={cn("flex flex-col space-y-1.5 p-6", className)}>{children}</div>;
}

export function SpecLensCardTitle({
  className,
  children,
}: {
  className?: string;
  children: ReactNode;
}) {
  return (
    <div className={cn("font-semibold leading-none tracking-tight", className)}>{children}</div>
  );
}

export function SpecLensCardDescription({
  className,
  children,
}: {
  className?: string;
  children: ReactNode;
}) {
  return <div className={cn("text-sm text-muted-foreground", className)}>{children}</div>;
}

export function SpecLensBadge({
  variant = "default",
  className,
  children,
}: {
  variant?: "default" | "secondary" | "destructive" | "outline";
  className?: string;
  children: ReactNode;
}) {
  return (
    <div
      className={cn(
        "inline-flex items-center rounded-md border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
        badgeVariants({ variant, className }),
      )}
    >
      {children}
    </div>
  );
}

export function SpecLensInput({
  type = "text",
  placeholder,
  value,
  onChange,
  disabled,
  className,
}: {
  type?: string;
  placeholder?: string;
  value?: string | undefined;
  onChange?: React.ChangeEventHandler<HTMLInputElement> | undefined;
  disabled?: boolean | undefined;
  className?: string;
}) {
  return (
    <input
      type={type}
      placeholder={placeholder}
      value={value}
      onChange={onChange}
      disabled={disabled}
      className={cn(
        "flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-base shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 md:text-sm",
        className,
      )}
    />
  );
}

export function SpecLensSearch({
  placeholder = "Search…",
  value,
  onChange,
  disabled,
  className,
}: {
  placeholder?: string;
  value?: string | undefined;
  onChange?: React.ChangeEventHandler<HTMLInputElement> | undefined;
  disabled?: boolean | undefined;
  className?: string;
}) {
  return (
    <SpecLensInput
      placeholder={placeholder}
      value={value}
      onChange={onChange}
      disabled={disabled}
      className={cn("pl-10", className)}
    />
  );
}

export function SpecLensDialog({
  open,
  onOpenChange,
  title,
  children,
  className,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={cn("sm:rounded-lg", className)}>
        <DialogTitle>{title}</DialogTitle>
        {children}
      </DialogContent>
    </Dialog>
  );
}

export function SpecLensTabs({
  defaultValue = "overview",
  className,
  children,
}: {
  defaultValue?: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <Tabs defaultValue={defaultValue} className={cn("w-full", className)}>
      {children}
    </Tabs>
  );
}

export function SpecLensTooltip({
  content,
  side = "top",
  className,
  children,
}: {
  content: ReactNode;
  side?: "top" | "right" | "bottom" | "left";
  className?: string;
  children: ReactNode;
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>{children}</TooltipTrigger>
      <TooltipContent side={side} className={className}>
        {content}
      </TooltipContent>
    </Tooltip>
  );
}

export function SpecLensSkeleton({ className, ...props }: React.ComponentPropsWithoutRef<"div">) {
  return <Skeleton className={cn("rounded-md bg-primary/10", className)} {...props} />;
}

export function SpecLensEmptyState({
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
    <div className="flex flex-col items-center justify-center px-6 py-16 text-center">
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

export function SpecLensStatus({
  status,
  className,
}: {
  status: "indexed" | "indexing" | "queued" | "failed";
  className?: string;
}) {
  const map: Record<string, { label: string; cls: string }> = {
    indexed: { label: "Indexed", cls: "text-success border-success/30 bg-success/10" },
    indexing: { label: "Indexing", cls: "text-primary border-primary/30 bg-primary/10" },
    queued: { label: "Queued", cls: "text-muted-foreground border-border bg-secondary" },
    failed: { label: "Failed", cls: "text-destructive border-destructive/30 bg-destructive/10" },
  };

  const s = map[status];
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center gap-1.5 rounded-sm border px-2 py-0.5 text-[11px]",
        s!.cls,
        className,
      )}
    >
      {status === "indexing" && <span className="size-1.5 animate-pulse rounded-full bg-primary" />}
      {s!.label}
    </span>
  );
}

export function SpecLensMetric({
  label,
  value,
  delta,
  className,
}: {
  label: string;
  value: string;
  delta?: { text: string; positive: boolean };
  className?: string;
}) {
  return (
    <div className={cn("text-right", className)}>
      <p className="font-mono text-[10.5px] uppercase tracking-[0.14em] text-muted-foreground">
        {label}
      </p>
      <p className="text-[26px] font-semibold tabular-nums tracking-tight">{value}</p>
      {delta && (
        <p className={cn("mt-1", delta.positive ? "text-success" : "text-warning")}>{delta.text}</p>
      )}
    </div>
  );
}

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
  hint?: string | undefined;
  icon?: LucideIcon | undefined;
  delta?: { text: string; positive: boolean } | undefined;
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

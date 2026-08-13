import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { Check, FileText, FolderPlus, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AuthLayout } from "./login";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/onboarding")({
  head: () => ({
    meta: [
      { title: "Workspace setup — SpecLens" },
      { name: "description", content: "Set up your SpecLens workspace in three short steps." },
      { property: "og:title", content: "Workspace setup — SpecLens" },
      {
        property: "og:description",
        content: "Choose focus areas and invite your engineering team.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: OnboardingPage,
});

const focusAreas = [
  "Analog & op-amps",
  "Power conversion",
  "Microcontrollers",
  "Motor control",
  "RF & wireless",
  "Sensors",
];

const steps = [
  { key: "focus", label: "Focus areas", icon: FileText },
  { key: "collection", label: "First collection", icon: FolderPlus },
  { key: "team", label: "Invite team", icon: Users },
];

function OnboardingPage() {
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [selected, setSelected] = useState<string[]>(["Analog & op-amps"]);

  const next = () => (step < steps.length - 1 ? setStep(step + 1) : void navigate({ to: "/app" }));

  return (
    <AuthLayout
      heading="Set up your workspace"
      sub="Three quick steps — you can change everything later."
    >
      <ol className="mb-6 flex items-center gap-2" aria-label="Setup progress">
        {steps.map((s, i) => (
          <li key={s.key} className="flex flex-1 items-center gap-2">
            <span
              className={cn(
                "grid size-6 shrink-0 place-items-center rounded-full border text-[11px]",
                i < step && "border-success/40 bg-success/10 text-success",
                i === step && "border-primary bg-primary/10 text-primary",
                i > step && "border-border text-muted-foreground",
              )}
              aria-current={i === step ? "step" : undefined}
            >
              {i < step ? <Check className="size-3" /> : i + 1}
            </span>
            {i < steps.length - 1 && <span className="h-px flex-1 bg-border" />}
          </li>
        ))}
      </ol>

      {step === 0 && (
        <div className="space-y-3">
          <p className="text-[13px] text-muted-foreground">
            What kind of components do you work with? This tunes evidence ranking defaults.
          </p>
          <div className="flex flex-wrap gap-2">
            {focusAreas.map((f) => {
              const on = selected.includes(f);
              return (
                <button
                  key={f}
                  type="button"
                  aria-pressed={on}
                  onClick={() => setSelected((s) => (on ? s.filter((x) => x !== f) : [...s, f]))}
                  className={cn(
                    "rounded-full border px-3 py-1.5 text-[12.5px] transition-colors",
                    on
                      ? "border-primary/50 bg-primary/10 text-foreground"
                      : "border-border bg-secondary text-muted-foreground hover:text-foreground",
                  )}
                >
                  {f}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {step === 1 && (
        <div className="space-y-3">
          <Label htmlFor="collection">Name your first collection</Label>
          <Input id="collection" defaultValue="Op-Amp Reference" />
          <p className="text-[12.5px] text-muted-foreground">
            Collections group verified evidence, datasheets and components for a project.
          </p>
        </div>
      )}

      {step === 2 && (
        <div className="space-y-3">
          <Label htmlFor="invite">Invite teammates (optional)</Label>
          <Input id="invite" placeholder="engineer@company.com, lead@company.com" />
          <p className="text-[12.5px] text-muted-foreground">
            Invitations are simulated in the demo workspace.
          </p>
        </div>
      )}

      <div className="mt-6 flex items-center justify-between">
        <Button variant="ghost" size="sm" onClick={() => void navigate({ to: "/app" })}>
          Skip
        </Button>
        <Button size="sm" onClick={next}>
          {step === steps.length - 1 ? "Enter workspace" : "Continue"}
        </Button>
      </div>
    </AuthLayout>
  );
}

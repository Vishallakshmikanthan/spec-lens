import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { SpecLensLogo } from "@/components/speclens/logo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { DEMO_MODE } from "@/lib/speclens/config";

export const Route = createFileRoute("/login")({
  head: () => ({
    meta: [
      { title: "Sign in — SpecLens" },
      {
        name: "description",
        content: "Sign in to your SpecLens engineering intelligence workspace.",
      },
      { property: "og:title", content: "Sign in — SpecLens" },
      { property: "og:description", content: "Engineering intelligence, focused." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: LoginPage,
});

export function AuthLayout({
  children,
  heading,
  sub,
}: {
  children: React.ReactNode;
  heading: string;
  sub: string;
}) {
  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden px-4 py-12">
      <div className="pointer-events-none absolute inset-0 grid-bg" aria-hidden="true" />
      <div className="pointer-events-none absolute inset-0 hero-glow" aria-hidden="true" />
      <div className="relative w-full max-w-[400px]">
        <Link to="/" className="mx-auto flex w-fit" aria-label="SpecLens home">
          <SpecLensLogo />
        </Link>
        <h1 className="mt-6 text-center text-[20px] font-semibold tracking-tight">{heading}</h1>
        <p className="mt-1.5 text-center text-[13px] text-muted-foreground">{sub}</p>
        <div className="panel mt-7 p-6 shadow-[var(--shadow-panel)]">{children}</div>
        {DEMO_MODE && (
          <p className="mt-4 text-center font-mono text-[11px] text-muted-foreground">
            Demo mode — authentication is not connected; any input opens the workspace.
          </p>
        )}
      </div>
    </div>
  );
}

function LoginPage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);

  return (
    <AuthLayout
      heading="Engineering intelligence, focused."
      sub="Sign in to your SpecLens workspace."
    >
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          setLoading(true);
          setTimeout(() => void navigate({ to: "/app" }), 400);
        }}
      >
        <div className="space-y-1.5">
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            type="email"
            required
            placeholder="you@company.com"
            autoComplete="email"
          />
        </div>
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <Label htmlFor="password">Password</Label>
            <Link to="/login" className="text-[12px] text-muted-foreground hover:text-foreground">
              Forgot password
            </Link>
          </div>
          <Input id="password" type="password" required autoComplete="current-password" />
        </div>
        <Button type="submit" className="w-full" disabled={loading}>
          {loading ? "Opening workspace…" : "Continue"}
        </Button>
      </form>

      <div className="my-5 flex items-center gap-3">
        <span className="h-px flex-1 bg-border" />
        <span className="font-mono text-[10.5px] uppercase tracking-[0.14em] text-muted-foreground">
          or
        </span>
        <span className="h-px flex-1 bg-border" />
      </div>

      <div className="grid gap-2">
        {["Continue with Google", "Continue with SSO"].map((label) => (
          <Button
            key={label}
            type="button"
            variant="outline"
            className="w-full"
            onClick={() => void navigate({ to: "/app" })}
          >
            {label}
          </Button>
        ))}
      </div>

      <p className="mt-5 text-center text-[12.5px] text-muted-foreground">
        No account?{" "}
        <Link to="/register" className="text-primary hover:underline">
          Create account
        </Link>
      </p>
    </AuthLayout>
  );
}

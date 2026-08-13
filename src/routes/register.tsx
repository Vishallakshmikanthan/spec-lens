import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { AuthLayout } from "./login";
import type { UserRole } from "@/lib/speclens/types";

export const Route = createFileRoute("/register")({
  head: () => ({
    meta: [
      { title: "Create workspace — SpecLens" },
      {
        name: "description",
        content: "Create a SpecLens workspace to index datasheets and search visual evidence.",
      },
      { property: "og:title", content: "Create workspace — SpecLens" },
      { property: "og:description", content: "Set up your engineering intelligence workspace." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: RegisterPage,
});

const roles: UserRole[] = ["Student", "Researcher", "Engineer", "Engineering Team", "Organization"];

function RegisterPage() {
  const navigate = useNavigate();
  const [role, setRole] = useState<UserRole>("Engineer");

  return (
    <AuthLayout
      heading="Create your workspace"
      sub="Start indexing datasheets in the demo workspace."
    >
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          void navigate({ to: "/onboarding" });
        }}
      >
        <div className="space-y-1.5">
          <Label htmlFor="name">Name</Label>
          <Input id="name" required placeholder="Ada Lovelace" autoComplete="name" />
        </div>
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
          <Label htmlFor="password">Password</Label>
          <Input id="password" type="password" required autoComplete="new-password" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="workspace">Workspace name</Label>
          <Input id="workspace" required placeholder="Analog Systems Lab" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="role">Role</Label>
          <Select value={role} onValueChange={(v) => setRole(v as UserRole)}>
            <SelectTrigger id="role">
              <SelectValue placeholder="Select role" />
            </SelectTrigger>
            <SelectContent>
              {roles.map((r) => (
                <SelectItem key={r} value={r}>
                  {r}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <Button type="submit" className="w-full">
          Create workspace
        </Button>
      </form>

      <p className="mt-5 text-center text-[12.5px] text-muted-foreground">
        Already have an account?{" "}
        <Link to="/login" className="text-primary hover:underline">
          Sign in
        </Link>
      </p>
    </AuthLayout>
  );
}

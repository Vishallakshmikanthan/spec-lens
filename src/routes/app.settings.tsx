import { createFileRoute } from "@tanstack/react-router";
import { PageHeader, Section, DemoNotice } from "@/components/speclens/primitives";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { mockUser, mockWorkspaces } from "@/lib/speclens/mock-data";
import { DEMO_MODE } from "@/lib/speclens/config";

export const Route = createFileRoute("/app/settings")({
  head: () => ({
    meta: [
      { title: "Settings — SpecLens" },
      {
        name: "description",
        content:
          "Manage profile, workspace, search and AI preferences, and developer connection status.",
      },
      { property: "og:title", content: "Settings — SpecLens" },
      {
        property: "og:description",
        content:
          "Manage profile, workspace, search and AI preferences, and developer connection status.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: SettingsPage,
});

const connections = [
  ["API status", "Mock service layer", "warn"],
  ["Backend connection", "Not connected", "warn"],
  ["Model status", "Abstract provider — not bound", "warn"],
  ["Vector database", "Not connected", "warn"],
] as const;

function SettingsPage() {
  return (
    <div>
      <PageHeader title="Settings" subtitle="Workspace and application preferences." />
      <div className="px-4 py-6 sm:px-6">
        <Tabs defaultValue="profile">
          <TabsList className="flex-wrap">
            {[
              "profile",
              "workspace",
              "appearance",
              "notifications",
              "search",
              "ai",
              "data",
              "developer",
            ].map((t) => (
              <TabsTrigger key={t} value={t} className="capitalize">
                {t}
              </TabsTrigger>
            ))}
          </TabsList>

          <TabsContent value="profile" className="mt-5 max-w-md space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="n">Name</Label>
              <Input id="n" defaultValue={mockUser.name} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="e">Email</Label>
              <Input id="e" defaultValue={mockUser.email} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="r">Role</Label>
              <Input id="r" defaultValue={mockUser.role} />
            </div>
          </TabsContent>

          <TabsContent value="workspace" className="mt-5 max-w-md space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="w">Workspace name</Label>
              <Input id="w" defaultValue={mockWorkspaces[0]!.name} />
            </div>
            <p className="text-[12.5px] text-muted-foreground">
              {mockWorkspaces[0]!.members} members · {mockWorkspaces[0]!.plan}
            </p>
          </TabsContent>

          <TabsContent value="appearance" className="mt-5 max-w-md space-y-4">
            <p className="text-[13px] text-muted-foreground">
              SpecLens uses a dark, engineering-focused theme optimized for long document review
              sessions.
            </p>
            <div className="flex items-center justify-between rounded-md border border-border bg-surface px-3 py-2.5">
              <Label htmlFor="motion" className="text-[13px]">
                Reduce motion
              </Label>
              <Switch id="motion" />
            </div>
          </TabsContent>

          <TabsContent value="notifications" className="mt-5 max-w-md space-y-2">
            {["Indexing complete", "New evidence for saved searches", "Processing failures"].map(
              (l) => (
                <div
                  key={l}
                  className="flex items-center justify-between rounded-md border border-border bg-surface px-3 py-2.5"
                >
                  <Label htmlFor={l} className="text-[13px]">
                    {l}
                  </Label>
                  <Switch id={l} defaultChecked />
                </div>
              ),
            )}
          </TabsContent>

          <TabsContent value="search" className="mt-5 max-w-md space-y-2">
            {["Prefer verified evidence", "Include unverified regions", "Expand MPN aliases"].map(
              (l, i) => (
                <div
                  key={l}
                  className="flex items-center justify-between rounded-md border border-border bg-surface px-3 py-2.5"
                >
                  <Label htmlFor={l} className="text-[13px]">
                    {l}
                  </Label>
                  <Switch id={l} defaultChecked={i !== 1} />
                </div>
              ),
            )}
          </TabsContent>

          <TabsContent value="ai" className="mt-5 max-w-md space-y-3">
            <p className="text-[13px] text-muted-foreground">
              The Copilot provider is intentionally abstract. Answers must be grounded in retrieved
              evidence and return sources, evidence IDs and confidence.
            </p>
            <div className="rounded-md border border-border bg-surface px-3 py-2.5 font-mono text-[12px]">
              provider: unbound (demo)
            </div>
          </TabsContent>

          <TabsContent value="data" className="mt-5 max-w-md space-y-3">
            <p className="text-[13px] text-muted-foreground">
              Export or delete workspace data once the backend is connected.
            </p>
            <div className="rounded-md border border-border bg-surface px-3 py-2.5 text-[12.5px]">
              Demo mode: {DEMO_MODE ? "enabled" : "disabled"} — no data is persisted.
            </div>
          </TabsContent>

          <TabsContent value="developer" className="mt-5 max-w-xl">
            <Section title="Connection status">
              <ul className="divide-y divide-border overflow-hidden rounded-lg border border-border">
                {connections.map(([label, value]) => (
                  <li
                    key={label}
                    className="flex items-center justify-between gap-3 bg-surface px-3 py-2.5 text-[12.5px]"
                  >
                    <span>{label}</span>
                    <span className="flex items-center gap-2 font-mono text-[11.5px] text-muted-foreground">
                      <span className="size-1.5 rounded-full bg-warning" />
                      {value}
                    </span>
                  </li>
                ))}
              </ul>
            </Section>
          </TabsContent>
        </Tabs>
        <DemoNotice className="mt-6" />
      </div>
    </div>
  );
}

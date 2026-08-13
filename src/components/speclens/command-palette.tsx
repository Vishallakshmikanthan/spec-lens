import { useEffect } from "react";
import { useNavigate } from "@tanstack/react-router";
import {
  BarChart3,
  Bot,
  FileSearch,
  FileText,
  Layers,
  Search,
  Settings,
  Shapes,
  Upload,
} from "lucide-react";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
  CommandShortcut,
} from "@/components/ui/command";
import { mockDatasheets } from "@/lib/speclens/mock-data";

export function CommandPalette({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const navigate = useNavigate();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        onOpenChange(!open);
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onOpenChange]);

  const go = (to: string) => {
    onOpenChange(false);
    void navigate({ to });
  };

  const actions = [
    { label: "Search datasheets", icon: FileText, to: "/app/datasheets", keys: "D" },
    { label: "Search evidence", icon: Search, to: "/app/search", keys: "S" },
    { label: "Open component", icon: Layers, to: "/app/components", keys: "C" },
    { label: "Upload datasheet", icon: Upload, to: "/app/upload", keys: "U" },
    { label: "Ask SpecLens Copilot", icon: Bot, to: "/app/copilot", keys: "A" },
    { label: "Generate symbol", icon: Shapes, to: "/app/symbols", keys: "Y" },
    { label: "View analytics", icon: BarChart3, to: "/app/analytics", keys: "N" },
    { label: "Open settings", icon: Settings, to: "/app/settings", keys: "," },
  ];

  return (
    <CommandDialog open={open} onOpenChange={onOpenChange}>
      <CommandInput placeholder="Type a command or search…" aria-label="SpecLens command palette" />
      <CommandList>
        <CommandEmpty>No matching command.</CommandEmpty>
        <CommandGroup heading="Actions">
          {actions.map((a) => (
            <CommandItem key={a.label} onSelect={() => go(a.to)}>
              <a.icon className="size-4 text-muted-foreground" />
              <span>{a.label}</span>
              <CommandShortcut>⌘{a.keys}</CommandShortcut>
            </CommandItem>
          ))}
        </CommandGroup>
        <CommandSeparator />
        <CommandGroup heading="Recent documents">
          {mockDatasheets.slice(0, 5).map((d) => (
            <CommandItem key={d.id} onSelect={() => go(`/app/evidence?doc=${d.id}`)}>
              <FileSearch className="size-4 text-muted-foreground" />
              <span>{d.fileName}</span>
              <span className="ml-auto font-mono text-[11px] text-muted-foreground">
                {d.mpn}
              </span>
            </CommandItem>
          ))}
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  );
}

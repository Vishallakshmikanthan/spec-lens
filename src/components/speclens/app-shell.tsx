import { useState } from "react";
import { Link, useRouterState } from "@tanstack/react-router";
import {
  Activity,
  BarChart3,
  Bell,
  Bot,
  ChevronsLeft,
  ChevronsRight,
  Check,
  Clock,
  FolderOpen,
  HelpCircle,
  LayoutDashboard,
  Layers,
  FileText,
  Menu,
  ScanSearch,
  Search,
  Settings,
  Shapes,
  Terminal,
  Upload,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { SpecLensLogo, SpecLensMark } from "./logo";
import { CommandPalette } from "./command-palette";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Toaster } from "@/components/ui/sonner";
import { DEMO_MODE } from "@/lib/speclens/config";
import { mockNotifications, mockUser, mockWorkspaces } from "@/lib/speclens/mock-data";

interface NavItem {
  label: string;
  to: string;
  icon: LucideIcon;
}

const primaryNav: NavItem[] = [
  { label: "Command Center", to: "/app", icon: LayoutDashboard },
  { label: "Datasheets", to: "/app/datasheets", icon: FileText },
  { label: "Visual Search", to: "/app/search", icon: Search },
  { label: "Evidence Explorer", to: "/app/evidence", icon: ScanSearch },
  { label: "Components", to: "/app/components", icon: Layers },
  { label: "Symbol Studio", to: "/app/symbols", icon: Shapes },
  { label: "Analytics", to: "/app/analytics", icon: BarChart3 },
];

const secondaryNav: NavItem[] = [
  { label: "Collections", to: "/app/collections", icon: FolderOpen },
  { label: "Recent", to: "/app/history", icon: Clock },
  { label: "Copilot", to: "/app/copilot", icon: Bot },
  { label: "Processing", to: "/app/monitor", icon: Activity },
  { label: "Developer", to: "/app/developer", icon: Terminal },
];

const tertiaryNav: NavItem[] = [
  { label: "Settings", to: "/app/settings", icon: Settings },
  { label: "Help", to: "/app/help", icon: HelpCircle },
];

function NavLink({
  item,
  collapsed,
  onNavigate,
}: {
  item: NavItem;
  collapsed: boolean;
  onNavigate?: (() => void) | undefined;
}) {
  const link = (
    <Link
      to={item.to}
      onClick={onNavigate}
      activeOptions={{ exact: item.to === "/app" }}
      className={cn(
        "group relative flex items-center gap-2.5 rounded-md px-2.5 py-[7px] text-[13px] text-sidebar-foreground/75 transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
        collapsed && "justify-center px-0",
      )}
      activeProps={{
        className:
          "bg-sidebar-accent text-sidebar-accent-foreground before:absolute before:left-0 before:top-1/2 before:h-4 before:w-[2px] before:-translate-y-1/2 before:rounded-r before:bg-primary",
      }}
    >
      <item.icon className="size-4 shrink-0" aria-hidden="true" />
      {!collapsed && <span className="truncate">{item.label}</span>}
      {collapsed && <span className="sr-only">{item.label}</span>}
    </Link>
  );

  if (!collapsed) return link;
  return (
    <Tooltip>
      <TooltipTrigger asChild>{link}</TooltipTrigger>
      <TooltipContent side="right">{item.label}</TooltipContent>
    </Tooltip>
  );
}

function SidebarBody({
  collapsed,
  onNavigate,
}: {
  collapsed: boolean;
  onNavigate?: (() => void) | undefined;
}) {
  const [workspace, setWorkspace] = useState(mockWorkspaces[0]!);

  return (
    <div className="flex h-full flex-col">
      <div
        className={cn(
          "flex h-14 items-center border-b border-sidebar-border px-3",
          collapsed && "justify-center px-0",
        )}
      >
        <Link to="/" aria-label="SpecLens home">
          {collapsed ? <SpecLensMark /> : <SpecLensLogo />}
        </Link>
      </div>

      <nav className="flex-1 space-y-5 overflow-y-auto px-2 py-4" aria-label="Main">
        <div className="space-y-0.5">
          {primaryNav.map((i) => (
            <NavLink key={i.to} item={i} collapsed={collapsed} onNavigate={onNavigate} />
          ))}
        </div>
        <div className="space-y-0.5 border-t border-sidebar-border pt-4">
          {secondaryNav.map((i) => (
            <NavLink key={i.to} item={i} collapsed={collapsed} onNavigate={onNavigate} />
          ))}
        </div>
        <div className="space-y-0.5 border-t border-sidebar-border pt-4">
          {tertiaryNav.map((i) => (
            <NavLink key={i.to} item={i} collapsed={collapsed} onNavigate={onNavigate} />
          ))}
        </div>
      </nav>

      <div className="border-t border-sidebar-border p-2">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              className={cn(
                "flex w-full items-center gap-2.5 rounded-md px-2 py-2 text-left transition-colors hover:bg-sidebar-accent",
                collapsed && "justify-center px-0",
              )}
              aria-label="Workspace and account menu"
            >
              <span className="grid size-7 shrink-0 place-items-center rounded-md border border-border bg-secondary font-mono text-[11px] font-medium">
                {mockUser.initials}
              </span>
              {!collapsed && (
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[12.5px] font-medium">{mockUser.name}</span>
                  <span className="block truncate text-[11px] text-muted-foreground">
                    {workspace.name}
                  </span>
                </span>
              )}
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" side="top" className="w-60">
            <DropdownMenuLabel className="text-[11px] uppercase tracking-wider text-muted-foreground">
              Switch workspace
            </DropdownMenuLabel>
            {mockWorkspaces.map((w) => (
              <DropdownMenuItem key={w.id} onSelect={() => setWorkspace(w)}>
                <span className="flex-1 truncate">{w.name}</span>
                {w.id === workspace.id && <Check className="size-3.5 text-primary" />}
              </DropdownMenuItem>
            ))}
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild>
              <Link to="/app/settings">Workspace settings</Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link to="/login">Sign out</Link>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}

function NotificationBell() {
  const unread = mockNotifications.filter((n) => !n.read).length;
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="relative min-h-9 min-w-9"
          aria-label={`Notifications (${unread} unread)`}
        >
          <Bell className="size-4" />
          {unread > 0 && (
            <span className="absolute right-1.5 top-1.5 size-1.5 rounded-full bg-primary" />
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-0">
        <div className="border-b border-border px-3 py-2 text-[12px] font-medium">
          Notifications
        </div>
        <ul className="max-h-80 divide-y divide-border overflow-y-auto">
          {mockNotifications.map((n) => (
            <li key={n.id} className="flex gap-2.5 px-3 py-2.5">
              <span
                className={cn(
                  "mt-1.5 size-1.5 shrink-0 rounded-full",
                  n.tone === "success" && "bg-success",
                  n.tone === "info" && "bg-primary",
                  n.tone === "error" && "bg-destructive",
                )}
              />
              <span className="min-w-0">
                <span className="block text-[12.5px] font-medium">{n.title}</span>
                <span className="block text-[12px] text-muted-foreground">{n.body}</span>
                <span className="mt-0.5 block font-mono text-[10.5px] text-muted-foreground/70">
                  {n.at}
                </span>
              </span>
            </li>
          ))}
        </ul>
      </PopoverContent>
    </Popover>
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const [collapsed, setCollapsed] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  const crumb =
    [...primaryNav, ...secondaryNav, ...tertiaryNav].find((n) =>
      n.to === "/app" ? pathname === "/app" : pathname.startsWith(n.to),
    )?.label ?? "Command Center";

  return (
    <div className="flex min-h-screen bg-background">
      <CommandPalette open={paletteOpen} onOpenChange={setPaletteOpen} />

      <aside
        className={cn(
          "sticky top-0 hidden h-screen shrink-0 border-r border-sidebar-border bg-sidebar transition-[width] duration-200 md:block",
          collapsed ? "w-[60px]" : "w-[228px]",
        )}
      >
        <SidebarBody collapsed={collapsed} />
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex h-14 items-center gap-2 border-b border-border bg-background/85 px-3 backdrop-blur-md sm:px-4">
          <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
            <SheetTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="md:hidden"
                aria-label="Open navigation"
              >
                <Menu className="size-4" />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-[260px] bg-sidebar p-0">
              <SheetTitle className="sr-only">Navigation</SheetTitle>
              <SidebarBody collapsed={false} onNavigate={() => setMobileOpen(false)} />
            </SheetContent>
          </Sheet>

          <Button
            variant="ghost"
            size="icon"
            className="hidden md:inline-flex"
            onClick={() => setCollapsed((c) => !c)}
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            {collapsed ? <ChevronsRight className="size-4" /> : <ChevronsLeft className="size-4" />}
          </Button>

          <span className="hidden text-[12.5px] text-muted-foreground sm:inline">SpecLens</span>
          <span className="hidden text-muted-foreground/40 sm:inline">/</span>
          <span className="truncate text-[12.5px] font-medium">{crumb}</span>

          <div className="ml-auto flex items-center gap-1.5">
            {DEMO_MODE && (
              <span className="hidden items-center gap-1.5 rounded-sm border border-border bg-secondary px-2 py-1 font-mono text-[10.5px] uppercase tracking-[0.14em] text-muted-foreground sm:inline-flex">
                <span className="size-1.5 rounded-full bg-warning" />
                Demo workspace
              </span>
            )}
            <button
              onClick={() => setPaletteOpen(true)}
              className="hidden items-center gap-2 rounded-md border border-border bg-surface px-2.5 py-1.5 text-[12px] text-muted-foreground transition-colors hover:border-border-strong hover:text-foreground lg:flex"
            >
              <Search className="size-3.5" />
              Search or jump to…
              <kbd className="ml-6 rounded border border-border bg-secondary px-1.5 py-0.5 font-mono text-[10px]">
                ⌘K
              </kbd>
            </button>
            <Button
              variant="ghost"
              size="icon"
              className="lg:hidden"
              aria-label="Open command palette"
              onClick={() => setPaletteOpen(true)}
            >
              <Search className="size-4" />
            </Button>
            <NotificationBell />
            <Button asChild size="sm" className="hidden sm:inline-flex">
              <Link to="/app/upload">
                <Upload className="size-3.5" />
                Upload
              </Link>
            </Button>
            <Toaster />
          </div>
        </header>

        <main className="min-w-0 flex-1">{children}</main>
      </div>
    </div>
  );
}

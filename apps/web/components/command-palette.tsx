"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  FolderKanban,
  Home,
  Link2,
  ScrollText,
  Shield,
  Users,
} from "lucide-react";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import type { RoleCapabilities } from "@/lib/auth/permissions";
import {
  buildCommandPaletteItems,
  groupCommandPaletteItems,
  type CommandPaletteItem,
  type CommandPaletteProject,
} from "@/lib/command-palette";

type CommandPaletteProps = {
  projects: CommandPaletteProject[];
  capabilities: RoleCapabilities;
};

const OPEN_COMMAND_PALETTE_EVENT = "gridnull:open-command-palette";

function itemIcon(item: CommandPaletteItem) {
  switch (item.id) {
    case "nav-home":
      return Home;
    case "nav-projects":
      return FolderKanban;
    case "nav-connections":
      return Link2;
    case "admin-overview":
      return Shield;
    case "admin-users":
      return Users;
    case "admin-audit":
      return ScrollText;
    default:
      return FolderKanban;
  }
}

export function CommandPalette({ projects, capabilities }: CommandPaletteProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const groupedItems = groupCommandPaletteItems(
    buildCommandPaletteItems(projects, capabilities),
  );

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key.toLowerCase() === "k" && (event.metaKey || event.ctrlKey)) {
        event.preventDefault();
        setOpen((current) => !current);
      }
    }

    function onOpenRequest() {
      setOpen(true);
    }

    document.addEventListener("keydown", onKeyDown);
    document.addEventListener(OPEN_COMMAND_PALETTE_EVENT, onOpenRequest);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.removeEventListener(OPEN_COMMAND_PALETTE_EVENT, onOpenRequest);
    };
  }, []);

  function navigate(href: string) {
    setOpen(false);
    router.push(href);
  }

  return (
    <CommandDialog open={open} onOpenChange={setOpen}>
      <CommandInput placeholder="Jump to a page or project…" />
      <CommandList>
        <CommandEmpty>No matches found.</CommandEmpty>
        {groupedItems.map((entry, index) => (
          <div key={entry.group}>
            {index > 0 ? <CommandSeparator /> : null}
            <CommandGroup heading={entry.group}>
              {entry.items.map((item) => {
                const Icon = itemIcon(item);

                return (
                  <CommandItem
                    key={item.id}
                    value={`${item.label} ${item.keywords}`}
                    onSelect={() => navigate(item.href)}
                  >
                    <Icon className="h-4 w-4 text-muted-foreground" />
                    <span>{item.label}</span>
                  </CommandItem>
                );
              })}
            </CommandGroup>
          </div>
        ))}
      </CommandList>
    </CommandDialog>
  );
}

export function CommandPaletteHint() {
  return (
    <button
      type="button"
      className="flex w-full items-center justify-between rounded-lg border border-border/60 bg-background/40 px-3 py-2 text-left text-xs text-muted-foreground transition-colors hover:border-primary/30 hover:bg-accent/40 hover:text-foreground"
      onClick={() => {
        document.dispatchEvent(new Event(OPEN_COMMAND_PALETTE_EVENT));
      }}
    >
      <span>Quick jump</span>
      <kbd className="rounded border border-border/80 bg-muted/50 px-1.5 py-0.5 font-mono text-[10px]">
        ⌘K / Ctrl+K
      </kbd>
    </button>
  );
}

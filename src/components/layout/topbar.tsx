"use client";

import { usePathname } from "next/navigation";
import { useTheme } from "next-themes";
import { Moon, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";
import { navItems } from "@/lib/nav";
import { GlobalSearch } from "./global-search";
import { NotificationBell } from "./notification-bell";
import { UserMenu } from "./user-menu";

export function TopBar() {
  const { theme, setTheme } = useTheme();
  const pathname = usePathname();
  const match =
    [...navItems]
      .sort((a, b) => b.href.length - a.href.length)
      .find((i) => (i.href === "/" ? pathname === "/" : pathname.startsWith(i.href))) ?? null;
  const title = match?.label ?? "Masjid Mumineen";

  return (
    <header className="flex h-16 shrink-0 items-center gap-4 border-b border-[var(--color-border)] bg-[var(--color-background)]/80 px-5 backdrop-blur">
      <h1 className="text-lg font-semibold">{title}</h1>

      <GlobalSearch />

      <Button
        variant="ghost"
        size="icon"
        aria-label="Toggle theme"
        onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
      >
        <Sun className="h-4 w-4 dark:hidden" />
        <Moon className="hidden h-4 w-4 dark:block" />
      </Button>

      <NotificationBell />
      <UserMenu />
    </header>
  );
}

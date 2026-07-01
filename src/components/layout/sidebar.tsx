"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { navItems, navGroups } from "@/lib/nav";
import { StarMark } from "@/components/icons/star-mark";
import { cn } from "@/lib/utils";

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="hidden w-64 shrink-0 flex-col border-r border-[var(--color-border)] bg-[var(--color-card)] lg:flex">
      <div className="flex h-16 items-center gap-2.5 border-b border-[var(--color-border)] px-5">
        <div className="flex h-9 w-9 items-center justify-center rounded-[var(--radius)] bg-[var(--color-primary)] text-[var(--color-brass)]">
          <StarMark className="h-5 w-5" />
        </div>
        <div className="leading-tight">
          <div className="font-display font-semibold">Masjid Mumineen</div>
          <div className="text-xs text-[var(--color-muted-foreground)]">Member &amp; Finance Portal</div>
        </div>
      </div>

      <nav className="flex-1 space-y-6 overflow-y-auto px-3 py-5">
        {navGroups.map((group) => (
          <div key={group}>
            <div className="px-3 pb-1.5 text-xs font-medium uppercase tracking-wider text-[var(--color-muted-foreground)]">
              {group}
            </div>
            <div className="space-y-0.5">
              {navItems
                .filter((i) => i.group === group)
                .map((item) => {
                  const active =
                    item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
                  const Icon = item.icon;
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      className={cn(
                        "flex items-center gap-3 rounded-[var(--radius)] border-l-2 py-2 pl-[10px] pr-3 text-sm font-medium transition-colors",
                        active
                          ? "border-[var(--color-brass)] bg-[var(--color-accent)]/60 text-[var(--color-accent-foreground)]"
                          : "border-transparent text-[var(--color-muted-foreground)] hover:bg-[var(--color-muted)] hover:text-[var(--color-foreground)]",
                      )}
                    >
                      <Icon className="h-4 w-4" />
                      {item.label}
                    </Link>
                  );
                })}
            </div>
          </div>
        ))}
      </nav>

      <div className="border-t border-[var(--color-border)] p-3 text-xs text-[var(--color-muted-foreground)]">
        <div className="rounded-[var(--radius)] bg-[var(--color-muted)] px-3 py-2">
          Connected to Supabase — office accounts.
        </div>
      </div>
    </aside>
  );
}

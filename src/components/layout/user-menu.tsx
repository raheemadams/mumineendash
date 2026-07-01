"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronDown, LogOut } from "lucide-react";
import { useStore } from "@/lib/store/provider";
import { signOutAction } from "@/lib/actions/auth";
import { initials } from "@/lib/utils";

/**
 * Shows the signed-in office account (name + real office title, resolved
 * server-side from the session — see `(app)/layout.tsx`) and a sign-out
 * action. There's no role picker anymore: each office logs in as itself.
 */
export function UserMenu() {
  const { currentUser } = useStore();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  return (
    <div ref={ref} className="relative">
      <button
        aria-label="Account menu"
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-2.5 rounded-[var(--radius)] py-1 pl-1 pr-2 hover:bg-[var(--color-muted)]"
      >
        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[var(--color-primary)] text-xs font-semibold text-[var(--color-primary-foreground)]">
          {initials(currentUser.fullName)}
        </div>
        <div className="hidden text-left leading-tight sm:block">
          <div className="text-sm font-medium">{currentUser.fullName}</div>
          <div className="text-xs text-[var(--color-muted-foreground)]">{currentUser.officeLabel}</div>
        </div>
        <ChevronDown className="hidden h-3.5 w-3.5 text-[var(--color-muted-foreground)] sm:block" />
      </button>

      {open && (
        <div className="absolute right-0 z-50 mt-1 w-56 rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-card)] p-1.5 shadow-lg">
          <div className="px-2 py-1.5 text-xs text-[var(--color-muted-foreground)]">{currentUser.email}</div>
          <form action={signOutAction}>
            <button
              type="submit"
              className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm text-[var(--color-danger)] hover:bg-[var(--color-muted)]"
            >
              <LogOut className="h-3.5 w-3.5" /> Sign out
            </button>
          </form>
        </div>
      )}
    </div>
  );
}

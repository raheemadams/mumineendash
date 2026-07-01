"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  AlertCircle,
  Banknote,
  Bell,
  Gift,
  UserCheck,
  type LucideIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useStore } from "@/lib/store/provider";
import { notifications, type NotificationItem } from "@/lib/store/selectors";
import { formatDate } from "@/lib/utils";

const ICONS: Record<NotificationItem["type"], LucideIcon> = {
  MEMBERSHIP_EXPIRED: UserCheck,
  DEPOSIT_AWAITING_RECONCILIATION: Banknote,
  LARGE_DONATION: Gift,
  OUTSTANDING_BALANCE: AlertCircle,
  UPCOMING_RENEWAL: UserCheck,
};

export function NotificationBell() {
  const { state, markNotificationRead, markAllNotificationsRead } = useStore();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const items = useMemo(() => notifications(state), [state]);
  const unread = items.filter((n) => !state.readNotificationIds.includes(n.id));

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  return (
    <div ref={ref} className="relative">
      <Button variant="ghost" size="icon" aria-label="Notifications" className="relative" onClick={() => setOpen((o) => !o)}>
        <Bell className="h-4 w-4" />
        {unread.length > 0 && (
          <span className="absolute right-1.5 top-1.5 flex h-3.5 min-w-3.5 items-center justify-center rounded-full bg-[var(--color-danger)] px-0.5 text-[9px] font-bold text-white">
            {unread.length}
          </span>
        )}
      </Button>

      {open && (
        <div className="absolute right-0 z-50 mt-1 w-96 rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-card)] shadow-lg">
          <div className="flex items-center justify-between border-b border-[var(--color-border)] px-3 py-2">
            <span className="text-sm font-semibold">Notifications</span>
            {unread.length > 0 && (
              <button
                className="text-xs font-medium text-[var(--color-primary)] hover:underline"
                onClick={() => markAllNotificationsRead(items.map((n) => n.id))}
              >
                Mark all read
              </button>
            )}
          </div>
          <div className="max-h-96 overflow-y-auto">
            {items.length === 0 && (
              <p className="p-6 text-center text-sm text-[var(--color-muted-foreground)]">All caught up.</p>
            )}
            {items.map((n) => {
              const Icon = ICONS[n.type];
              const isRead = state.readNotificationIds.includes(n.id);
              return (
                <button
                  key={n.id}
                  onClick={() => markNotificationRead(n.id)}
                  className={`flex w-full items-start gap-2.5 border-b border-[var(--color-border)] px-3 py-2.5 text-left last:border-0 hover:bg-[var(--color-muted)] ${
                    isRead ? "opacity-60" : ""
                  }`}
                >
                  <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[var(--color-accent)] text-[var(--color-accent-foreground)]">
                    <Icon className="h-3.5 w-3.5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-medium leading-snug">{n.title}</div>
                    <div className="text-xs text-[var(--color-muted-foreground)]">{n.body}</div>
                    <div className="mt-0.5 text-[10px] text-[var(--color-muted-foreground)]">{formatDate(n.at)}</div>
                  </div>
                  {!isRead && <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--color-primary)]" />}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Search, Users, ScrollText, Banknote } from "lucide-react";
import { useStore } from "@/lib/store/provider";
import { formatCurrency, formatDate } from "@/lib/utils";

type Result = {
  key: string;
  section: "Members" | "Ledger" | "Deposits";
  primary: string;
  secondary: string;
  href: string;
};

const SECTION_ICON = { Members: Users, Ledger: ScrollText, Deposits: Banknote } as const;
const MAX_PER_SECTION = 5;

export function GlobalSearch() {
  const { state } = useStore();
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  const accountName = (id: string) => state.accounts.find((a) => a.id === id)?.name ?? "";

  const results = useMemo<Result[]>(() => {
    const q = query.trim().toLowerCase();
    if (q.length < 2) return [];

    const members: Result[] = state.members
      .filter((m) =>
        [m.fullName, m.memberCode, m.email, m.phone].some((f) => f?.toLowerCase().includes(q)),
      )
      .slice(0, MAX_PER_SECTION)
      .map((m) => ({
        key: `member-${m.id}`,
        section: "Members",
        primary: m.fullName,
        secondary: `${m.memberCode} · ${m.email || m.phone || "no contact on file"}`,
        href: `/members/${m.id}`,
      }));

    const ledger: Result[] = state.ledger
      .filter((t) =>
        [t.description, t.memo, t.referenceNumber].some((f) => f?.toLowerCase().includes(q)),
      )
      .slice(0, MAX_PER_SECTION)
      .map((t) => ({
        key: `txn-${t.id}`,
        section: "Ledger",
        primary: t.description || "(no description)",
        secondary: `${formatDate(t.date)} · ${accountName(t.accountId)} · ${formatCurrency(t.amount)}`,
        href: `/transactions#txn-${t.id}`,
      }));

    const deposits: Result[] = state.deposits
      .filter((d) => d.code.toLowerCase().includes(q))
      .slice(0, MAX_PER_SECTION)
      .map((d) => ({
        key: `deposit-${d.id}`,
        section: "Deposits",
        primary: `Deposit #${d.code}`,
        secondary: `${accountName(d.accountId)} · ${formatCurrency(d.expectedTotal)}`,
        href: `/deposits#dep-${d.id}`,
      }));

    return [...members, ...ledger, ...deposits];
  }, [query, state.members, state.ledger, state.deposits, state.accounts]);

  useEffect(() => {
    setActiveIndex(0);
  }, [results.length]);

  function go(r: Result) {
    router.push(r.href);
    setOpen(false);
    setQuery("");
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Escape") {
      setOpen(false);
      return;
    }
    if (!open || results.length === 0) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((i) => (i + 1) % results.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((i) => (i - 1 + results.length) % results.length);
    } else if (e.key === "Enter") {
      e.preventDefault();
      go(results[activeIndex]);
    }
  }

  let flatIndex = -1;

  return (
    <div ref={ref} className="relative ml-auto hidden max-w-xs flex-1 md:block">
      <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--color-muted-foreground)]" />
      <input
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={onKeyDown}
        placeholder="Search members, transactions, deposits…"
        aria-label="Search"
        className="h-9 w-full rounded-[var(--radius)] border border-[var(--color-input)] bg-[var(--color-card)] pl-9 pr-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-ring)]"
      />

      {open && query.trim().length >= 2 && (
        <div className="absolute left-0 right-0 z-50 mt-1 max-h-96 overflow-y-auto rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-card)] shadow-lg">
          {results.length === 0 && (
            <p className="p-4 text-center text-sm text-[var(--color-muted-foreground)]">
              No results for &ldquo;{query}&rdquo;
            </p>
          )}
          {(["Members", "Ledger", "Deposits"] as const).map((section) => {
            const items = results.filter((r) => r.section === section);
            if (items.length === 0) return null;
            const Icon = SECTION_ICON[section];
            return (
              <div key={section} className="border-b border-[var(--color-border)] last:border-0">
                <div className="px-3 pt-2 text-xs font-medium uppercase tracking-wider text-[var(--color-muted-foreground)]">
                  {section}
                </div>
                <div className="pb-1">
                  {items.map((r) => {
                    flatIndex += 1;
                    const idx = flatIndex;
                    return (
                      <button
                        key={r.key}
                        onMouseEnter={() => setActiveIndex(idx)}
                        onClick={() => go(r)}
                        className={`flex w-full items-center gap-2.5 px-3 py-2 text-left text-sm ${
                          idx === activeIndex ? "bg-[var(--color-muted)]" : ""
                        }`}
                      >
                        <Icon className="h-3.5 w-3.5 shrink-0 text-[var(--color-muted-foreground)]" />
                        <div className="min-w-0 flex-1">
                          <div className="truncate font-medium">{r.primary}</div>
                          <div className="truncate text-xs text-[var(--color-muted-foreground)]">{r.secondary}</div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { HeartHandshake, Lock, Plus } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { StatCard } from "@/components/stat-card";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/select-native";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  Field,
} from "@/components/ui/dialog";
import { useStore, type NewPastoralNote } from "@/lib/store/provider";
import { formatDate } from "@/lib/utils";
import type { PastoralKind } from "@/lib/store/types";

const NOTE_KINDS: PastoralKind[] = ["VISIT", "FUNERAL", "MARRIAGE", "SHAHADA", "COUNSELING", "PRAYER_REQUEST", "VOLUNTEER_REQUEST"];

export function ImamDashboard() {
  const { state, addPastoralNote } = useStore();
  const [open, setOpen] = useState(false);
  const [note, setNote] = useState<NewPastoralNote>({
    memberId: state.members[0]?.id ?? "",
    kind: "VISIT",
    title: "",
    body: "",
    occurredOn: new Date().toISOString().slice(0, 10),
    isPrivate: true,
  });

  // Members load asynchronously — backfill the default once they arrive.
  useEffect(() => {
    setNote((n) => ({ ...n, memberId: n.memberId || state.members[0]?.id || "" }));
  }, [state.members]);

  const byKind = NOTE_KINDS.map((k) => ({
    kind: k,
    count: state.pastoralNotes.filter((n) => n.kind === k).length,
  })).filter((r) => r.count > 0);

  const feed = [...state.pastoralNotes].sort((a, b) => b.occurredOn.localeCompare(a.occurredOn));
  const memberName = (id: string) => state.members.find((m) => m.id === id)?.fullName ?? id;

  function submit() {
    if (!note.title || !note.memberId) return;
    addPastoralNote(note);
    setNote({ ...note, title: "", body: "" });
    setOpen(false);
  }

  return (
    <div>
      <PageHeader
        title="Imam Dashboard"
        description="Pastoral care — private notes, visits, and requests. Visible only in the Imam role."
        action={
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4" /> Add note
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Add pastoral note</DialogTitle>
              </DialogHeader>
              <div className="space-y-3">
                <Field label="Member">
                  <NativeSelect value={note.memberId} onChange={(e) => setNote({ ...note, memberId: e.target.value })}>
                    {state.members.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.fullName}
                      </option>
                    ))}
                  </NativeSelect>
                </Field>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Kind">
                    <NativeSelect value={note.kind} onChange={(e) => setNote({ ...note, kind: e.target.value as PastoralKind })}>
                      {NOTE_KINDS.map((k) => (
                        <option key={k} value={k}>
                          {k.replace(/_/g, " ")}
                        </option>
                      ))}
                    </NativeSelect>
                  </Field>
                  <Field label="Date">
                    <Input type="date" value={note.occurredOn} onChange={(e) => setNote({ ...note, occurredOn: e.target.value })} />
                  </Field>
                </div>
                <Field label="Title">
                  <Input value={note.title} onChange={(e) => setNote({ ...note, title: e.target.value })} />
                </Field>
                <Field label="Notes">
                  <textarea
                    className="min-h-[100px] w-full rounded-[var(--radius)] border border-[var(--color-input)] bg-[var(--color-background)] p-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-ring)]"
                    value={note.body}
                    onChange={(e) => setNote({ ...note, body: e.target.value })}
                  />
                </Field>
              </div>
              <DialogFooter>
                <DialogClose asChild>
                  <Button variant="ghost">Cancel</Button>
                </DialogClose>
                <Button onClick={submit} disabled={!note.title}>
                  Save note
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        }
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Total Notes" value={String(state.pastoralNotes.length)} icon={HeartHandshake} trend="All time" trendUp />
        {byKind.slice(0, 3).map((r) => (
          <StatCard key={r.kind} label={r.kind.replace(/_/g, " ")} value={String(r.count)} icon={HeartHandshake} trend="Recorded" trendUp />
        ))}
      </div>

      <div className="mt-5 grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Lock className="h-4 w-4" /> Pastoral notes feed
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {feed.length === 0 && <p className="text-sm text-[var(--color-muted-foreground)]">No notes recorded yet.</p>}
            {feed.map((n) => (
              <div key={n.id} className="rounded-[var(--radius)] border border-[var(--color-border)] p-3">
                <div className="flex items-center justify-between">
                  <Link href={`/members/${n.memberId}`} className="font-medium text-[var(--color-primary)] hover:underline">
                    {memberName(n.memberId)}
                  </Link>
                  <Badge variant="outline">{n.kind.replace(/_/g, " ").toLowerCase()}</Badge>
                </div>
                <div className="mt-1 text-sm font-medium">{n.title}</div>
                {n.body && <p className="mt-0.5 text-sm text-[var(--color-muted-foreground)]">{n.body}</p>}
                <div className="mt-1 text-xs text-[var(--color-muted-foreground)]">{formatDate(n.occurredOn)}</div>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>By type</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {byKind.length === 0 && <p className="text-sm text-[var(--color-muted-foreground)]">No data yet.</p>}
            {byKind.map((r) => (
              <div key={r.kind} className="flex items-center justify-between text-sm">
                <span>{r.kind.replace(/_/g, " ").toLowerCase()}</span>
                <Badge variant="secondary">{r.count}</Badge>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

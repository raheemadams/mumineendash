"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, Pencil, Plus, Save, Users as UsersIcon, X } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/select-native";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
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
import { attributionLabel, familyMembers, memberDonations, memberDuesEvaluation } from "@/lib/store/selectors";
import { formatCurrency, formatDate, initials } from "@/lib/utils";
import type { Member, PastoralKind } from "@/lib/store/types";

const STATUS_TONE: Record<string, "success" | "secondary" | "warning" | "danger"> = {
  ACTIVE: "success",
  INACTIVE: "secondary",
  PENDING: "warning",
  SUSPENDED: "danger",
};

const DUES_TONE: Record<string, "success" | "warning" | "danger" | "secondary"> = {
  PAID: "success",
  UPCOMING: "secondary",
  GRACE_PERIOD: "warning",
  PAST_DUE: "danger",
  SUSPENDED: "secondary",
};

const NOTE_KINDS: PastoralKind[] = ["VISIT", "FUNERAL", "MARRIAGE", "SHAHADA", "COUNSELING", "PRAYER_REQUEST", "VOLUNTEER_REQUEST"];

export default function MemberDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { state, updateMember, addPastoralNote } = useStore();
  const member = state.members.find((m) => m.id === id);

  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<Member | null>(member ?? null);
  const [noteOpen, setNoteOpen] = useState(false);
  const [note, setNote] = useState<NewPastoralNote>({
    memberId: id,
    kind: "VISIT",
    title: "",
    body: "",
    occurredOn: new Date().toISOString().slice(0, 10),
    isPrivate: true,
  });

  if (!member) {
    return (
      <div>
        <Button variant="ghost" onClick={() => router.push("/members")}>
          <ArrowLeft className="h-4 w-4" /> Back to members
        </Button>
        <p className="mt-4 text-sm text-[var(--color-muted-foreground)]">Member not found.</p>
      </div>
    );
  }

  const donations = memberDonations(state, member.id);
  const duesRows = memberDuesEvaluation(state, member.id);
  const relatives = familyMembers(state, member.familyId).filter((m) => m.id !== member.id);
  const notes = state.pastoralNotes.filter((n) => n.memberId === member.id);
  const canSeePastoral = state.currentRole === "IMAM";

  function startEdit() {
    setDraft(member ?? null);
    setEditing(true);
  }

  function save() {
    if (!draft || !member) return;
    updateMember(member.id, {
      firstName: draft.firstName,
      lastName: draft.lastName,
      email: draft.email,
      phone: draft.phone,
      type: draft.type,
      status: draft.status,
      family: draft.family,
    });
    setEditing(false);
  }

  function submitNote() {
    if (!note.title) return;
    addPastoralNote(note);
    setNote({ ...note, title: "", body: "" });
    setNoteOpen(false);
  }

  return (
    <div>
      <Button variant="ghost" className="mb-3" onClick={() => router.push("/members")}>
        <ArrowLeft className="h-4 w-4" /> Back to members
      </Button>

      <PageHeader
        title={member.fullName}
        description={`${member.memberCode} · member since ${formatDate(member.joined)}`}
        action={
          editing ? (
            <div className="flex gap-2">
              <Button variant="ghost" onClick={() => setEditing(false)}>
                <X className="h-4 w-4" /> Cancel
              </Button>
              <Button onClick={save}>
                <Save className="h-4 w-4" /> Save
              </Button>
            </div>
          ) : (
            <Button variant="outline" onClick={startEdit}>
              <Pencil className="h-4 w-4" /> Edit profile
            </Button>
          )
        }
      />

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-1">
          <CardContent className="p-5">
            <div className="flex flex-col items-center text-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-[var(--color-accent)] text-lg font-semibold text-[var(--color-accent-foreground)]">
                {initials(member.fullName)}
              </div>
              <div className="mt-3">
                <Badge variant={STATUS_TONE[member.status] ?? "secondary"}>{member.status.toLowerCase()}</Badge>
              </div>
            </div>

            <div className="mt-5 space-y-3 text-sm">
              {editing && draft ? (
                <>
                  <div className="grid grid-cols-2 gap-2">
                    <Field label="First name">
                      <Input value={draft.firstName} onChange={(e) => setDraft({ ...draft, firstName: e.target.value })} />
                    </Field>
                    <Field label="Last name">
                      <Input value={draft.lastName} onChange={(e) => setDraft({ ...draft, lastName: e.target.value })} />
                    </Field>
                  </div>
                  <Field label="Email">
                    <Input value={draft.email} onChange={(e) => setDraft({ ...draft, email: e.target.value })} />
                  </Field>
                  <Field label="Phone">
                    <Input value={draft.phone} onChange={(e) => setDraft({ ...draft, phone: e.target.value })} />
                  </Field>
                  <Field label="Family name">
                    <Input value={draft.family} onChange={(e) => setDraft({ ...draft, family: e.target.value })} />
                  </Field>
                  <Field label="Membership type">
                    <NativeSelect value={draft.type} onChange={(e) => setDraft({ ...draft, type: e.target.value })}>
                      {["REGULAR", "FAMILY", "STUDENT", "SENIOR", "LIFETIME", "HONORARY"].map((t) => (
                        <option key={t}>{t}</option>
                      ))}
                    </NativeSelect>
                  </Field>
                  <Field label="Status">
                    <NativeSelect
                      value={draft.status}
                      onChange={(e) => setDraft({ ...draft, status: e.target.value as Member["status"] })}
                    >
                      {["ACTIVE", "PENDING", "INACTIVE", "SUSPENDED", "DECEASED", "MOVED_AWAY"].map((s) => (
                        <option key={s}>{s}</option>
                      ))}
                    </NativeSelect>
                  </Field>
                </>
              ) : (
                <>
                  <Row label="Email" value={member.email} />
                  <Row label="Phone" value={member.phone} />
                  <Row label="Family" value={member.family} />
                  <Row label="Type" value={member.type} />
                </>
              )}
            </div>

            {relatives.length > 0 && (
              <div className="mt-5 border-t border-[var(--color-border)] pt-4">
                <div className="mb-2 flex items-center gap-1.5 text-xs font-medium uppercase text-[var(--color-muted-foreground)]">
                  <UsersIcon className="h-3.5 w-3.5" /> Same household
                </div>
                <div className="space-y-1.5">
                  {relatives.map((r) => (
                    <button
                      key={r.id}
                      className="block w-full rounded-md px-2 py-1 text-left text-sm hover:bg-[var(--color-muted)]"
                      onClick={() => router.push(`/members/${r.id}`)}
                    >
                      {r.fullName}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <div className="space-y-4 lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle>Dues</CardTitle>
            </CardHeader>
            <CardContent>
              {duesRows.length === 0 ? (
                <p className="text-sm text-[var(--color-muted-foreground)]">No dues plan on file.</p>
              ) : (
                duesRows.map((r) => (
                  <div key={r.planId} className="flex items-center justify-between border-b border-[var(--color-border)] py-2 last:border-0">
                    <div>
                      <div className="font-medium">{formatCurrency(r.amount)} · {r.frequency.toLowerCase()}</div>
                      <div className="text-xs text-[var(--color-muted-foreground)]">
                        {r.evaluation.balanceDue > 0 ? `${formatCurrency(r.evaluation.balanceDue)} outstanding` : "Up to date"}
                      </div>
                    </div>
                    <Badge variant={DUES_TONE[r.evaluation.status]}>{r.evaluation.status.replace(/_/g, " ").toLowerCase()}</Badge>
                  </div>
                ))
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Donation history · {formatCurrency(donations.reduce((s, d) => s + d.amount, 0))} total</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead>Attribution</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {donations.map((d) => {
                    const cat = state.categories.find((c) => c.id === d.categoryId);
                    return (
                      <TableRow key={d.id}>
                        <TableCell className="whitespace-nowrap">{formatDate(d.donatedOn)}</TableCell>
                        <TableCell>
                          <Badge variant="outline">{cat?.name ?? "—"}</Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-wrap gap-1">
                            {d.campaignId && (
                              <Badge variant="secondary" className="text-[10px]">
                                {attributionLabel(state, "CAMPAIGN", d.campaignId)}
                              </Badge>
                            )}
                            {d.attributions.map((a, i) => (
                              <Badge key={i} variant="secondary" className="text-[10px]">
                                {attributionLabel(state, a.type, a.targetId)}
                              </Badge>
                            ))}
                          </div>
                        </TableCell>
                        <TableCell className="text-right font-medium text-[var(--color-success)]">{formatCurrency(d.amount)}</TableCell>
                      </TableRow>
                    );
                  })}
                  {donations.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={4} className="py-8 text-center text-sm text-[var(--color-muted-foreground)]">
                        No donations recorded for this member yet.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          {canSeePastoral && (
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle>Pastoral notes · private</CardTitle>
                <Dialog open={noteOpen} onOpenChange={setNoteOpen}>
                  <DialogTrigger asChild>
                    <Button size="sm">
                      <Plus className="h-3.5 w-3.5" /> Add note
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Add pastoral note</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-3">
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
                      <Button onClick={submitNote} disabled={!note.title}>
                        Save note
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              </CardHeader>
              <CardContent className="space-y-3">
                {notes.length === 0 && <p className="text-sm text-[var(--color-muted-foreground)]">No pastoral notes on file.</p>}
                {notes.map((n) => (
                  <div key={n.id} className="rounded-[var(--radius)] border border-[var(--color-border)] p-3">
                    <div className="flex items-center justify-between">
                      <span className="font-medium">{n.title}</span>
                      <Badge variant="outline">{n.kind.replace(/_/g, " ").toLowerCase()}</Badge>
                    </div>
                    <p className="mt-1 text-sm text-[var(--color-muted-foreground)]">{n.body}</p>
                    <div className="mt-1 text-xs text-[var(--color-muted-foreground)]">{formatDate(n.occurredOn)}</div>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between">
      <span className="text-[var(--color-muted-foreground)]">{label}</span>
      <span className="font-medium">{value || "—"}</span>
    </div>
  );
}

"use client";

import { useEffect, useState } from "react";
import { HeartHandshake, Plus } from "lucide-react";
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
import { useStore, type NewDonation } from "@/lib/store/provider";
import { attributionLabel, campaignProgress, donationsByCategory } from "@/lib/store/selectors";
import { formatCurrency, formatDate } from "@/lib/utils";
import type { PaymentMethod } from "@/lib/store/types";

const METHODS: PaymentMethod[] = ["CASH", "CHECK", "ZELLE", "PAYPAL", "CREDIT_CARD", "ACH", "WIRE", "SQUARE", "STRIPE", "OTHER"];

export default function DonationsPage() {
  const { state, recordDonation } = useStore();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<NewDonation>({
    categoryId: state.categories[0]?.id ?? "",
    amount: 0,
    method: "CASH",
    memberId: null,
    campaignId: null,
    familyId: null,
    eventId: null,
    accountId: state.accounts[0]?.id ?? "",
    donatedOn: new Date().toISOString().slice(0, 10),
    note: "",
    isAnonymous: false,
  });

  // Categories/accounts load asynchronously — backfill the defaults once
  // they arrive rather than locking the form to the empty first render.
  useEffect(() => {
    setForm((f) => ({
      ...f,
      categoryId: f.categoryId || state.categories[0]?.id || "",
      accountId: f.accountId || state.accounts[0]?.id || "",
    }));
  }, [state.categories, state.accounts]);

  const byCategory = donationsByCategory(state);
  const total = state.donations.reduce((s, d) => s + d.amount, 0);
  const catName = (id: string) => state.categories.find((c) => c.id === id)?.name ?? id;
  const memberName = (id: string | null) => state.members.find((m) => m.id === id)?.fullName ?? "Anonymous";

  function submit() {
    if (!form.amount || form.amount <= 0) return;
    recordDonation(form);
    setForm({ ...form, amount: 0, note: "", familyId: null, eventId: null });
    setOpen(false);
  }

  return (
    <div>
      <PageHeader
        title="Donations"
        description="Every recorded donation posts a matching entry to the ledger automatically."
        action={
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4" /> Record donation
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Record a donation</DialogTitle>
              </DialogHeader>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Amount">
                  <Input
                    type="number"
                    min={0}
                    step="0.01"
                    value={form.amount || ""}
                    onChange={(e) => setForm({ ...form, amount: parseFloat(e.target.value) || 0 })}
                  />
                </Field>
                <Field label="Date">
                  <Input type="date" value={form.donatedOn} onChange={(e) => setForm({ ...form, donatedOn: e.target.value })} />
                </Field>
                <Field label="Category">
                  <NativeSelect value={form.categoryId} onChange={(e) => setForm({ ...form, categoryId: e.target.value })}>
                    {state.categories.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </NativeSelect>
                </Field>
                <Field label="Method">
                  <NativeSelect value={form.method} onChange={(e) => setForm({ ...form, method: e.target.value as PaymentMethod })}>
                    {METHODS.map((m) => (
                      <option key={m}>{m}</option>
                    ))}
                  </NativeSelect>
                </Field>
                <Field label="Member">
                  <NativeSelect
                    value={form.memberId ?? ""}
                    onChange={(e) => setForm({ ...form, memberId: e.target.value || null })}
                    disabled={form.isAnonymous}
                  >
                    <option value="">— none —</option>
                    {state.members.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.fullName}
                      </option>
                    ))}
                  </NativeSelect>
                </Field>
                <Field label="Deposit to account">
                  <NativeSelect value={form.accountId} onChange={(e) => setForm({ ...form, accountId: e.target.value })}>
                    {state.accounts.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.name}
                      </option>
                    ))}
                  </NativeSelect>
                </Field>
                <Field label="Campaign (optional)">
                  <NativeSelect value={form.campaignId ?? ""} onChange={(e) => setForm({ ...form, campaignId: e.target.value || null })}>
                    <option value="">— none —</option>
                    {state.campaigns.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </NativeSelect>
                </Field>
                <Field label="Also attribute to family">
                  <NativeSelect value={form.familyId ?? ""} onChange={(e) => setForm({ ...form, familyId: e.target.value || null })}>
                    <option value="">— none —</option>
                    {state.families.map((f) => (
                      <option key={f.id} value={f.id}>
                        {f.familyName}
                      </option>
                    ))}
                  </NativeSelect>
                </Field>
                <Field label="Also attribute to event">
                  <NativeSelect value={form.eventId ?? ""} onChange={(e) => setForm({ ...form, eventId: e.target.value || null })}>
                    <option value="">— none —</option>
                    {state.events.map((ev) => (
                      <option key={ev.id} value={ev.id}>
                        {ev.name}
                      </option>
                    ))}
                  </NativeSelect>
                </Field>
                <Field label="Note">
                  <Input value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} />
                </Field>
                <label className="col-span-2 flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={form.isAnonymous}
                    onChange={(e) => setForm({ ...form, isAnonymous: e.target.checked, memberId: e.target.checked ? null : form.memberId })}
                  />
                  Anonymous donation
                </label>
                <p className="col-span-2 text-xs text-[var(--color-muted-foreground)]">
                  A donation can belong to a member, their family, a campaign and an event all at once —
                  pick as many as apply.
                </p>
              </div>
              <DialogFooter>
                <DialogClose asChild>
                  <Button variant="ghost">Cancel</Button>
                </DialogClose>
                <Button onClick={submit} disabled={!form.amount}>
                  Record & post to ledger
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        }
      />

      <div className="mb-5 grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Recent donations · {formatCurrency(total)} total</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Donor</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Attribution</TableHead>
                  <TableHead>Method</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {state.donations.map((d) => (
                  <TableRow key={d.id}>
                    <TableCell className="whitespace-nowrap">{formatDate(d.donatedOn)}</TableCell>
                    <TableCell className="font-medium">{d.isAnonymous ? "Anonymous" : memberName(d.memberId)}</TableCell>
                    <TableCell>
                      <Badge variant="outline">{catName(d.categoryId)}</Badge>
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
                        {!d.campaignId && d.attributions.length === 0 && (
                          <span className="text-xs text-[var(--color-muted-foreground)]">—</span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-[var(--color-muted-foreground)]">{d.method.toLowerCase()}</TableCell>
                    <TableCell className="text-right font-medium text-[var(--color-success)]">{formatCurrency(d.amount)}</TableCell>
                  </TableRow>
                ))}
                {state.donations.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={6} className="py-10 text-center text-sm text-[var(--color-muted-foreground)]">
                      No donations yet — record your first one.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>By category</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {byCategory.length === 0 && <p className="text-sm text-[var(--color-muted-foreground)]">No data yet.</p>}
              {byCategory.map((c) => (
                <div key={c.name} className="flex items-center justify-between text-sm">
                  <span className="flex items-center gap-2">
                    <HeartHandshake className="h-3.5 w-3.5 text-[var(--color-primary)]" />
                    {c.name}
                  </span>
                  <span className="font-medium">{formatCurrency(c.value)}</span>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Campaigns</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {state.campaigns.map((c) => {
                const raised = campaignProgress(state, c.id);
                const pct = Math.min(100, Math.round((raised / c.goalAmount) * 100));
                return (
                  <div key={c.id}>
                    <div className="mb-1 flex justify-between text-sm">
                      <span className="font-medium">{c.name}</span>
                      <span className="text-[var(--color-muted-foreground)]">{pct}%</span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-[var(--color-muted)]">
                      <div className="h-full rounded-full bg-[var(--color-primary)]" style={{ width: `${pct}%` }} />
                    </div>
                    <div className="mt-1 text-xs text-[var(--color-muted-foreground)]">
                      {formatCurrency(raised)} of {formatCurrency(c.goalAmount)}
                    </div>
                  </div>
                );
              })}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

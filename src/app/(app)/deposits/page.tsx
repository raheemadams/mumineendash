"use client";

import { useEffect, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent } from "@/components/ui/card";
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
import { useStore, type NewDeposit } from "@/lib/store/provider";
import { formatCurrency, formatDate } from "@/lib/utils";
import type { PaymentMethod } from "@/lib/store/types";

const STATUS_TONE: Record<string, "secondary" | "warning" | "success"> = {
  PENDING_BANK_DEPOSIT: "secondary",
  DEPOSITED: "warning",
  RECONCILED: "success",
};

const METHODS: PaymentMethod[] = ["CASH", "CHECK", "ZELLE", "PAYPAL", "OTHER"];

type DraftItem = { method: PaymentMethod; amount: number; description: string };

export default function DepositsPage() {
  const { state, addDeposit } = useStore();
  const [open, setOpen] = useState(false);
  const [accountId, setAccountId] = useState(state.accounts[0]?.id ?? "");
  const [items, setItems] = useState<DraftItem[]>([{ method: "CASH", amount: 0, description: "" }]);

  // Accounts load asynchronously — backfill the default once they arrive.
  useEffect(() => {
    setAccountId((id) => id || state.accounts[0]?.id || "");
  }, [state.accounts]);

  const accountName = (id: string) => state.accounts.find((a) => a.id === id)?.name ?? id;
  const draftTotal = items.reduce((s, it) => s + (it.amount || 0), 0);

  function submit() {
    const clean = items.filter((it) => it.amount > 0);
    if (clean.length === 0) return;
    const payload: NewDeposit = { accountId, items: clean };
    addDeposit(payload);
    setItems([{ method: "CASH", amount: 0, description: "" }]);
    setOpen(false);
  }

  return (
    <div>
      <PageHeader
        title="Cash Deposits"
        description="Collect cash, checks and Zelle into batches. They become income exactly once — when reconciled to the bank line."
        action={
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4" /> New deposit batch
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-xl">
              <DialogHeader>
                <DialogTitle>New deposit batch</DialogTitle>
              </DialogHeader>
              <Field label="Destination account">
                <NativeSelect value={accountId} onChange={(e) => setAccountId(e.target.value)}>
                  {state.accounts.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.name}
                    </option>
                  ))}
                </NativeSelect>
              </Field>

              <div className="space-y-2">
                <span className="text-sm font-medium">Contents</span>
                {items.map((it, i) => (
                  <div key={i} className="flex gap-2">
                    <NativeSelect
                      className="w-32"
                      value={it.method}
                      onChange={(e) =>
                        setItems((arr) => arr.map((x, j) => (j === i ? { ...x, method: e.target.value as PaymentMethod } : x)))
                      }
                    >
                      {METHODS.map((m) => (
                        <option key={m}>{m}</option>
                      ))}
                    </NativeSelect>
                    <Input
                      type="number"
                      placeholder="0.00"
                      value={it.amount || ""}
                      onChange={(e) =>
                        setItems((arr) => arr.map((x, j) => (j === i ? { ...x, amount: parseFloat(e.target.value) || 0 } : x)))
                      }
                    />
                    <Input
                      placeholder="Description"
                      value={it.description}
                      onChange={(e) =>
                        setItems((arr) => arr.map((x, j) => (j === i ? { ...x, description: e.target.value } : x)))
                      }
                    />
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => setItems((arr) => arr.filter((_, j) => j !== i))}
                      disabled={items.length === 1}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setItems((arr) => [...arr, { method: "CASH", amount: 0, description: "" }])}
                >
                  <Plus className="h-3.5 w-3.5" /> Add line
                </Button>
              </div>

              <div className="flex items-center justify-between border-t border-[var(--color-border)] pt-3 text-sm">
                <span className="text-[var(--color-muted-foreground)]">Expected total</span>
                <span className="text-lg font-semibold">{formatCurrency(draftTotal)}</span>
              </div>

              <DialogFooter>
                <DialogClose asChild>
                  <Button variant="ghost">Cancel</Button>
                </DialogClose>
                <Button onClick={submit} disabled={draftTotal <= 0}>
                  Create batch
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        }
      />

      <div className="grid gap-4 md:grid-cols-2">
        {state.deposits.map((d) => (
          <Card key={d.id} id={`dep-${d.id}`}>
            <CardContent className="p-5">
              <div className="flex items-start justify-between">
                <div>
                  <div className="font-semibold">Deposit #{d.code}</div>
                  <div className="text-xs text-[var(--color-muted-foreground)]">
                    {accountName(d.accountId)}
                    {d.depositedOn && ` · deposited ${formatDate(d.depositedOn)}`}
                  </div>
                </div>
                <Badge variant={STATUS_TONE[d.status]}>{d.status.replace(/_/g, " ").toLowerCase()}</Badge>
              </div>

              <div className="my-4 space-y-1.5 text-sm">
                {d.items.map((it, i) => (
                  <div key={i} className="flex justify-between">
                    <span className="text-[var(--color-muted-foreground)]">
                      {it.method} — {it.description || "—"}
                    </span>
                    <span className="font-medium">{formatCurrency(it.amount)}</span>
                  </div>
                ))}
              </div>

              <div className="flex items-center justify-between border-t border-[var(--color-border)] pt-3">
                <span className="text-sm text-[var(--color-muted-foreground)]">Expected total</span>
                <span className="text-lg font-semibold">{formatCurrency(d.expectedTotal)}</span>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

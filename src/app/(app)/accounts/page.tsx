"use client";

import { Landmark, Plus } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useStore } from "@/lib/store/provider";
import { accountBalance, totalBalance } from "@/lib/store/selectors";
import { formatCurrency } from "@/lib/utils";

export default function AccountsPage() {
  const { state } = useStore();
  const total = totalBalance(state);

  return (
    <div>
      <PageHeader
        title="Financial Accounts"
        description={`${state.accounts.length} accounts · ${formatCurrency(total)} combined balance — computed from the ledger.`}
        action={
          <Button>
            <Plus className="h-4 w-4" /> Add account
          </Button>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {state.accounts.map((a) => (
          <Card key={a.id}>
            <CardContent className="p-5">
              <div className="flex items-center justify-between">
                <div className="flex h-9 w-9 items-center justify-center rounded-[var(--radius)] bg-[var(--color-accent)] text-[var(--color-accent-foreground)]">
                  <Landmark className="h-4 w-4" />
                </div>
                <Badge variant="outline">{a.type.replace(/_/g, " ").toLowerCase()}</Badge>
              </div>
              <div className="mt-3 font-medium">{a.name}</div>
              <div className="text-xs text-[var(--color-muted-foreground)]">
                {a.institution} · ••{a.mask}
              </div>
              <div className="mt-3 text-2xl font-semibold">{formatCurrency(accountBalance(state, a.id))}</div>
              <div className="mt-1 text-xs text-[var(--color-muted-foreground)]">
                Opening {formatCurrency(a.openingBalance)}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

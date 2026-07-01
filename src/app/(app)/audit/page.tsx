"use client";

import { FileDown, FileUp, Link2, Pencil, PlusCircle, RefreshCw } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useStore } from "@/lib/store/provider";

const ICONS: Record<string, typeof PlusCircle> = {
  create: PlusCircle,
  update: Pencil,
  import: FileUp,
  reconcile: Link2,
  export: FileDown,
};

export default function AuditPage() {
  const { state, refresh } = useStore();

  return (
    <div>
      <PageHeader
        title="Audit Log"
        description="Every mutation in the app is recorded here — who, when, what. Nothing happens silently."
        action={
          <Button variant="outline" onClick={refresh}>
            <RefreshCw className="h-4 w-4" /> Refresh
          </Button>
        }
      />

      <Card>
        <CardContent className="p-0">
          <ol className="divide-y divide-[var(--color-border)]">
            {state.audit.map((a) => {
              const Icon = ICONS[a.action] ?? PlusCircle;
              return (
                <li key={a.id} className="flex items-start gap-3 p-4">
                  <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[var(--color-accent)] text-[var(--color-accent-foreground)]">
                    <Icon className="h-4 w-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-medium">{a.summary}</span>
                      <Badge variant="outline">{a.entityType}</Badge>
                    </div>
                    <div className="mt-0.5 text-xs text-[var(--color-muted-foreground)]">
                      {a.actor} · {new Date(a.at).toLocaleString()} · {a.action}
                    </div>
                  </div>
                </li>
              );
            })}
            {state.audit.length === 0 && (
              <li className="p-10 text-center text-sm text-[var(--color-muted-foreground)]">No activity yet.</li>
            )}
          </ol>
        </CardContent>
      </Card>
    </div>
  );
}

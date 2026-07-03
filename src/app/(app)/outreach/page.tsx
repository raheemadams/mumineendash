"use client";

import { useMemo, useState } from "react";
import { Send, AlertTriangle, CheckCircle2, Loader2, Mail } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/select-native";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useStore } from "@/lib/store/provider";
import { isDeliverableEmail, PAYMENT_URL, PAYMENT_BUTTON_LABEL } from "@/lib/config";
import { sendCampaignAction, type CampaignResult } from "@/lib/actions/campaigns";

const DEFAULT_SUBJECT = "Renew your Masjid Mumineen membership";
const DEFAULT_BODY = `Assalamu alaikum {{firstName}},

We noticed your Masjid Mumineen membership is currently inactive, and we'd love to welcome you back. You can renew your membership securely online using the button below.

JazakAllahu khairan,
Masjid Mumineen`;

const mergeName = (t: string, fullName: string, firstName: string) =>
  t.replace(/\{\{\s*name\s*\}\}/gi, fullName).replace(/\{\{\s*firstName\s*\}\}/gi, firstName);

export default function OutreachPage() {
  const { state } = useStore();
  const [status, setStatus] = useState("INACTIVE");
  const [subject, setSubject] = useState(DEFAULT_SUBJECT);
  const [body, setBody] = useState(DEFAULT_BODY);
  const [includePay, setIncludePay] = useState(true);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<CampaignResult | null>(null);

  const statusOptions = useMemo(() => {
    const map = new Map<string, number>();
    for (const m of state.members) map.set(m.status, (map.get(m.status) ?? 0) + 1);
    return [...map.entries()].sort((a, b) => b[1] - a[1]);
  }, [state.members]);

  const group = useMemo(
    () => state.members.filter((m) => (status === "all" ? true : m.status === status)),
    [state.members, status],
  );
  const deliverable = useMemo(() => group.filter((m) => isDeliverableEmail(m.email)), [group]);
  const skipped = group.length - deliverable.length;

  const sample = deliverable[0];
  const previewSubject = sample ? mergeName(subject, sample.fullName, sample.firstName) : subject;
  const previewBody = sample ? mergeName(body, sample.fullName, sample.firstName) : body;

  const canSend = subject.trim() && body.trim() && deliverable.length > 0 && !sending;

  async function send() {
    setConfirmOpen(false);
    setSending(true);
    setResult(null);
    try {
      const res = await sendCampaignAction({ status, subject, body, includePayButton: includePay });
      setResult(res);
    } catch (e) {
      setResult({
        recipients: deliverable.length,
        sent: 0,
        failed: deliverable.length,
        skipped,
        configured: true,
        error: e instanceof Error ? e.message : "Failed to send.",
      });
    } finally {
      setSending(false);
    }
  }

  return (
    <div>
      <PageHeader
        title="Outreach"
        description="Send an email to a group of members — e.g. remind inactive members to renew. Emails go individually (recipients don't see each other)."
      />

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Recipients</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <label className="block space-y-1.5">
                <span className="text-sm font-medium">Send to</span>
                <NativeSelect value={status} onChange={(e) => setStatus(e.target.value)}>
                  <option value="all">All members ({state.members.length})</option>
                  {statusOptions.map(([s, count]) => (
                    <option key={s} value={s}>
                      {s.charAt(0) + s.slice(1).toLowerCase().replace(/_/g, " ")} members ({count})
                    </option>
                  ))}
                </NativeSelect>
              </label>
              <div className="rounded-[var(--radius)] bg-[var(--color-muted)] px-3 py-2 text-sm">
                <span className="font-semibold text-[var(--color-foreground)]">{deliverable.length}</span> will
                receive this email.
                {skipped > 0 && (
                  <span className="text-[var(--color-muted-foreground)]">
                    {" "}
                    {skipped} skipped (no valid email).
                  </span>
                )}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Compose</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <label className="block space-y-1.5">
                <span className="text-sm font-medium">Subject</span>
                <Input value={subject} onChange={(e) => setSubject(e.target.value)} />
              </label>
              <label className="block space-y-1.5">
                <span className="text-sm font-medium">Message</span>
                <textarea
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  rows={12}
                  className="flex w-full rounded-[var(--radius)] border border-[var(--color-input)] bg-[var(--color-background)] px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-ring)]"
                />
              </label>
              <p className="text-xs text-[var(--color-muted-foreground)]">
                Tip: <code className="rounded bg-[var(--color-muted)] px-1">{"{{firstName}}"}</code> and{" "}
                <code className="rounded bg-[var(--color-muted)] px-1">{"{{name}}"}</code> are replaced with each
                member&apos;s name.
              </p>

              <label className="flex items-start gap-2 rounded-[var(--radius)] border border-[var(--color-border)] p-3">
                <input
                  type="checkbox"
                  checked={includePay}
                  onChange={(e) => setIncludePay(e.target.checked)}
                  className="mt-0.5 h-4 w-4 accent-[var(--color-primary)]"
                />
                <span className="text-sm">
                  <span className="font-medium">Include a &ldquo;{PAYMENT_BUTTON_LABEL}&rdquo; button</span>
                  <span className="block text-xs text-[var(--color-muted-foreground)]">
                    Links to your online donation page ({new URL(PAYMENT_URL).host}).
                  </span>
                </span>
              </label>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Preview</CardTitle>
            </CardHeader>
            <CardContent>
              {sample ? (
                <div className="rounded-[var(--radius)] border border-[var(--color-border)]">
                  <div className="border-b border-[var(--color-border)] px-4 py-2 text-xs text-[var(--color-muted-foreground)]">
                    To: {sample.fullName} &lt;{sample.email}&gt;
                  </div>
                  <div className="border-b border-[var(--color-border)] px-4 py-2 font-medium">{previewSubject}</div>
                  <div className="px-4 py-3 text-sm">
                    <div className="whitespace-pre-wrap">{previewBody}</div>
                    {includePay && (
                      <div className="mt-4 space-y-1.5">
                        <span className="inline-block rounded-lg bg-[var(--color-primary)] px-5 py-2.5 text-sm font-semibold text-[var(--color-primary-foreground)]">
                          {PAYMENT_BUTTON_LABEL}
                        </span>
                        <div className="text-xs text-[var(--color-muted-foreground)]">
                          Or open this link: <span className="text-[var(--color-primary)] underline">{PAYMENT_URL}</span>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <p className="py-8 text-center text-sm text-[var(--color-muted-foreground)]">
                  No deliverable recipients in this group.
                </p>
              )}
            </CardContent>
          </Card>

          {result && (
            <Card
              className={
                result.error
                  ? "border-[var(--color-danger)]/40 bg-[var(--color-danger)]/5"
                  : "border-[var(--color-success)]/40 bg-[var(--color-success)]/5"
              }
            >
              <CardContent className="flex items-start gap-3 py-4 text-sm">
                {result.error ? (
                  <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-[var(--color-danger)]" />
                ) : (
                  <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-[var(--color-success)]" />
                )}
                <div>
                  {!result.configured ? (
                    <span>
                      Email isn&apos;t set up yet. Add <code>RESEND_API_KEY</code> and <code>RESEND_FROM</code> to
                      the environment, then try again.
                    </span>
                  ) : result.error ? (
                    <span>
                      Sent {result.sent}, {result.failed} failed. {result.error}
                    </span>
                  ) : (
                    <span className="font-medium">
                      Sent to {result.sent} member{result.sent === 1 ? "" : "s"}
                      {result.skipped > 0 ? ` (${result.skipped} skipped — no valid email)` : ""}.
                    </span>
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          <div className="flex justify-end">
            <Button disabled={!canSend} onClick={() => setConfirmOpen(true)}>
              {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              {sending ? "Sending…" : `Send to ${deliverable.length}`}
            </Button>
          </div>
        </div>
      </div>

      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Mail className="h-4 w-4" /> Send this email?
            </DialogTitle>
          </DialogHeader>
          <p className="text-sm text-[var(--color-muted-foreground)]">
            This will email <span className="font-semibold text-[var(--color-foreground)]">{deliverable.length}</span>{" "}
            {status === "all" ? "" : status.toLowerCase()} member{deliverable.length === 1 ? "" : "s"}. This can&apos;t be
            undone.
          </p>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="ghost">Cancel</Button>
            </DialogClose>
            <Button onClick={send}>
              <Send className="h-4 w-4" /> Send now
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

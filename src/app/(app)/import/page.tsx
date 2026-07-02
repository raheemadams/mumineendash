"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { AlertTriangle, CheckCircle2, Copy, FileText, FileUp, Loader2, Sparkles } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { NativeSelect } from "@/components/ui/select-native";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  parseCsv,
  detectColumns,
  normalizeRows,
  detectDuplicates,
  type FieldMap,
  type AmountStyle,
  type LedgerTxn,
  type NormalizedTxn,
  type DuplicateVerdict,
} from "@/lib/engine";
import { useStore } from "@/lib/store/provider";
import { formatCurrency, formatDate } from "@/lib/utils";

type Step = "upload" | "map" | "review";

const SAMPLE_BOA = `Date,Description,Amount,Running Bal.
06/09/2026,BRANCH DEPOSIT FRIDAY COLLECTION,1700.00,84230.55
06/07/2026,ZELLE FROM AHMED ALI,150.00,82530.55
06/05/2026,CHECK 1041 RENT,-1200.00,82380.55
06/14/2026,ZELLE FROM MARIAM HASSAN SADAQAH,75.00,84305.55
06/14/2026,SQUARE EID BAZAAR PAYOUT,432.10,84737.65`;

const SAMPLE_DC = `Transaction Date,Memo,Debit,Credit,Reference No
2026-06-10,Building fund pledge,,2500.00,WR-3310
2026-06-11,Landscaping vendor,420.00,,INV-8841
2026-06-14,Friday donations,,980.00,`;

const FIELD_LABELS: { key: keyof FieldMap; label: string; hint: string }[] = [
  { key: "date", label: "Date", hint: "required" },
  { key: "description", label: "Description / Memo", hint: "" },
  { key: "amount", label: "Amount (signed)", hint: "single-column mode" },
  { key: "debit", label: "Debit / Withdrawal", hint: "debit-credit mode" },
  { key: "credit", label: "Credit / Deposit", hint: "debit-credit mode" },
  { key: "reference", label: "Reference No.", hint: "" },
];

export default function ImportPage() {
  const { state, commitImport } = useStore();
  const [step, setStep] = useState<Step>("upload");
  const [accountId, setAccountId] = useState(state.accounts[0]?.id ?? "");
  const [headers, setHeaders] = useState<string[]>([]);
  const [rows, setRows] = useState<Record<string, string>[]>([]);
  const [fieldMap, setFieldMap] = useState<FieldMap>({ date: "" });
  const [amountStyle, setAmountStyle] = useState<AmountStyle>("single");
  const [committed, setCommitted] = useState<{ inserted: number; blocked: number } | null>(null);
  // Snapshot the verdicts as they were at the moment of commit. Without this,
  // the live preview would re-evaluate the just-committed rows against the
  // now-updated ledger and flip every row to "Duplicate 100%", making a
  // successful import look like it was rejected.
  const [snapshot, setSnapshot] = useState<DuplicateVerdict[] | null>(null);
  const [pdfSource, setPdfSource] = useState<string | null>(null);

  // Accounts load asynchronously — backfill the default once they arrive.
  useEffect(() => {
    setAccountId((id) => id || state.accounts[0]?.id || "");
  }, [state.accounts]);
  const [pdfBusy, setPdfBusy] = useState(false);
  const [pdfError, setPdfError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  function ingestRows(parsedHeaders: string[], parsedRows: Record<string, string>[]) {
    if (!parsedHeaders.length) return;
    const det = detectColumns(parsedHeaders);
    setHeaders(parsedHeaders);
    setRows(parsedRows);
    setFieldMap(det.fieldMap);
    setAmountStyle(det.amountStyle);
    setCommitted(null);
    setStep("map");
  }

  function ingest(text: string) {
    setPdfSource(null);
    const parsed = parseCsv(text);
    ingestRows(parsed.headers, parsed.rows);
  }

  const SOURCE_LABELS: Record<string, string> = {
    boa: "Bank of America",
    bot: "Bank of Texas",
    paypal: "PayPal",
    cashapp: "Cash App",
  };

  // Keywords to match a detected statement source to one of the configured
  // accounts, so each upload auto-selects the right destination instead of
  // silently defaulting to the first account (which filed everything under
  // Bank of America).
  const SOURCE_ACCOUNT_KEYWORDS: Record<string, string[]> = {
    boa: ["bank of america", "bofa"],
    bot: ["bank of texas"],
    paypal: ["paypal"],
    cashapp: ["cash app", "cashapp"],
  };

  function matchAccountForSource(source: string): string | null {
    const keywords = SOURCE_ACCOUNT_KEYWORDS[source];
    if (!keywords) return null;
    const acct = state.accounts.find((a) => {
      const hay = `${a.name} ${a.institution}`.toLowerCase();
      return keywords.some((k) => hay.includes(k));
    });
    return acct?.id ?? null;
  }

  async function ingestPdf(file: File) {
    setPdfError(null);
    setPdfBusy(true);
    try {
      const { parsePdfStatement } = await import("@/lib/engine/pdf");
      const buffer = await file.arrayBuffer();
      const result = await parsePdfStatement(buffer);
      setPdfSource(SOURCE_LABELS[result.source] ?? result.source);
      const matched = matchAccountForSource(result.source);
      if (matched) setAccountId(matched);
      ingestRows(result.headers, result.rows);
    } catch (err) {
      setPdfError(err instanceof Error ? err.message : "Could not read this PDF.");
    } finally {
      setPdfBusy(false);
    }
  }

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf")) {
      await ingestPdf(file);
    } else {
      ingest(await file.text());
    }
    e.target.value = ""; // allow re-selecting the same file
  }

  // Existing ledger rows for the chosen account drive duplicate detection.
  const existing: LedgerTxn[] = useMemo(
    () =>
      state.ledger
        .filter((l) => l.accountId === accountId)
        .map((l) => ({
          id: l.id,
          accountId: l.accountId,
          date: new Date(l.date),
          amount: l.amount,
          direction: l.direction,
          description: l.description,
          referenceNumber: l.referenceNumber,
          dedupeHash: l.dedupeHash,
        })),
    [state.ledger, accountId],
  );

  const result = useMemo(() => {
    if (step !== "review") return null;
    const norm = normalizeRows(rows, { fieldMap, amountStyle, accountId });
    const verdicts = detectDuplicates(norm.rows, existing);
    return { norm, verdicts };
  }, [step, rows, fieldMap, amountStyle, accountId, existing]);

  const summary = useMemo(() => {
    if (!result) return null;
    const dup = result.verdicts.filter((v) => v.isDuplicate).length;
    const review = result.verdicts.filter((v) => !v.isDuplicate && v.score >= 0.75).length;
    const fresh = result.verdicts.length - dup - review;
    return { dup, review, fresh, errors: result.norm.errors.length };
  }, [result]);

  async function commit() {
    if (!result) return;
    // Freeze what we're about to commit so the post-commit view reflects this
    // batch's status, not a re-check against the ledger it just joined.
    setSnapshot(result.verdicts);
    const res = await commitImport(
      accountId,
      result.verdicts.map((v) => ({ txn: v.candidate, isDuplicate: v.isDuplicate })),
    );
    setCommitted(res);
  }

  function resetFlow() {
    setStep("upload");
    setHeaders([]);
    setRows([]);
    setFieldMap({ date: "" });
    setPdfSource(null);
    setCommitted(null);
    setSnapshot(null);
  }

  return (
    <div>
      <PageHeader
        title="Import Statements"
        description="Upload once, map once. Every row becomes a standardized ledger entry — the raw file is kept only as evidence."
      />

      <Steps step={step} />

      {step === "upload" && (
        <Card>
          <CardContent className="flex flex-col items-center gap-4 py-12 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-[var(--color-accent)] text-[var(--color-accent-foreground)]">
              {pdfBusy ? <Loader2 className="h-6 w-6 animate-spin" /> : <FileUp className="h-6 w-6" />}
            </div>
            <div>
              <p className="font-medium">{pdfBusy ? "Reading your PDF statement…" : "Drop a bank statement"}</p>
              <p className="text-sm text-[var(--color-muted-foreground)]">
                CSV, or a PDF from Bank of America, Bank of Texas, PayPal, or Cash App.
              </p>
            </div>
            <input
              ref={fileRef}
              type="file"
              accept=".csv,text/csv,.pdf,application/pdf"
              onChange={onFile}
              className="hidden"
            />
            <Button onClick={() => fileRef.current?.click()} disabled={pdfBusy}>
              <FileUp className="h-4 w-4" /> Choose file
            </Button>

            {pdfError && (
              <div className="flex items-start gap-2 rounded-[var(--radius)] border border-[var(--color-danger)]/40 bg-[var(--color-danger)]/10 p-3 text-left text-sm">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-[var(--color-danger)]" />
                <span>{pdfError}</span>
              </div>
            )}

            <div className="flex flex-wrap items-center justify-center gap-2 text-sm text-[var(--color-muted-foreground)]">
              <span>or try a sample:</span>
              <Button variant="outline" size="sm" onClick={() => ingest(SAMPLE_BOA)}>
                <Copy className="h-3.5 w-3.5" /> BoA CSV
              </Button>
              <Button variant="outline" size="sm" onClick={() => ingest(SAMPLE_DC)}>
                <Copy className="h-3.5 w-3.5" /> Debit/Credit CSV
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {step === "map" && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-[var(--color-primary)]" /> Field mapping
              <Badge variant="secondary">auto-detected</Badge>
              {pdfSource && (
                <Badge variant="outline" className="gap-1">
                  <FileText className="h-3 w-3" /> {pdfSource} PDF
                </Badge>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="grid gap-4 sm:grid-cols-2">
              <Labeled label="Destination account">
                <NativeSelect value={accountId} onChange={(e) => setAccountId(e.target.value)}>
                  {state.accounts.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.name}
                    </option>
                  ))}
                </NativeSelect>
              </Labeled>
              <Labeled label="Amount style">
                <NativeSelect value={amountStyle} onChange={(e) => setAmountStyle(e.target.value as AmountStyle)}>
                  <option value="single">Single signed column</option>
                  <option value="debit_credit">Separate debit / credit columns</option>
                </NativeSelect>
              </Labeled>
            </div>

            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {FIELD_LABELS.map(({ key, label, hint }) => (
                <Labeled key={key} label={label} hint={hint}>
                  <NativeSelect
                    value={fieldMap[key] ?? ""}
                    onChange={(e) => setFieldMap((m) => ({ ...m, [key]: e.target.value || undefined }))}
                  >
                    <option value="">— none —</option>
                    {headers.map((h) => (
                      <option key={h} value={h}>
                        {h}
                      </option>
                    ))}
                  </NativeSelect>
                </Labeled>
              ))}
            </div>

            <div>
              <p className="mb-2 text-sm font-medium text-[var(--color-muted-foreground)]">
                Preview of source rows ({rows.length})
              </p>
              <div className="rounded-[var(--radius)] border border-[var(--color-border)]">
                <Table>
                  <TableHeader>
                    <TableRow>
                      {headers.map((h) => (
                        <TableHead key={h}>{h}</TableHead>
                      ))}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rows.slice(0, 4).map((r, i) => (
                      <TableRow key={i}>
                        {headers.map((h) => (
                          <TableCell key={h} className="whitespace-nowrap text-[var(--color-muted-foreground)]">
                            {r[h]}
                          </TableCell>
                        ))}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>

            <div className="flex justify-between">
              <Button variant="ghost" onClick={() => setStep("upload")}>
                Back
              </Button>
              <Button onClick={() => setStep("review")} disabled={!fieldMap.date}>
                Normalize & preview →
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {step === "review" && result && summary && (
        <div className="space-y-4">
          {committed && (
            <Card className="border-[var(--color-success)]/40 bg-[var(--color-success)]/5">
              <CardContent className="flex flex-wrap items-center justify-between gap-3 py-4">
                <div className="flex items-center gap-3">
                  <CheckCircle2 className="h-5 w-5 shrink-0 text-[var(--color-success)]" />
                  <span className="text-sm font-medium">
                    Imported {committed.inserted}{" "}
                    {committed.inserted === 1 ? "entry" : "entries"} to the ledger.
                    {committed.blocked > 0 &&
                      ` ${committed.blocked} were already in the ledger and were skipped — cash is counted exactly once.`}
                  </span>
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" asChild>
                    <Link href="/transactions">View ledger</Link>
                  </Button>
                  <Button size="sm" onClick={resetFlow}>
                    Import another statement
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            {committed ? (
              <>
                <MiniStat label="Imported" value={committed.inserted} tone="success" />
                <MiniStat label="Skipped (already in ledger)" value={committed.blocked} tone="warning" />
                <MiniStat label="Parse errors" value={summary.errors} tone="warning" />
                <MiniStat label="Rows in file" value={result.verdicts.length} tone="success" />
              </>
            ) : (
              <>
                <MiniStat label="New entries" value={summary.fresh} tone="success" />
                <MiniStat label="Needs review" value={summary.review} tone="warning" />
                <MiniStat label="Duplicates blocked" value={summary.dup} tone="danger" />
                <MiniStat label="Parse errors" value={summary.errors} tone="warning" />
              </>
            )}
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Normalized ledger preview</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead className="text-right">Deposit</TableHead>
                    <TableHead className="text-right">Withdrawal</TableHead>
                    <TableHead>Reference</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(committed && snapshot ? snapshot : result.verdicts).map((v, i) => {
                    const t: NormalizedTxn = v.candidate;
                    return (
                      <TableRow key={i}>
                        <TableCell className="whitespace-nowrap">{formatDate(t.date)}</TableCell>
                        <TableCell className="max-w-[260px] truncate">{t.description}</TableCell>
                        <TableCell className="text-right text-[var(--color-success)]">
                          {t.deposit ? formatCurrency(t.deposit) : "—"}
                        </TableCell>
                        <TableCell className="text-right text-[var(--color-danger)]">
                          {t.withdrawal ? formatCurrency(t.withdrawal) : "—"}
                        </TableCell>
                        <TableCell className="text-[var(--color-muted-foreground)]">
                          {t.referenceNumber ?? "—"}
                        </TableCell>
                        <TableCell>
                          {committed ? (
                            v.isDuplicate ? (
                              <Badge variant="warning">Skipped</Badge>
                            ) : (
                              <Badge variant="success">Imported</Badge>
                            )
                          ) : v.isDuplicate ? (
                            <Badge variant="danger" title={v.reasons.join(", ")}>
                              Duplicate {Math.round(v.score * 100)}%
                            </Badge>
                          ) : v.score >= 0.75 ? (
                            <Badge variant="warning" title={v.reasons.join(", ")}>
                              Review {Math.round(v.score * 100)}%
                            </Badge>
                          ) : (
                            <Badge variant="success">New</Badge>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>

              {result.norm.errors.length > 0 && (
                <div className="mt-4 rounded-[var(--radius)] border border-[var(--color-warning)]/40 bg-[var(--color-warning)]/10 p-3 text-sm">
                  <div className="mb-1 flex items-center gap-2 font-medium">
                    <AlertTriangle className="h-4 w-4 text-[var(--color-warning)]" />
                    {result.norm.errors.length} row(s) skipped
                  </div>
                  <ul className="list-inside list-disc text-[var(--color-muted-foreground)]">
                    {result.norm.errors.slice(0, 3).map((e) => (
                      <li key={e.rawRowIndex}>
                        Row {e.rawRowIndex + 1}: {e.message}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </CardContent>
          </Card>

          {!committed && (
            <div className="flex justify-between">
              <Button variant="ghost" onClick={() => setStep("map")}>
                Back to mapping
              </Button>
              <Button onClick={commit} disabled={summary.fresh + summary.review === 0}>
                {summary.fresh + summary.review === 0
                  ? "Nothing new to import"
                  : `Commit ${summary.fresh + summary.review} entries to ledger`}
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function Steps({ step }: { step: Step }) {
  const steps: { key: Step; label: string }[] = [
    { key: "upload", label: "Upload" },
    { key: "map", label: "Map fields" },
    { key: "review", label: "Review & commit" },
  ];
  const idx = steps.findIndex((s) => s.key === step);
  return (
    <div className="mb-5 flex items-center gap-2 text-sm">
      {steps.map((s, i) => (
        <div key={s.key} className="flex items-center gap-2">
          <span
            className={`flex h-6 w-6 items-center justify-center rounded-full text-xs font-semibold ${
              i <= idx
                ? "bg-[var(--color-primary)] text-[var(--color-primary-foreground)]"
                : "bg-[var(--color-muted)] text-[var(--color-muted-foreground)]"
            }`}
          >
            {i + 1}
          </span>
          <span className={i === idx ? "font-medium" : "text-[var(--color-muted-foreground)]"}>
            {s.label}
          </span>
          {i < steps.length - 1 && <span className="mx-1 h-px w-8 bg-[var(--color-border)]" />}
        </div>
      ))}
    </div>
  );
}

function Labeled({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <label className="block space-y-1.5">
      <span className="text-sm font-medium">
        {label}
        {hint && <span className="ml-1.5 text-xs font-normal text-[var(--color-muted-foreground)]">{hint}</span>}
      </span>
      {children}
    </label>
  );
}

function MiniStat({ label, value, tone }: { label: string; value: number; tone: "success" | "warning" | "danger" }) {
  const color =
    tone === "success"
      ? "text-[var(--color-success)]"
      : tone === "warning"
        ? "text-[var(--color-warning)]"
        : "text-[var(--color-danger)]";
  return (
    <Card className="p-4">
      <div className={`text-2xl font-semibold ${color}`}>{value}</div>
      <div className="text-xs text-[var(--color-muted-foreground)]">{label}</div>
    </Card>
  );
}

# MosqueOS

The operating system for a mosque — members, dues, donations, accounting and
bank reconciliation in **one standardized source of truth**.

> **Core principle:** the database is the source of truth. Raw bank statements
> are stored only as evidence. Every imported row is normalized into the
> internal `Transaction` ledger, and cash is counted **exactly once**.

## Stack

| Layer        | Technology                                  |
| ------------ | ------------------------------------------- |
| Frontend     | Next.js 15 (App Router) · React 19 · TS     |
| Styling      | Tailwind CSS v4 · shadcn-style primitives   |
| Charts       | Recharts                                    |
| ORM / DB     | Prisma → PostgreSQL (Supabase)              |
| Auth/Storage | Supabase Auth (email + password, 5 office logins) |

## What's in this build

The app is backed by a real Supabase Postgres database and real
authentication — no more localStorage, no more manual role-switching. The
data flow:

```
useStore() (client component)
  └─▶ src/lib/store/provider.tsx     — same hook/action names as before
        └─▶ src/lib/actions/*.ts     — "use server" Server Actions
              └─▶ src/lib/db/*.ts    — Prisma queries + type mapping
                    └─▶ Supabase Postgres
```

The secret key never reaches the browser — every DB call happens inside a
Server Action.

### Auth: shared office logins, not per-person accounts

There are 5 logins — **President, Treasurer, Administrator, Imam,
Secretary** — one per *office*, not one per person. When someone rotates
out of a role, the office keeps the same login; just hand the password to
whoever takes over. Sign-in is email + password via Supabase Auth;
`middleware.ts` protects every route under `src/app/(app)/` and redirects
unauthenticated requests to `/login`. The signed-in office's role is
resolved server-side (`src/lib/db/auth.ts`) and drives which dashboard
renders — there's no client-side role picker anymore.

Provision or rotate the 5 accounts with:

```bash
npx tsx scripts/seed-office-accounts.ts            # create (idempotent)
FORCE_RESET=1 npx tsx scripts/seed-office-accounts.ts  # rotate all 5 passwords
```

Passwords print once to the terminal and are never saved by the script —
copy them somewhere safe immediately.

RLS is still off — access control currently happens at the application layer
(middleware + session checks in every Server Action), not at the database
layer. That's a known gap to close in a future pass.

- **A proven, framework-free engine** in [`src/lib/engine`](src/lib/engine)
  with **46 passing unit tests** (`npm test`): CSV parse → column detect →
  normalize → duplicate detection → deposit reconciliation, a **dues engine**
  that derives paid / past-due / grace status from a plan + payments, and a
  **PDF statement engine** (below) — all pure functions, no framework.
- **Fully working modules** (real logic, not mockups):
  - **Import** — upload a CSV *or a PDF statement* (Bank of America, Bank of
    Texas, PayPal, Cash App), columns auto-detect, map, preview normalized
    rows with New / Review / Duplicate flags, commit into the ledger.
  - **Dues** — live status per member, "record payment" posts to the ledger.
  - **Donations** — record a donation with fan-out attribution to a member,
    family, campaign, and event simultaneously; posts a matching ledger entry.
  - **Members** — add/edit, member detail page with donation & dues history,
    household linking, search.
  - **Cash Deposits** — build a batch from cash/checks/Zelle.
  - **Reconciliation** — the matcher suggests the bank line; reconciling links
    the batch so the cash is counted **once**.
  - **Ledger** — filter, totals, CSV export. **Reports** — income statement,
    expenses, monthly summary, all computed from the ledger.
  - **Audit Log** — a live feed of every action, backed by real `AuditLog` rows.
  - **Notifications** — derived live from state (past-due dues, deposits
    awaiting reconciliation, large donations, pending approvals).
  - **Role-aware dashboards** — Treasurer, President, Administrator, and Imam
    each get a purpose-built view, resolved from the signed-in office account
    (Secretary currently reuses the Administrator view).
  - **Pastoral notes** — private, Imam-only records tied to a member.
- **Full Prisma schema** for every module in
  [`prisma/schema.prisma`](prisma/schema.prisma), applied to a dedicated
  Supabase project and seeded with the same demo dataset the app used to ship
  with. Dark mode throughout.

### PDF statement import

Real bank/payment-app statements are PDFs, not CSVs, and each has a different
text layout. [`src/lib/engine/pdf`](src/lib/engine/pdf) extracts text
client-side with `pdfjs-dist`, detects which of the four supported formats it
is, and runs a dedicated per-source adapter that recovers `{date, description,
amount}` rows — which then flow through the *exact same* normalize/dedupe
pipeline CSV rows do. Text-based (digitally exported) PDFs only; scanned
paper statements would need OCR, which isn't built yet.

Supported today: **Bank of America**, **Bank of Texas**, **PayPal**, **Cash
App**. Each adapter was validated against real statement exports and
reconciles exactly against the totals those statements report.

## Getting started

```bash
npm install
cp .env.example .env   # fill in DATABASE_URL / DIRECT_URL (Supabase pooler URIs — see below)
npm run db:push         # create the schema on your Postgres instance
npm run db:seed         # roles, permissions, categories, accounts + demo dataset
npm run dev              # http://localhost:3000
npm test                 # run the engine unit tests
```

### Connecting to Supabase

Use the **pooler** connection strings, not the direct one — Supabase's direct
connection (`db.<ref>.supabase.co:5432`) is IPv6-only and won't connect from
networks without outbound IPv6. From the dashboard's "Connect" panel:

```
DATABASE_URL="postgresql://postgres.<ref>:<password>@aws-0-<region>.pooler.supabase.com:6543/postgres?pgbouncer=true"
DIRECT_URL="postgresql://postgres.<ref>:<password>@aws-0-<region>.pooler.supabase.com:5432/postgres"
```

The `/api/imports/commit` route and every `src/lib/actions/*.ts` Server Action
run server-side only — the secret key never reaches the browser.

## The engine

```
CSV ─┐
     ├─▶ parse ─▶ detectColumns ─▶ normalizeRows ─▶ detectDuplicates ─▶ Transaction ledger
PDF ─┘   (per-bank adapter)                              │
                              DepositBatch ─▶ findDepositMatches ─▶ reconcile (link, don't double-count)
```

Each stage is an independently tested pure function in `src/lib/engine`.

## Roadmap (next passes)

Row Level Security policies (defense-in-depth alongside the app-layer auth
gate) · a dedicated Secretary dashboard · reports/exports · communication
(email/SMS/WhatsApp) · OCR for scanned statements · Trigger.dev background
jobs · AI categorization & natural-language queries.

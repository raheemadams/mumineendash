// Bulk-imports members from a CSV export. Idempotent — keyed on the export's
// `ID` column (stored as memberCode), so re-running updates existing rows
// rather than duplicating them.
//
// Expected columns (a leading unnamed index column is tolerated):
//   ID, Name, Phone Number, Cell Number, Email Address, Address,
//   Native Country, Balance, Status
//
// Run: npx tsx scripts/import-members.ts "<path-to-csv>"
import { PrismaClient } from "@prisma/client";
import { readFileSync } from "fs";

const prisma = new PrismaClient();

function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [], field = "", q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) {
      if (c === '"' && text[i + 1] === '"') { field += '"'; i++; }
      else if (c === '"') q = false;
      else field += c;
    } else {
      if (c === '"') q = true;
      else if (c === ",") { row.push(field); field = ""; }
      else if (c === "\r") { /* skip */ }
      else if (c === "\n") { row.push(field); rows.push(row); row = []; field = ""; }
      else field += c;
    }
  }
  if (field.length || row.length) { row.push(field); rows.push(row); }
  return rows;
}

function splitName(full: string): { first: string; last: string } {
  const tokens = full.trim().split(/\s+/).filter(Boolean);
  if (tokens.length === 0) return { first: "Unknown", last: "—" };
  if (tokens.length === 1) return { first: tokens[0], last: "—" };
  return { first: tokens[0], last: tokens.slice(1).join(" ") };
}

function parseBalance(v: string): number | null {
  const s = (v || "").replace(/[$,\s]/g, "");
  if (!s) return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

function mapStatus(v: string): "ACTIVE" | "INACTIVE" | "PENDING" | "SUSPENDED" | "DECEASED" | "MOVED_AWAY" {
  const s = (v || "").trim().toLowerCase();
  if (s === "inactive") return "INACTIVE";
  if (s === "pending") return "PENDING";
  if (s === "suspended") return "SUSPENDED";
  if (s === "deceased") return "DECEASED";
  return "ACTIVE";
}

const clean = (v: string | undefined): string | null => {
  const s = (v ?? "").trim();
  return s.length ? s : null;
};

async function main() {
  const path = process.argv[2];
  if (!path) throw new Error('Usage: npx tsx scripts/import-members.ts "<path-to-csv>"');

  const raw = readFileSync(path, "utf8").replace(/^﻿/, "");
  const rows = parseCsv(raw).filter((r) => r.some((c) => c && c.trim()));
  const header = rows[0].map((h) => h.trim().toLowerCase());
  const idx = (name: string) => header.findIndex((h) => h === name);

  // Resolve columns by header name so the leading blank column doesn't matter.
  const cId = idx("id"), cName = idx("name"), cPhone = idx("phone number"),
    cCell = idx("cell number"), cEmail = idx("email address"), cAddr = idx("address"),
    cNative = idx("native country"), cBal = idx("balance"), cStatus = idx("status");

  if (cId < 0 || cName < 0) throw new Error("CSV must have ID and Name columns");

  const data = rows.slice(1);
  const before = await prisma.member.count();

  let processed = 0, skipped = 0;
  const chunkSize = 25;
  for (let i = 0; i < data.length; i += chunkSize) {
    const chunk = data.slice(i, i + chunkSize);
    await Promise.all(
      chunk.map(async (r) => {
        const memberCode = clean(r[cId]);
        const name = clean(r[cName]);
        if (!memberCode || !name) { skipped++; return; }
        const { first, last } = splitName(name);
        const fields = {
          firstName: first,
          lastName: last,
          fullName: name,
          email: clean(r[cEmail]),
          phone: clean(r[cPhone]),
          cellPhone: clean(r[cCell]),
          addressLine1: clean(r[cAddr]),
          nativeCountry: clean(r[cNative]),
          balance: parseBalance(r[cBal] ?? ""),
          membershipStatus: mapStatus(r[cStatus] ?? ""),
        };
        await prisma.member.upsert({
          where: { memberCode },
          update: fields,
          create: { memberCode, ...fields },
        });
        processed++;
      }),
    );
    process.stdout.write(`\rImported ${Math.min(i + chunkSize, data.length)}/${data.length}...`);
  }

  const after = await prisma.member.count();
  console.log(`\n\nDone. Processed ${processed}, skipped ${skipped}.`);
  console.log(`Members in DB: ${before} → ${after} (net new: ${after - before}).`);
}

main()
  .catch((e) => { console.error(e); process.exitCode = 1; })
  .finally(() => prisma.$disconnect());

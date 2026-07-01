"use server";

import { commitImportRows, type ImportRowVerdict } from "@/lib/db/import";
import { writeAudit } from "@/lib/db/audit";
import { requireUser } from "@/lib/db/auth";

export async function commitImportAction(accountId: string, rows: ImportRowVerdict[]) {
  const user = await requireUser();
  const result = await commitImportRows(accountId, rows);
  await writeAudit({
    action: "import",
    entityType: "ImportBatch",
    entityId: accountId,
    summary: `Imported ${result.inserted} entries (${result.blocked} duplicate(s) blocked)`,
    actorId: user.id,
  });
  return result;
}

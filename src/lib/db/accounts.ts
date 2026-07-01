import { prisma } from "@/lib/prisma";
import { num } from "./mappers";
import type { Account } from "@/lib/store/types";

export async function listAccounts(): Promise<Account[]> {
  const rows = await prisma.financialAccount.findMany({ orderBy: { name: "asc" } });
  return rows.map((a) => ({
    id: a.id,
    name: a.name,
    institution: a.institution ?? "",
    type: a.type,
    mask: a.accountMask ?? "",
    openingBalance: num(a.openingBalance),
  }));
}

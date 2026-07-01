import { prisma } from "@/lib/prisma";
import { isoDate, iso } from "./mappers";
import type { PastoralKind, PastoralNote } from "@/lib/store/types";
import type { Prisma } from "@prisma/client";

function toPastoralNote(row: Prisma.PastoralNoteGetPayload<object>): PastoralNote {
  return {
    id: row.id,
    memberId: row.memberId ?? "",
    authorId: row.authorId ?? "",
    kind: row.kind as PastoralKind,
    title: row.title,
    body: row.body ?? "",
    occurredOn: row.occurredOn ? isoDate(row.occurredOn) : "",
    isPrivate: row.isPrivate,
    createdAt: iso(row.createdAt)!,
  };
}

export async function listPastoralNotes(): Promise<PastoralNote[]> {
  const rows = await prisma.pastoralNote.findMany({ orderBy: { occurredOn: "desc" } });
  return rows.map(toPastoralNote);
}

export interface NewPastoralNoteInput {
  memberId: string;
  kind: string;
  title: string;
  body: string;
  occurredOn: string;
  isPrivate: boolean;
}

export async function createPastoralNote(
  data: NewPastoralNoteInput,
  authorId: string,
): Promise<{ memberFullName: string }> {
  const member = await prisma.member.findUnique({ where: { id: data.memberId } });

  await prisma.pastoralNote.create({
    data: {
      memberId: data.memberId,
      authorId,
      kind: data.kind,
      title: data.title,
      body: data.body,
      occurredOn: new Date(data.occurredOn),
      isPrivate: data.isPrivate,
    },
  });

  return { memberFullName: member?.fullName ?? data.memberId };
}

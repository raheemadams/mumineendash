import { prisma } from "@/lib/prisma";
import { isoDate } from "./mappers";
import type { Family, Member } from "@/lib/store/types";

type MemberWithFamily = Awaited<ReturnType<typeof prisma.member.findMany>>[number] & {
  family: { familyName: string } | null;
};

function toMember(row: MemberWithFamily): Member {
  return {
    id: row.id,
    memberCode: row.memberCode,
    firstName: row.firstName,
    lastName: row.lastName,
    fullName: row.fullName,
    email: row.email ?? "",
    phone: row.phone ?? "",
    status: row.membershipStatus,
    type: row.membershipType,
    joined: isoDate(row.dateJoined),
    familyId: row.familyId,
    family: row.family?.familyName ?? "",
    notes: row.notes ?? undefined,
  };
}

export async function listMembers(): Promise<Member[]> {
  const rows = await prisma.member.findMany({
    include: { family: true },
    orderBy: { dateJoined: "asc" },
  });
  return rows.map(toMember);
}

export async function listFamilies(): Promise<Family[]> {
  const rows = await prisma.family.findMany({ orderBy: { familyName: "asc" } });
  return rows.map((f) => ({ id: f.id, familyName: f.familyName }));
}

export interface CreateMemberInput {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  type: string;
  status: string;
  family: string;
}

export async function createMember(data: CreateMemberInput): Promise<Member> {
  const count = await prisma.member.count();
  const memberCode = `MUM-${String(count + 1).padStart(4, "0")}`;

  let familyId: string | null = null;
  if (data.family.trim()) {
    const family =
      (await prisma.family.findFirst({ where: { familyName: data.family.trim() } })) ??
      (await prisma.family.create({ data: { familyName: data.family.trim() } }));
    familyId = family.id;
  }

  const row = await prisma.member.create({
    data: {
      memberCode,
      firstName: data.firstName,
      lastName: data.lastName,
      fullName: `${data.firstName} ${data.lastName}`.trim(),
      email: data.email || null,
      phone: data.phone || null,
      membershipType: data.type as any,
      membershipStatus: data.status as any,
      familyId,
    },
    include: { family: true },
  });
  return toMember(row);
}

export interface UpdateMemberInput {
  firstName?: string;
  lastName?: string;
  email?: string;
  phone?: string;
  type?: string;
  status?: string;
  family?: string;
}

export async function updateMemberRecord(id: string, patch: UpdateMemberInput): Promise<void> {
  const current = await prisma.member.findUniqueOrThrow({ where: { id } });

  let familyId: string | null | undefined = undefined;
  if (patch.family !== undefined) {
    if (patch.family.trim()) {
      const family =
        (await prisma.family.findFirst({ where: { familyName: patch.family.trim() } })) ??
        (await prisma.family.create({ data: { familyName: patch.family.trim() } }));
      familyId = family.id;
    } else {
      familyId = null;
    }
  }

  const firstName = patch.firstName ?? current.firstName;
  const lastName = patch.lastName ?? current.lastName;

  await prisma.member.update({
    where: { id },
    data: {
      firstName,
      lastName,
      fullName: `${firstName} ${lastName}`.trim(),
      email: patch.email !== undefined ? patch.email || null : undefined,
      phone: patch.phone !== undefined ? patch.phone || null : undefined,
      membershipType: patch.type !== undefined ? (patch.type as any) : undefined,
      membershipStatus: patch.status !== undefined ? (patch.status as any) : undefined,
      familyId,
    },
  });
}

import { PrismaClient } from "@prisma/client";

// Singleton Prisma client. Used by API routes / server actions once
// DATABASE_URL points at a Postgres instance (local Docker or Supabase).
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;

// src/lib/prisma.ts
import { PrismaClient } from '@/generated/prisma';

// Use the recommended Prisma singleton pattern for Next.js
const globalForPrisma = globalThis as unknown as { prisma: PrismaClient }

export const prisma = globalForPrisma.prisma || new PrismaClient()

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma

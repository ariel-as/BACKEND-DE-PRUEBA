import { PrismaClient } from '@prisma/client';
export const prisma = globalThis.__planetaPrisma ?? new PrismaClient();
if (process.env.NODE_ENV !== 'production') globalThis.__planetaPrisma = prisma;

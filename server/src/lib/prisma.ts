import { PrismaClient as Client } from '@prisma/client';
import type { PrismaClient } from '@prisma/client';

/**
 * Singleton PrismaClient.
 * Prevents multiple instances during hot-reload in development.
 */

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient };

export const prisma =
    globalForPrisma.prisma ||
    new Client({
        log: process.env.NODE_ENV === 'development' ? ['query', 'warn', 'error'] : ['error'],
    });

if (process.env.NODE_ENV !== 'production') {
    globalForPrisma.prisma = prisma;
}

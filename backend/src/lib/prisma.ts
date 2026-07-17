import { PrismaClient } from '@prisma/client';

/**
 * Prisma client singleton.
 *
 * In development, tsx/ts-node reloads modules on file changes. Without this
 * singleton pattern, each reload would create a new PrismaClient and exhaust
 * the PostgreSQL connection pool quickly.
 *
 * In production, Node.js module caching ensures only one instance is created.
 */
declare global {
  // eslint-disable-next-line no-var
  var __prisma: PrismaClient | undefined;
}

export const prisma =
  global.__prisma ??
  new PrismaClient({
    log:
      process.env.NODE_ENV === 'development'
        ? ['query', 'warn', 'error']
        : ['error'],
  });

// Cache on global in non-production to survive hot reloads.
if (process.env.NODE_ENV !== 'production') {
  global.__prisma = prisma;
}

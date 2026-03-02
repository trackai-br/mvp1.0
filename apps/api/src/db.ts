import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';
import { Pool } from 'pg';

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

function createPrisma() {
  const connectionString = process.env.DATABASE_URL || '';

  // SSL condicional: desativado para localhost/127.0.0.1, ativado para Supabase/produção
  const isLocal = connectionString.includes('localhost') ||
                  connectionString.includes('127.0.0.1') ||
                  connectionString.includes('sslmode=disable');

  const poolConfig: Record<string, unknown> = { connectionString };
  if (!isLocal) {
    poolConfig.ssl = { rejectUnauthorized: false };
  }

  const pool = new Pool(poolConfig);
  const adapter = new PrismaPg(pool);
  return new PrismaClient({
    adapter,
    log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
  });
}

export const prisma = globalForPrisma.prisma ?? createPrisma();

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}

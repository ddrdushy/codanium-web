import { PrismaClient } from '@/generated/prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

// ---------------------------------------------------------------------------
// Connection Pool Configuration
// ---------------------------------------------------------------------------
// SaaS multi-tenant workload: limit connections to avoid exhausting the
// PostgreSQL max_connections budget across multiple serverless instances.
//
// Pool settings:
//   max:                 20   — max simultaneous connections per process
//   idleTimeoutMillis: 30000  — close idle connections after 30s
//   connectionTimeoutMillis: 10000 — fail fast if pool is exhausted (10s)
// ---------------------------------------------------------------------------

const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL!,
  max: parseInt(process.env.DATABASE_POOL_MAX ?? '20', 10),
  idleTimeoutMillis: parseInt(process.env.DATABASE_IDLE_TIMEOUT ?? '30000', 10),
  connectionTimeoutMillis: parseInt(process.env.DATABASE_POOL_TIMEOUT ?? '10000', 10),
});

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    adapter,
    log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
  });

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;

export default prisma;

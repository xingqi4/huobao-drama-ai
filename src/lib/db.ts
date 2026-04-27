import { PrismaClient } from '@prisma/client'

// ============================================================
// Database client initialization
// Handles Vercel PostgreSQL connection pooling and local PostgreSQL
// ============================================================

/**
 * Resolve the best DATABASE_URL from available environment variables.
 * Priority:
 *  1. POSTGRES_URL_NON_POOLING (best for Prisma schema migrations)
 *  2. POSTGRES_PRISMA_URL (pooled, Prisma-specific)
 *  3. DATABASE_URL (explicitly set)
 *  4. POSTGRES_URL (generic Vercel Postgres)
 *  5. Constructed from individual POSTGRES_* components
 */
function resolveDatabaseUrl(): string {
  // 1. Non-pooling URL — best for Prisma
  const nonPoolingUrl =
    process.env.POSTGRES_URL_NON_POOLING ||
    process.env.huobao_POSTGRES_URL_NON_POOLING

  if (nonPoolingUrl) {
    console.log('[db] Using non-pooling PostgreSQL URL for best Prisma compatibility')
    process.env.DATABASE_URL = nonPoolingUrl
    return nonPoolingUrl
  }

  // 2. Prisma-specific pooled URL
  const prismaUrl =
    process.env.POSTGRES_PRISMA_URL ||
    process.env.huobao_POSTGRES_PRISMA_URL

  if (prismaUrl) {
    console.log('[db] Using Prisma-specific pooled URL')
    process.env.DATABASE_URL = prismaUrl
    return prismaUrl
  }

  // 3. Explicitly set DATABASE_URL
  if (process.env.DATABASE_URL && process.env.DATABASE_URL.trim() !== '') {
    console.log('[db] Using DATABASE_URL from environment')
    return process.env.DATABASE_URL
  }

  // 4. Generic Vercel Postgres URL
  const genericUrl =
    process.env.POSTGRES_URL ||
    process.env.huobao_POSTGRES_URL

  if (genericUrl) {
    console.log('[db] Using generic Postgres URL from integration env vars')
    process.env.DATABASE_URL = genericUrl
    return genericUrl
  }

  // 5. Construct from individual components
  const host = process.env.huobao_POSTGRES_HOST || process.env.POSTGRES_HOST
  const user = process.env.huobao_POSTGRES_USER || process.env.POSTGRES_USER
  const password = process.env.huobao_POSTGRES_PASSWORD || process.env.POSTGRES_PASSWORD
  const database = process.env.huobao_POSTGRES_DATABASE || process.env.POSTGRES_DATABASE || 'postgres'

  if (host && user && password) {
    const constructedUrl = `postgresql://${user}:${password}@${host}:5432/${database}`
    console.log('[db] Constructed DATABASE_URL from individual components')
    process.env.DATABASE_URL = constructedUrl
    return constructedUrl
  }

  throw new Error(
    '[db] No DATABASE_URL found. Set DATABASE_URL or Vercel Postgres environment variables.'
  )
}

// Resolve DATABASE_URL before PrismaClient initialization
const databaseUrl = resolveDatabaseUrl()
if (!process.env.DATABASE_URL || process.env.DATABASE_URL.trim() === '') {
  process.env.DATABASE_URL = databaseUrl
}

// Set DIRECT_URL for Prisma (needed for PostgreSQL with connection pooling on Vercel)
if (!process.env.DIRECT_URL || process.env.DIRECT_URL.trim() === '') {
  const directUrl =
    process.env.POSTGRES_URL_NON_POOLING ||
    process.env.huobao_POSTGRES_URL_NON_POOLING ||
    process.env.DATABASE_URL
  if (directUrl) {
    process.env.DIRECT_URL = directUrl
  }
}

// PrismaClient singleton pattern
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

const maskedUrl = databaseUrl
  .replace(/\/\/[^:]+:[^@]+@/, '//***:***@')
  .replace(/\?[^#]+/, '?***')
console.log(`[db] Connecting to database: ${maskedUrl.slice(0, 100)}...`)

export const db =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
  })

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = db

// Test database connection on startup (non-blocking)
db.$connect()
  .then(() => console.log('[db] Database connection established successfully'))
  .catch((err) => console.error('[db] FAILED to connect to database:', err.message || err))

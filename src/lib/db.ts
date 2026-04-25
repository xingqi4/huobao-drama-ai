import { PrismaClient } from '@prisma/client'

// ============================================================
// Database client initialization
// Handles both local SQLite and Vercel PostgreSQL
// ============================================================

function resolveDatabaseUrl(): string {
  // 1. If DATABASE_URL is explicitly set and non-empty, use it
  if (process.env.DATABASE_URL && process.env.DATABASE_URL.trim() !== '') {
    console.log('[db] Using DATABASE_URL from environment')
    return process.env.DATABASE_URL
  }

  // 2. Check Vercel Postgres env vars (both standard and prefixed)
  // Priority: non-pooling URL for better Prisma compatibility,
  // then Prisma-specific URL, then generic Postgres URL
  const vercelPostgresUrl =
    process.env.POSTGRES_URL_NON_POOLING ||
    process.env.huobao_POSTGRES_URL_NON_POOLING ||
    process.env.POSTGRES_PRISMA_URL ||
    process.env.huobao_POSTGRES_PRISMA_URL ||
    process.env.POSTGRES_URL ||
    process.env.huobao_POSTGRES_URL

  if (vercelPostgresUrl) {
    console.log('[db] Using Vercel Postgres URL from integration env vars')
    // CRITICAL: Set DATABASE_URL in process.env so that Prisma's
    // schema.prisma `url = env("DATABASE_URL")` resolves correctly.
    process.env.DATABASE_URL = vercelPostgresUrl
    return vercelPostgresUrl
  }

  // 3. Try to construct from individual Supabase/Neon components
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

  // 4. Fallback for local development (SQLite)
  console.log('[db] No PostgreSQL URL found, falling back to SQLite')
  return 'file:./db/custom.db'
}

// Resolve and set DATABASE_URL before PrismaClient initialization
const databaseUrl = resolveDatabaseUrl()
if (!process.env.DATABASE_URL || process.env.DATABASE_URL.trim() === '') {
  process.env.DATABASE_URL = databaseUrl
}

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

// Log the database provider being used (mask the URL for security)
const maskedUrl = databaseUrl
  .replace(/\/\/[^:]+:[^@]+@/, '//***:***@')
  .replace(/\?[^#]+/, '?***')
console.log(`[db] Connecting to database: ${maskedUrl.slice(0, 80)}...`)

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

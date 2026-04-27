import { PrismaClient } from '@prisma/client'

// ============================================================
// Database client initialization
// Handles both local SQLite and Vercel PostgreSQL
// ============================================================

function resolveDatabaseUrl(): string {
  // 1. Check Vercel Postgres non-pooling URL FIRST (best for Prisma)
  const nonPoolingUrl =
    process.env.POSTGRES_URL_NON_POOLING ||
    process.env.huobao_POSTGRES_URL_NON_POOLING

  if (nonPoolingUrl) {
    console.log('[db] Using non-pooling PostgreSQL URL for best Prisma compatibility')
    process.env.DATABASE_URL = nonPoolingUrl
    return nonPoolingUrl
  }

  // 2. Check Prisma-specific pooled URLs (second best option)
  const prismaUrl =
    process.env.POSTGRES_PRISMA_URL ||
    process.env.huobao_POSTGRES_PRISMA_URL

  if (prismaUrl) {
    console.log('[db] Using Prisma-specific pooled URL')
    process.env.DATABASE_URL = prismaUrl
    return prismaUrl
  }

  // 3. If DATABASE_URL is explicitly set and non-empty, use it
  if (process.env.DATABASE_URL && process.env.DATABASE_URL.trim() !== '') {
    console.log('[db] Using DATABASE_URL from environment')
    return process.env.DATABASE_URL
  }

  // 4. Check generic Postgres URLs
  const genericUrl =
    process.env.POSTGRES_URL ||
    process.env.huobao_POSTGRES_URL

  if (genericUrl) {
    console.log('[db] Using generic Postgres URL from integration env vars')
    process.env.DATABASE_URL = genericUrl
    return genericUrl
  }

  // 5. Try to construct from individual components
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

  // 6. Fallback for local development (SQLite)
  console.log('[db] No PostgreSQL URL found, falling back to SQLite')
  return 'file:./db/custom.db'
}

// Resolve and set DATABASE_URL before PrismaClient initialization
const databaseUrl = resolveDatabaseUrl()
if (!process.env.DATABASE_URL || process.env.DATABASE_URL.trim() === '') {
  process.env.DATABASE_URL = databaseUrl
}

// Set DIRECT_URL for Prisma (needed for PostgreSQL with connection pooling)
if (!process.env.DIRECT_URL || process.env.DIRECT_URL.trim() === '') {
  const directUrl =
    process.env.POSTGRES_URL_NON_POOLING ||
    process.env.huobao_POSTGRES_URL_NON_POOLING ||
    process.env.DATABASE_URL
  if (directUrl) {
    process.env.DIRECT_URL = directUrl
  }
}

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

// Log the database provider being used (mask the URL for security)
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

// ============================================================
// SAFE auto-migration: ALWAYS runs on first call
// Uses CREATE TABLE IF NOT EXISTS - completely safe and idempotent
// This ensures all tables and columns exist, even if some were
// partially created by a previous broken migration.
// ============================================================
let migrationPromise: Promise<void> | null = null

export async function ensureDatabaseReady(): Promise<void> {
  if (migrationPromise) return migrationPromise

  migrationPromise = (async () => {
    // ALWAYS run safe migration on first call
    // This is cheap (mostly no-ops with IF NOT EXISTS) and ensures
    // all tables/columns/constraints exist even after partial failures
    console.log('[db] Running safe auto-migration (CREATE IF NOT EXISTS)...')
    try {
      await runSafeMigration()
      console.log('[db] Safe auto-migration completed successfully')
    } catch (migrateError) {
      console.error('[db] Safe auto-migration failed:', migrateError instanceof Error ? migrateError.message : String(migrateError))
      // Reset the promise so it can be retried on next request
      migrationPromise = null
    }
  })()

  return migrationPromise
}

/**
 * Detect if the current database is PostgreSQL
 */
function isPostgres(): boolean {
  const url = process.env.DATABASE_URL || ''
  return url.startsWith('postgresql://') || url.startsWith('postgres://')
}

/**
 * SAFE migration: Only creates tables if they don't exist.
 * NEVER drops tables. This is safe for production auto-migration.
 * Supports both SQLite (local dev) and PostgreSQL (Vercel production).
 */
async function runSafeMigration(): Promise<void> {
  const pg = isPostgres()

  // Helper to run SQL with appropriate timestamp type
  const tsType = pg ? 'TIMESTAMP(3)' : 'DATETIME'

  // Drama table
  await db.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "Drama" (
      "id" TEXT NOT NULL,
      "title" TEXT NOT NULL,
      "description" TEXT NOT NULL DEFAULT '',
      "genre" TEXT NOT NULL DEFAULT '都市',
      "style" TEXT NOT NULL DEFAULT 'realistic',
      "coverImage" TEXT,
      "totalEpisodes" INTEGER NOT NULL DEFAULT 0,
      "status" TEXT NOT NULL DEFAULT 'draft',
      "createdAt" ${tsType} NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" ${tsType} NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "Drama_pkey" PRIMARY KEY ("id")
    )
  `)

  // Episode table
  await db.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "Episode" (
      "id" TEXT NOT NULL,
      "dramaId" TEXT NOT NULL,
      "episodeNumber" INTEGER NOT NULL,
      "title" TEXT NOT NULL DEFAULT '',
      "rawContent" TEXT,
      "scriptContent" TEXT,
      "scriptStatus" TEXT NOT NULL DEFAULT 'pending',
      "extractStatus" TEXT NOT NULL DEFAULT 'pending',
      "storyboardStatus" TEXT NOT NULL DEFAULT 'pending',
      "status" TEXT NOT NULL DEFAULT 'draft',
      "videoUrl" TEXT,
      "duration" INTEGER NOT NULL DEFAULT 0,
      "createdAt" ${tsType} NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" ${tsType} NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "Episode_pkey" PRIMARY KEY ("id")
    )
  `)

  // Character table
  await db.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "Character" (
      "id" TEXT NOT NULL,
      "dramaId" TEXT NOT NULL,
      "name" TEXT NOT NULL,
      "role" TEXT NOT NULL DEFAULT 'supporting',
      "gender" TEXT NOT NULL DEFAULT 'unknown',
      "age" TEXT NOT NULL DEFAULT '',
      "appearance" TEXT NOT NULL DEFAULT '',
      "personality" TEXT NOT NULL DEFAULT '',
      "voiceStyle" TEXT NOT NULL DEFAULT '',
      "voiceId" TEXT,
      "imageUrl" TEXT,
      "createdAt" ${tsType} NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" ${tsType} NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "Character_pkey" PRIMARY KEY ("id")
    )
  `)

  // Scene table
  await db.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "Scene" (
      "id" TEXT NOT NULL,
      "dramaId" TEXT NOT NULL,
      "location" TEXT NOT NULL,
      "timeOfDay" TEXT NOT NULL DEFAULT 'day',
      "description" TEXT NOT NULL DEFAULT '',
      "prompt" TEXT NOT NULL DEFAULT '',
      "imageUrl" TEXT,
      "createdAt" ${tsType} NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" ${tsType} NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "Scene_pkey" PRIMARY KEY ("id")
    )
  `)

  // Storyboard table
  await db.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "Storyboard" (
      "id" TEXT NOT NULL,
      "episodeId" TEXT NOT NULL,
      "shotNumber" INTEGER NOT NULL,
      "title" TEXT NOT NULL DEFAULT '',
      "shotType" TEXT NOT NULL DEFAULT 'medium',
      "cameraAngle" TEXT NOT NULL DEFAULT 'eye-level',
      "cameraMovement" TEXT NOT NULL DEFAULT 'static',
      "action" TEXT NOT NULL DEFAULT '',
      "dialogue" TEXT,
      "dialogueChar" TEXT,
      "duration" ${pg ? 'DOUBLE PRECISION' : 'REAL'} NOT NULL DEFAULT 3.0,
      "imagePrompt" TEXT,
      "videoPrompt" TEXT,
      "atmosphere" TEXT,
      "firstFrameUrl" TEXT,
      "videoUrl" TEXT,
      "ttsAudioUrl" TEXT,
      "composedUrl" TEXT,
      "status" TEXT NOT NULL DEFAULT 'pending',
      "createdAt" ${tsType} NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" ${tsType} NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "Storyboard_pkey" PRIMARY KEY ("id")
    )
  `)

  // AiProvider table
  await db.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "AiProvider" (
      "id" TEXT NOT NULL,
      "category" TEXT NOT NULL,
      "provider" TEXT NOT NULL,
      "name" TEXT NOT NULL,
      "apiKey" TEXT NOT NULL DEFAULT '',
      "baseUrl" TEXT NOT NULL DEFAULT '',
      "model" TEXT NOT NULL DEFAULT '',
      "isActive" BOOLEAN NOT NULL DEFAULT false,
      "sort" INTEGER NOT NULL DEFAULT 0,
      "createdAt" ${tsType} NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" ${tsType} NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "AiProvider_pkey" PRIMARY KEY ("id")
    )
  `)

  // AgentConfig table
  await db.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "AgentConfig" (
      "id" TEXT NOT NULL,
      "agentType" TEXT NOT NULL,
      "systemPrompt" TEXT,
      "model" TEXT,
      "temperature" REAL NOT NULL DEFAULT 0.7,
      "maxTokens" INTEGER NOT NULL DEFAULT 4096,
      "isActive" BOOLEAN NOT NULL DEFAULT true,
      "createdAt" ${tsType} NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" ${tsType} NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "AgentConfig_pkey" PRIMARY KEY ("id")
    )
  `)

  // Create unique indexes (safe - IF NOT EXISTS)
  await db.$executeRawUnsafe(`
    CREATE UNIQUE INDEX IF NOT EXISTS "Episode_dramaId_episodeNumber_key" ON "Episode"("dramaId", "episodeNumber")
  `)
  await db.$executeRawUnsafe(`
    CREATE UNIQUE INDEX IF NOT EXISTS "AiProvider_category_provider_key" ON "AiProvider"("category", "provider")
  `)
  await db.$executeRawUnsafe(`
    CREATE UNIQUE INDEX IF NOT EXISTS "AgentConfig_agentType_key" ON "AgentConfig"("agentType")
  `)

  // Add foreign key constraints — only on PostgreSQL (SQLite handles via Prisma)
  if (pg) {
    await db.$executeRawUnsafe(`
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Episode_dramaId_fkey') THEN
          ALTER TABLE "Episode" ADD CONSTRAINT "Episode_dramaId_fkey" FOREIGN KEY ("dramaId") REFERENCES "Drama"("id") ON DELETE CASCADE ON UPDATE CASCADE;
        END IF;
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Character_dramaId_fkey') THEN
          ALTER TABLE "Character" ADD CONSTRAINT "Character_dramaId_fkey" FOREIGN KEY ("dramaId") REFERENCES "Drama"("id") ON DELETE CASCADE ON UPDATE CASCADE;
        END IF;
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Scene_dramaId_fkey') THEN
          ALTER TABLE "Scene" ADD CONSTRAINT "Scene_dramaId_fkey" FOREIGN KEY ("dramaId") REFERENCES "Drama"("id") ON DELETE CASCADE ON UPDATE CASCADE;
        END IF;
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Storyboard_episodeId_fkey') THEN
          ALTER TABLE "Storyboard" ADD CONSTRAINT "Storyboard_episodeId_fkey" FOREIGN KEY ("episodeId") REFERENCES "Episode"("id") ON DELETE CASCADE ON UPDATE CASCADE;
        END IF;
      END $$
    `)
  }

  // Add any missing columns (for tables that might exist but be incomplete)
  await addColumnIfNotExists('Character', 'dramaId', 'TEXT NOT NULL DEFAULT \'\'')
  await addColumnIfNotExists('Scene', 'dramaId', 'TEXT NOT NULL DEFAULT \'\'')
  await addColumnIfNotExists('Storyboard', 'episodeId', 'TEXT NOT NULL DEFAULT \'\'')
  await addColumnIfNotExists('Episode', 'dramaId', 'TEXT NOT NULL DEFAULT \'\'')
}

/**
 * Helper: Add a column to a table if it doesn't already exist
 */
async function addColumnIfNotExists(table: string, column: string, definition: string): Promise<void> {
  try {
    await db.$executeRawUnsafe(`
      ALTER TABLE "${table}" ADD COLUMN IF NOT EXISTS "${column}" ${definition}
    `)
  } catch {
    // Column might already exist or table might not exist - safe to ignore
  }
}

// Test database connection on startup (non-blocking)
// Auto-migration runs on first API request via ensureDatabaseReady()
db.$connect()
  .then(() => console.log('[db] Database connection established successfully'))
  .catch((err) => console.error('[db] FAILED to connect to database:', err.message || err))

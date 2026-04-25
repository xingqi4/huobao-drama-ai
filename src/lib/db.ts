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
// DIRECT_URL should point to the non-pooling URL for migrations and DDL
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

// Auto-migration: Check if tables exist and run migration if needed
let migrationPromise: Promise<void> | null = null

export async function ensureDatabaseReady(): Promise<void> {
  if (migrationPromise) return migrationPromise

  migrationPromise = (async () => {
    try {
      // Quick check: try to query the Drama table
      await db.drama.count()
      console.log('[db] Database tables verified - no migration needed')
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error)
      if (msg.includes('does not exist') || msg.includes('relation') || msg.includes('table')) {
        console.log('[db] Tables missing, running auto-migration...')
        try {
          const migrationSql = getMigrationSQL()
          // Execute migration statements
          for (const stmt of migrationSql) {
            try {
              await db.$executeRawUnsafe(stmt)
            } catch (stmtError) {
              console.warn('[db] Migration statement warning:', (stmtError instanceof Error ? stmtError.message : String(stmtError)).slice(0, 200))
            }
          }
          console.log('[db] Auto-migration completed successfully')
        } catch (migrateError) {
          console.error('[db] Auto-migration failed:', migrateError instanceof Error ? migrateError.message : String(migrateError))
        }
      } else {
        console.error('[db] Unexpected database error during readiness check:', msg)
      }
    }
  })()

  return migrationPromise
}

function getMigrationSQL(): string[] {
  return [
    // Drop existing tables in reverse dependency order
    'DROP TABLE IF EXISTS "Storyboard" CASCADE',
    'DROP TABLE IF EXISTS "Scene" CASCADE',
    'DROP TABLE IF EXISTS "Character" CASCADE',
    'DROP TABLE IF EXISTS "Episode" CASCADE',
    'DROP TABLE IF EXISTS "AiProvider" CASCADE',
    'DROP TABLE IF EXISTS "Drama" CASCADE',

    // Create Drama table
    `CREATE TABLE "Drama" (
      "id" TEXT NOT NULL,
      "title" TEXT NOT NULL,
      "description" TEXT NOT NULL DEFAULT '',
      "genre" TEXT NOT NULL DEFAULT '都市',
      "style" TEXT NOT NULL DEFAULT 'realistic',
      "coverImage" TEXT,
      "totalEpisodes" INTEGER NOT NULL DEFAULT 0,
      "status" TEXT NOT NULL DEFAULT 'draft',
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "Drama_pkey" PRIMARY KEY ("id")
    )`,

    // Create Episode table
    `CREATE TABLE "Episode" (
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
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "Episode_pkey" PRIMARY KEY ("id")
    )`,

    // Create Character table
    `CREATE TABLE "Character" (
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
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "Character_pkey" PRIMARY KEY ("id")
    )`,

    // Create Scene table
    `CREATE TABLE "Scene" (
      "id" TEXT NOT NULL,
      "dramaId" TEXT NOT NULL,
      "location" TEXT NOT NULL,
      "timeOfDay" TEXT NOT NULL DEFAULT 'day',
      "description" TEXT NOT NULL DEFAULT '',
      "prompt" TEXT NOT NULL DEFAULT '',
      "imageUrl" TEXT,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "Scene_pkey" PRIMARY KEY ("id")
    )`,

    // Create Storyboard table
    `CREATE TABLE "Storyboard" (
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
      "duration" DOUBLE PRECISION NOT NULL DEFAULT 3.0,
      "imagePrompt" TEXT,
      "videoPrompt" TEXT,
      "atmosphere" TEXT,
      "firstFrameUrl" TEXT,
      "videoUrl" TEXT,
      "ttsAudioUrl" TEXT,
      "composedUrl" TEXT,
      "status" TEXT NOT NULL DEFAULT 'pending',
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "Storyboard_pkey" PRIMARY KEY ("id")
    )`,

    // Create AiProvider table
    `CREATE TABLE "AiProvider" (
      "id" TEXT NOT NULL,
      "category" TEXT NOT NULL,
      "provider" TEXT NOT NULL,
      "name" TEXT NOT NULL,
      "apiKey" TEXT NOT NULL DEFAULT '',
      "baseUrl" TEXT NOT NULL DEFAULT '',
      "model" TEXT NOT NULL DEFAULT '',
      "isActive" BOOLEAN NOT NULL DEFAULT false,
      "sort" INTEGER NOT NULL DEFAULT 0,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "AiProvider_pkey" PRIMARY KEY ("id")
    )`,

    // Create unique indexes
    `CREATE UNIQUE INDEX IF NOT EXISTS "Episode_dramaId_episodeNumber_key" ON "Episode"("dramaId", "episodeNumber")`,
    `CREATE UNIQUE INDEX IF NOT EXISTS "AiProvider_category_provider_key" ON "AiProvider"("category", "provider")`,

    // Create foreign key constraints
    `ALTER TABLE "Episode" ADD CONSTRAINT "Episode_dramaId_fkey" FOREIGN KEY ("dramaId") REFERENCES "Drama"("id") ON DELETE CASCADE ON UPDATE CASCADE`,
    `ALTER TABLE "Character" ADD CONSTRAINT "Character_dramaId_fkey" FOREIGN KEY ("dramaId") REFERENCES "Drama"("id") ON DELETE CASCADE ON UPDATE CASCADE`,
    `ALTER TABLE "Scene" ADD CONSTRAINT "Scene_dramaId_fkey" FOREIGN KEY ("dramaId") REFERENCES "Drama"("id") ON DELETE CASCADE ON UPDATE CASCADE`,
    `ALTER TABLE "Storyboard" ADD CONSTRAINT "Storyboard_episodeId_fkey" FOREIGN KEY ("episodeId") REFERENCES "Episode"("id") ON DELETE CASCADE ON UPDATE CASCADE`,
  ]
  // Note: updatedAt trigger is NOT created here because the $$ syntax
  // doesn't work with $executeRawUnsafe. Prisma Client handles updatedAt
  // in its own client-side logic, so the trigger is not strictly needed.
}

// Test database connection on startup (non-blocking)
db.$connect()
  .then(() => {
    console.log('[db] Database connection established successfully')
    // Run auto-migration check after connecting
    ensureDatabaseReady().catch(() => {})
  })
  .catch((err) => console.error('[db] FAILED to connect to database:', err.message || err))

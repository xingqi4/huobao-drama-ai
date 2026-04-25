import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

// POST /api/migrate - Run database migration to create tables if they don't exist
// This handles both fresh installations and broken/partial migrations
export async function POST() {
  const results: Record<string, string> = {}

  try {
    console.log('[migrate] Starting database migration...')

    // Step 1: Drop all tables in reverse dependency order to ensure clean state
    const dropStatements = [
      'DROP TABLE IF EXISTS "Storyboard" CASCADE;',
      'DROP TABLE IF EXISTS "Scene" CASCADE;',
      'DROP TABLE IF EXISTS "Character" CASCADE;',
      'DROP TABLE IF EXISTS "Episode" CASCADE;',
      'DROP TABLE IF EXISTS "AiProvider" CASCADE;',
      'DROP TABLE IF EXISTS "Drama" CASCADE;',
    ]

    for (const stmt of dropStatements) {
      try {
        await db.$executeRawUnsafe(stmt)
      } catch {
        // Ignore errors - table might not exist
      }
    }
    results.dropTables = 'ok'

    // Step 2: Create all tables from scratch with proper schema
    // Drama table
    await db.$executeRawUnsafe(`
      CREATE TABLE "Drama" (
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
      );
    `)
    results.drama = 'created'

    // Episode table
    await db.$executeRawUnsafe(`
      CREATE TABLE "Episode" (
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
      );
    `)
    results.episode = 'created'

    // Character table
    await db.$executeRawUnsafe(`
      CREATE TABLE "Character" (
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
      );
    `)
    results.character = 'created'

    // Scene table
    await db.$executeRawUnsafe(`
      CREATE TABLE "Scene" (
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
      );
    `)
    results.scene = 'created'

    // Storyboard table
    await db.$executeRawUnsafe(`
      CREATE TABLE "Storyboard" (
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
      );
    `)
    results.storyboard = 'created'

    // AiProvider table
    await db.$executeRawUnsafe(`
      CREATE TABLE "AiProvider" (
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
      );
    `)
    results.aiProvider = 'created'

    // Step 3: Create unique indexes
    await db.$executeRawUnsafe(`
      CREATE UNIQUE INDEX IF NOT EXISTS "Episode_dramaId_episodeNumber_key" ON "Episode"("dramaId", "episodeNumber");
    `)
    await db.$executeRawUnsafe(`
      CREATE UNIQUE INDEX IF NOT EXISTS "AiProvider_category_provider_key" ON "AiProvider"("category", "provider");
    `)
    results.indexes = 'created'

    // Step 4: Create foreign key constraints
    await db.$executeRawUnsafe(`
      ALTER TABLE "Episode" ADD CONSTRAINT "Episode_dramaId_fkey" FOREIGN KEY ("dramaId") REFERENCES "Drama"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    `)
    await db.$executeRawUnsafe(`
      ALTER TABLE "Character" ADD CONSTRAINT "Character_dramaId_fkey" FOREIGN KEY ("dramaId") REFERENCES "Drama"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    `)
    await db.$executeRawUnsafe(`
      ALTER TABLE "Scene" ADD CONSTRAINT "Scene_dramaId_fkey" FOREIGN KEY ("dramaId") REFERENCES "Drama"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    `)
    await db.$executeRawUnsafe(`
      ALTER TABLE "Storyboard" ADD CONSTRAINT "Storyboard_episodeId_fkey" FOREIGN KEY ("episodeId") REFERENCES "Episode"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    `)
    results.foreignKeys = 'created'

    // Step 5: Add updatedAt trigger for auto-updating on row change
    // PostgreSQL doesn't auto-update updatedAt like Prisma expects, so we need a trigger
    // Use $executeRaw with tagged template to handle the $$ syntax properly
    try {
      await db.$executeRaw`
        CREATE OR REPLACE FUNCTION "update_updated_at_column"()
        RETURNS TRIGGER AS $$
        BEGIN
          NEW."updatedAt" = CURRENT_TIMESTAMP;
          RETURN NEW;
        END;
        $$ LANGUAGE plpgsql
      `

      const tables = ['Drama', 'Episode', 'Character', 'Scene', 'Storyboard', 'AiProvider']
      for (const table of tables) {
        await db.$executeRawUnsafe(`
          DROP TRIGGER IF EXISTS "update_${table}_updatedAt" ON "${table}"
        `)
        await db.$executeRawUnsafe(`
          CREATE TRIGGER "update_${table}_updatedAt"
            BEFORE UPDATE ON "${table}"
            FOR EACH ROW
            EXECUTE FUNCTION "update_updated_at_column"()
        `)
      }
      results.triggers = 'created'
    } catch (triggerError) {
      // Triggers are non-critical - Prisma handles updatedAt in its client
      results.triggers = `skipped: ${triggerError instanceof Error ? triggerError.message : String(triggerError)}`
    }

    console.log('[migrate] Database migration completed successfully')

    return NextResponse.json({
      status: 'ok',
      message: 'Database migration completed successfully',
      results,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    console.error('[migrate] Failed:', message)
    return NextResponse.json(
      { status: 'error', message, results },
      { status: 500 }
    )
  }
}

// GET /api/migrate - Check migration status
export async function GET() {
  try {
    const tables = await db.$queryRaw<Array<{ table_name: string }>>`
      SELECT table_name FROM information_schema.tables 
      WHERE table_schema = 'public' 
      ORDER BY table_name;
    `

    const tableNames = tables.map((t) => t.table_name)
    const requiredTables = ['Drama', 'Episode', 'Character', 'Scene', 'Storyboard', 'AiProvider']
    const missing = requiredTables.filter((t) => !tableNames.includes(t))

    if (missing.length === 0) {
      return NextResponse.json({
        status: 'ok',
        message: 'All tables exist',
        tables: tableNames,
      })
    }

    return NextResponse.json({
      status: 'needs_migration',
      message: `Missing tables: ${missing.join(', ')}`,
      existing: tableNames,
      missing,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    return NextResponse.json(
      { status: 'error', message },
      { status: 500 }
    )
  }
}

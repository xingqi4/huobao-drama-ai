import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

// POST /api/migrate - Run database migration to create tables if they don't exist
// This is a safety net in case the build-time schema push fails
export async function POST() {
  const results: Record<string, string> = {}

  try {
    // Check if tables exist by trying a simple query
    try {
      await db.drama.count()
      results.drama = 'already_exists'
    } catch {
      // Table doesn't exist, need to create it
      results.drama = 'missing'
    }

    // If drama table exists, all tables likely exist
    if (results.drama === 'already_exists') {
      return NextResponse.json({
        status: 'ok',
        message: 'All tables already exist',
        results,
      })
    }

    // Create tables using raw SQL
    console.log('[migrate] Creating database tables...')

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
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "Drama_pkey" PRIMARY KEY ("id")
      );
    `)
    results.drama = 'created'

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
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "Episode_pkey" PRIMARY KEY ("id")
      );
    `)
    results.episode = 'created'

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
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "Character_pkey" PRIMARY KEY ("id")
      );
    `)
    results.character = 'created'

    await db.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "Scene" (
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
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "AiProvider_pkey" PRIMARY KEY ("id")
      );
    `)
    results.aiProvider = 'created'

    // Create indexes
    try {
      await db.$executeRawUnsafe(`
        CREATE UNIQUE INDEX IF NOT EXISTS "Episode_dramaId_episodeNumber_key" ON "Episode"("dramaId", "episodeNumber");
      `)
      await db.$executeRawUnsafe(`
        CREATE UNIQUE INDEX IF NOT EXISTS "AiProvider_category_provider_key" ON "AiProvider"("category", "provider");
      `)
      results.indexes = 'created'
    } catch (indexError) {
      results.indexes = `warning: ${indexError instanceof Error ? indexError.message : String(indexError)}`
    }

    // Create foreign keys
    try {
      await db.$executeRawUnsafe(`ALTER TABLE "Episode" DROP CONSTRAINT IF EXISTS "Episode_dramaId_fkey";`)
      await db.$executeRawUnsafe(`ALTER TABLE "Episode" ADD CONSTRAINT "Episode_dramaId_fkey" FOREIGN KEY ("dramaId") REFERENCES "Drama"("id") ON DELETE CASCADE ON UPDATE CASCADE;`)
      await db.$executeRawUnsafe(`ALTER TABLE "Character" DROP CONSTRAINT IF EXISTS "Character_dramaId_fkey";`)
      await db.$executeRawUnsafe(`ALTER TABLE "Character" ADD CONSTRAINT "Character_dramaId_fkey" FOREIGN KEY ("dramaId") REFERENCES "Drama"("id") ON DELETE CASCADE ON UPDATE CASCADE;`)
      await db.$executeRawUnsafe(`ALTER TABLE "Scene" DROP CONSTRAINT IF EXISTS "Scene_dramaId_fkey";`)
      await db.$executeRawUnsafe(`ALTER TABLE "Scene" ADD CONSTRAINT "Scene_dramaId_fkey" FOREIGN KEY ("dramaId") REFERENCES "Drama"("id") ON DELETE CASCADE ON UPDATE CASCADE;`)
      await db.$executeRawUnsafe(`ALTER TABLE "Storyboard" DROP CONSTRAINT IF EXISTS "Storyboard_episodeId_fkey";`)
      await db.$executeRawUnsafe(`ALTER TABLE "Storyboard" ADD CONSTRAINT "Storyboard_episodeId_fkey" FOREIGN KEY ("episodeId") REFERENCES "Episode"("id") ON DELETE CASCADE ON UPDATE CASCADE;`)
      results.foreignKeys = 'created'
    } catch (fkError) {
      results.foreignKeys = `warning: ${fkError instanceof Error ? fkError.message : String(fkError)}`
    }

    console.log('[migrate] Database tables created successfully')

    return NextResponse.json({
      status: 'ok',
      message: 'Database tables created successfully',
      results,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    console.error('[migrate] Failed to create tables:', message)
    return NextResponse.json(
      { status: 'error', message, results },
      { status: 500 }
    )
  }
}

// ============================================================
// Build script: prepares the correct Prisma schema before Next.js build
// This runs as part of the "build" npm script on Vercel.
// ============================================================

const fs = require('fs')
const path = require('path')
const { execSync } = require('child_process')

const schemaPath = path.join(__dirname, '..', 'prisma', 'schema.prisma')
const productionSchemaPath = path.join(__dirname, '..', 'prisma', 'schema.production.prisma')
const developmentSchemaPath = path.join(__dirname, '..', 'prisma', 'schema.development.prisma')

// Check if we have PostgreSQL env vars (Vercel Postgres)
function getPostgresUrl() {
  return (
    process.env.DATABASE_URL ||
    process.env.POSTGRES_PRISMA_URL ||
    process.env.huobao_POSTGRES_PRISMA_URL ||
    process.env.POSTGRES_URL_NON_POOLING ||
    process.env.huobao_POSTGRES_URL_NON_POOLING ||
    process.env.POSTGRES_URL ||
    process.env.huobao_POSTGRES_URL ||
    null
  )
}

// Get the best URL for prisma db push (needs non-pooling for DDL)
function getPushUrl() {
  return (
    process.env.POSTGRES_URL_NON_POOLING ||
    process.env.huobao_POSTGRES_URL_NON_POOLING ||
    process.env.DATABASE_URL ||
    process.env.POSTGRES_PRISMA_URL ||
    process.env.huobao_POSTGRES_PRISMA_URL ||
    process.env.POSTGRES_URL ||
    process.env.huobao_POSTGRES_URL ||
    null
  )
}

const hasPostgres = !!getPostgresUrl()

if (hasPostgres) {
  console.log('[build] PostgreSQL detected, using production schema...')

  // Set DATABASE_URL from Vercel Postgres env vars
  // Priority: non-pooling URL first (better for Prisma), then pooling URL
  const pgUrl =
    process.env.POSTGRES_URL_NON_POOLING ||
    process.env.huobao_POSTGRES_URL_NON_POOLING ||
    getPostgresUrl()

  if (!process.env.DATABASE_URL || process.env.DATABASE_URL.trim() === '') {
    process.env.DATABASE_URL = pgUrl
  }
  console.log('[build] Set DATABASE_URL from Vercel Postgres')

  // Backup the development schema if it doesn't exist
  if (!fs.existsSync(developmentSchemaPath) && fs.existsSync(schemaPath)) {
    const currentSchema = fs.readFileSync(schemaPath, 'utf8')
    if (currentSchema.includes('sqlite')) {
      fs.writeFileSync(developmentSchemaPath, currentSchema)
      console.log('[build] Backed up SQLite schema to schema.development.prisma')
    }
  }

  // Copy production schema (PostgreSQL) over the default schema
  if (fs.existsSync(productionSchemaPath)) {
    fs.copyFileSync(productionSchemaPath, schemaPath)
    console.log('[build] Copied PostgreSQL schema to schema.prisma')
  }

  // Generate Prisma client with the correct schema
  try {
    console.log('[build] Generating Prisma client...')
    execSync('npx prisma generate', {
      stdio: 'inherit',
      env: { ...process.env, DATABASE_URL: process.env.DATABASE_URL || pgUrl },
      timeout: 60000
    })
    console.log('[build] Prisma client generated successfully')
  } catch (error) {
    console.warn('[build] Prisma generate warning:', error.message)
  }

  // Try to push schema to PostgreSQL - with timeout
  // Use non-pooling URL for DDL operations
  const pushUrl = getPushUrl()
  const pushEnv = { ...process.env, DATABASE_URL: pushUrl || pgUrl }

  try {
    console.log('[build] Pushing schema to PostgreSQL (60s timeout)...')
    execSync('npx prisma db push --accept-data-loss --skip-generate', {
      stdio: 'inherit',
      env: pushEnv,
      timeout: 60000
    })
    console.log('[build] Schema pushed to PostgreSQL successfully')
  } catch (error) {
    console.warn('[build] Prisma db push failed, trying with --force-reset...')
    // Try with force-reset to ensure tables are created
    try {
      console.log('[build] Force-resetting and pushing schema to PostgreSQL (60s timeout)...')
      execSync('npx prisma db push --force-reset --accept-data-loss --skip-generate', {
        stdio: 'inherit',
        env: pushEnv,
        timeout: 60000
      })
      console.log('[build] Schema force-pushed to PostgreSQL successfully')
    } catch (error2) {
      console.warn('[build] Prisma db push also failed with --force-reset:', error2.message?.slice(0, 300))
      // Last resort: try creating tables directly with SQL
      try {
        console.log('[build] Attempting to create tables via SQL...')
        const createTablesSQL = `
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
          CREATE UNIQUE INDEX IF NOT EXISTS "Episode_dramaId_episodeNumber_key" ON "Episode"("dramaId", "episodeNumber");
          CREATE UNIQUE INDEX IF NOT EXISTS "AiProvider_category_provider_key" ON "AiProvider"("category", "provider");
          ALTER TABLE "Episode" DROP CONSTRAINT IF EXISTS "Episode_dramaId_fkey";
          ALTER TABLE "Episode" ADD CONSTRAINT "Episode_dramaId_fkey" FOREIGN KEY ("dramaId") REFERENCES "Drama"("id") ON DELETE CASCADE ON UPDATE CASCADE;
          ALTER TABLE "Character" DROP CONSTRAINT IF EXISTS "Character_dramaId_fkey";
          ALTER TABLE "Character" ADD CONSTRAINT "Character_dramaId_fkey" FOREIGN KEY ("dramaId") REFERENCES "Drama"("id") ON DELETE CASCADE ON UPDATE CASCADE;
          ALTER TABLE "Scene" DROP CONSTRAINT IF EXISTS "Scene_dramaId_fkey";
          ALTER TABLE "Scene" ADD CONSTRAINT "Scene_dramaId_fkey" FOREIGN KEY ("dramaId") REFERENCES "Drama"("id") ON DELETE CASCADE ON UPDATE CASCADE;
          ALTER TABLE "Storyboard" DROP CONSTRAINT IF EXISTS "Storyboard_episodeId_fkey";
          ALTER TABLE "Storyboard" ADD CONSTRAINT "Storyboard_episodeId_fkey" FOREIGN KEY ("episodeId") REFERENCES "Episode"("id") ON DELETE CASCADE ON UPDATE CASCADE;
        `
        // Use Prisma's SQL execution via db execute
        execSync(`npx prisma db execute --stdin`, {
          input: createTablesSQL,
          env: pushEnv,
          timeout: 30000
        })
        console.log('[build] Tables created via SQL successfully')
      } catch (sqlError) {
        console.warn('[build] SQL table creation also failed:', sqlError.message?.slice(0, 300))
      }
    }
  }
} else {
  console.log('[build] No PostgreSQL detected, using default SQLite schema')

  // Restore development schema if we previously backed it up
  if (fs.existsSync(developmentSchemaPath)) {
    const currentSchema = fs.readFileSync(schemaPath, 'utf8')
    if (!currentSchema.includes('sqlite')) {
      fs.copyFileSync(developmentSchemaPath, schemaPath)
      console.log('[build] Restored SQLite schema from schema.development.prisma')
    }
  }

  // Generate Prisma client for SQLite
  try {
    execSync('npx prisma generate', {
      stdio: 'inherit',
      env: { ...process.env },
      timeout: 60000
    })
  } catch (error) {
    console.warn('[build] Prisma generate warning:', error.message)
  }
}

console.log('[build] Prisma setup complete, starting Next.js build...')

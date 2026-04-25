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
    console.log('[build] Pushing schema to PostgreSQL (30s timeout)...')
    execSync('npx prisma db push --accept-data-loss --skip-generate', {
      stdio: 'inherit',
      env: pushEnv,
      timeout: 30000
    })
    console.log('[build] Schema pushed to PostgreSQL successfully')
  } catch (error) {
    console.warn('[build] Prisma db push warning (schema may already exist):', error.message?.slice(0, 200))
    // Don't fail the build - the schema might already be pushed
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

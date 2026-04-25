// ============================================================
// Postinstall script: detects if we're on Vercel with PostgreSQL
// and sets up the correct Prisma schema accordingly.
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
    process.env.POSTGRES_URL_NON_POOLING ||
    process.env.huobao_POSTGRES_URL_NON_POOLING ||
    process.env.POSTGRES_PRISMA_URL ||
    process.env.huobao_POSTGRES_PRISMA_URL ||
    process.env.POSTGRES_URL ||
    process.env.huobao_POSTGRES_URL ||
    null
  )
}

const hasPostgres = !!getPostgresUrl()

if (hasPostgres) {
  console.log('[postinstall] PostgreSQL detected, using production schema...')

  // Set DATABASE_URL from Vercel Postgres env vars
  // Priority: non-pooling URL first
  const pgUrl =
    process.env.POSTGRES_URL_NON_POOLING ||
    process.env.huobao_POSTGRES_URL_NON_POOLING ||
    process.env.DATABASE_URL ||
    process.env.POSTGRES_PRISMA_URL ||
    process.env.huobao_POSTGRES_PRISMA_URL ||
    process.env.POSTGRES_URL ||
    process.env.huobao_POSTGRES_URL

  if (!process.env.DATABASE_URL || process.env.DATABASE_URL.trim() === '') {
    process.env.DATABASE_URL = pgUrl
  }
  console.log('[postinstall] Set DATABASE_URL from Vercel Postgres')

  // Backup the development schema if it doesn't exist
  if (!fs.existsSync(developmentSchemaPath) && fs.existsSync(schemaPath)) {
    const currentSchema = fs.readFileSync(schemaPath, 'utf8')
    if (currentSchema.includes('sqlite')) {
      fs.writeFileSync(developmentSchemaPath, currentSchema)
      console.log('[postinstall] Backed up SQLite schema to schema.development.prisma')
    }
  }

  // Copy production schema (PostgreSQL) over the default schema
  if (fs.existsSync(productionSchemaPath)) {
    fs.copyFileSync(productionSchemaPath, schemaPath)
    console.log('[postinstall] Copied PostgreSQL schema to schema.prisma')
  }
}

// Generate Prisma client - with timeout to prevent hanging
try {
  console.log('[postinstall] Generating Prisma client...')
  execSync('npx prisma generate', {
    stdio: 'inherit',
    env: { ...process.env },
    timeout: 60000  // 60 second timeout
  })
  console.log('[postinstall] Prisma client generated successfully')
} catch (error) {
  console.warn('[postinstall] Prisma generate warning:', error.message)
  // Don't fail - the build.js script will also try
}

// NOTE: We do NOT run prisma db push in postinstall because it can hang
// the entire build. Schema push should be done separately or will be
// attempted in build.js with a timeout.

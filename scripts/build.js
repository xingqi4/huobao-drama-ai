// ============================================================
// Build script: ensures PostgreSQL schema + generates client + pushes
// Restores schema from SQLite (local dev) back to PostgreSQL (Vercel)
// ============================================================

const fs = require('fs')
const path = require('path')
const { execSync } = require('child_process')

const schemaPath = path.join(__dirname, '..', 'prisma', 'schema.prisma')
const markerPath = path.join(__dirname, '..', 'prisma', '.sqlite-mode')

// Step 1: Restore schema to PostgreSQL if it was switched to SQLite by pre-dev.js
function ensurePostgresqlSchema() {
  let schema = fs.readFileSync(schemaPath, 'utf8')

  if (schema.includes('provider = "sqlite"')) {
    console.log('[build] Restoring Prisma schema from SQLite → PostgreSQL...')

    schema = schema.replace(
      /datasource db \{[\s\S]*?\}/,
      `datasource db {
  provider          = "postgresql"
  url               = env("DATABASE_URL")
  directUrl         = env("DIRECT_URL")
  relationMode      = "prisma"
}`
    )

    fs.writeFileSync(schemaPath, schema)

    // Remove marker
    if (fs.existsSync(markerPath)) {
      fs.unlinkSync(markerPath)
    }

    console.log('[build] Schema restored to PostgreSQL')
  } else {
    console.log('[build] Schema already using PostgreSQL')
  }
}

ensurePostgresqlSchema()

// Step 2: Resolve PostgreSQL URL (with huobao_ prefix priority)
const huobaoNonPooling = process.env.huobao_POSTGRES_URL_NON_POOLING
const huobaoPrisma = process.env.huobao_POSTGRES_PRISMA_URL
const huobaoGeneric = process.env.huobao_POSTGRES_URL
const nonPoolingUrl = process.env.POSTGRES_URL_NON_POOLING
const prismaUrl = process.env.POSTGRES_PRISMA_URL
const genericUrl = process.env.POSTGRES_URL

// DATABASE_URL: runtime (pooled connection)
// DIRECT_URL: migrations (direct connection)
const runtimeUrl = huobaoPrisma || prismaUrl || process.env.DATABASE_URL
const migrationUrl = huobaoNonPooling || nonPoolingUrl || process.env.DIRECT_URL || runtimeUrl

if (runtimeUrl) {
  process.env.DATABASE_URL = runtimeUrl
  process.env.DIRECT_URL = migrationUrl
  console.log('[build] DATABASE_URL configured for PostgreSQL')
}

// Step 3: Generate Prisma client
try {
  console.log('[build] Generating Prisma client...')
  execSync('npx prisma generate', {
    stdio: 'inherit',
    env: { ...process.env, DATABASE_URL: runtimeUrl, DIRECT_URL: migrationUrl },
    timeout: 120000
  })
  console.log('[build] Prisma client generated successfully')
} catch (error) {
  console.warn('[build] Prisma generate warning:', error.message?.slice(0, 300))
}

// Step 4: Push schema to database (additive only - won't drop existing data)
if (migrationUrl) {
  try {
    console.log('[build] Pushing schema to PostgreSQL (30s timeout)...')
    execSync('npx prisma db push --skip-generate', {
      stdio: 'pipe',
      env: { ...process.env, DATABASE_URL: migrationUrl, DIRECT_URL: migrationUrl },
      timeout: 30000
    })
    console.log('[build] Schema pushed to PostgreSQL successfully')
  } catch (error) {
    console.warn('[build] Prisma db push failed (non-critical, run /api/migrate manually)')
  }
}

console.log('[build] Prisma setup complete, starting Next.js build...')

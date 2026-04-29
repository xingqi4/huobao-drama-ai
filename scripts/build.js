// ============================================================
// Build script: generates Prisma client and pushes schema
// Both local and Vercel use PostgreSQL (Supabase)
// ============================================================

const { execSync } = require('child_process')

// Resolve the best PostgreSQL URL for Prisma (with huobao_ prefix priority)
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

// Generate Prisma client
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

// Push schema to database
if (migrationUrl) {
  try {
    console.log('[build] Pushing schema to PostgreSQL (30s timeout)...')
    execSync('npx prisma db push --accept-data-loss --skip-generate', {
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

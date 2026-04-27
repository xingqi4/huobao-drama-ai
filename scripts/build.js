// ============================================================
// Build script: prepares Prisma schema and generates client
// This runs as part of the "build" npm script on Vercel.
// ============================================================

const { execSync } = require('child_process')

// Resolve the best PostgreSQL URL for Prisma
const nonPoolingUrl =
  process.env.POSTGRES_URL_NON_POOLING ||
  process.env.huobao_POSTGRES_URL_NON_POOLING

const prismaUrl =
  process.env.POSTGRES_PRISMA_URL ||
  process.env.huobao_POSTGRES_PRISMA_URL

const genericUrl =
  process.env.POSTGRES_URL ||
  process.env.huobao_POSTGRES_URL

// DATABASE_URL: used by Prisma Client at runtime (pooled connection for serverless)
// DIRECT_URL: used by Prisma for migrations (direct connection)
const databaseUrl = prismaUrl || genericUrl || nonPoolingUrl || process.env.DATABASE_URL
const directUrl = nonPoolingUrl || genericUrl || process.env.DIRECT_URL || process.env.DATABASE_URL

if (databaseUrl) {
  process.env.DATABASE_URL = databaseUrl
  process.env.DIRECT_URL = directUrl
  console.log('[build] DATABASE_URL set for Prisma')
}

// Generate Prisma client
try {
  console.log('[build] Generating Prisma client...')
  execSync('npx prisma generate', {
    stdio: 'inherit',
    env: { ...process.env, DATABASE_URL: databaseUrl, DIRECT_URL: directUrl },
    timeout: 120000
  })
  console.log('[build] Prisma client generated successfully')
} catch (error) {
  console.warn('[build] Prisma generate warning:', error.message?.slice(0, 300))
}

// Try to push schema to PostgreSQL using direct URL
try {
  console.log('[build] Attempting prisma db push (30s timeout)...')
  execSync('npx prisma db push --accept-data-loss --skip-generate', {
    stdio: 'pipe',
    env: { ...process.env, DATABASE_URL: directUrl, DIRECT_URL: directUrl },
    timeout: 30000
  })
  console.log('[build] Schema pushed to PostgreSQL successfully')
} catch (error) {
  console.warn('[build] Prisma db push failed (non-critical, run /api/migrate manually)')
}

console.log('[build] Prisma setup complete, starting Next.js build...')

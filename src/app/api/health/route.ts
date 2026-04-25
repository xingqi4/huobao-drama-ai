import { NextResponse } from 'next/server'

// GET /api/health - Diagnostic endpoint to check database connectivity
export async function GET() {
  const diagnostics: Record<string, unknown> = {
    timestamp: new Date().toISOString(),
    nodeEnv: process.env.NODE_ENV,
  }

  // Check DATABASE_URL resolution
  const dbUrl = process.env.DATABASE_URL
  diagnostics.databaseUrlSet = !!dbUrl
  diagnostics.databaseUrlProvider = dbUrl
    ? dbUrl.startsWith('file:') ? 'sqlite' : dbUrl.startsWith('postgres') ? 'postgresql' : 'unknown'
    : 'NOT SET'

  // Mask the URL for security
  if (dbUrl) {
    diagnostics.databaseUrlMasked = dbUrl
      .replace(/\/\/[^:]+:[^@]+@/, '//***:***@')
      .replace(/\?[^#]+/, '?***')
      .slice(0, 100)
  }

  // Check available Vercel Postgres env vars
  diagnostics.vercelPostgresVars = {
    POSTGRES_URL: !!process.env.POSTGRES_URL,
    POSTGRES_PRISMA_URL: !!process.env.POSTGRES_PRISMA_URL,
    POSTGRES_URL_NON_POOLING: !!process.env.POSTGRES_URL_NON_POOLING,
    huobao_POSTGRES_URL: !!process.env.huobao_POSTGRES_URL,
    huobao_POSTGRES_PRISMA_URL: !!process.env.huobao_POSTGRES_PRISMA_URL,
    huobao_POSTGRES_URL_NON_POOLING: !!process.env.huobao_POSTGRES_URL_NON_POOLING,
    huobao_POSTGRES_HOST: !!process.env.huobao_POSTGRES_HOST,
    huobao_POSTGRES_USER: !!process.env.huobao_POSTGRES_USER,
    huobao_POSTGRES_PASSWORD: !!process.env.huobao_POSTGRES_PASSWORD,
    huobao_POSTGRES_DATABASE: !!process.env.huobao_POSTGRES_DATABASE,
  }

  // Check AI provider env vars
  diagnostics.aiProviderVars = {
    NVIDIA_API_KEY: !!process.env.NVIDIA_API_KEY,
    OPENAI_API_KEY: !!process.env.OPENAI_API_KEY,
    SILICONFLOW_API_KEY: !!process.env.SILICONFLOW_API_KEY,
    DEEPSEEK_API_KEY: !!process.env.DEEPSEEK_API_KEY,
    STABILITY_API_KEY: !!process.env.STABILITY_API_KEY,
    VOLCENGINE_API_KEY: !!process.env.VOLCENGINE_API_KEY,
    FISH_AUDIO_API_KEY: !!process.env.FISH_AUDIO_API_KEY,
  }

  // Test actual database connection
  try {
    const { db } = await import('@/lib/db')
    await db.$queryRaw`SELECT 1`
    diagnostics.databaseConnection = 'OK'
  } catch (error) {
    diagnostics.databaseConnection = 'FAILED'
    diagnostics.databaseError = error instanceof Error ? error.message : String(error)
  }

  // Test Drama model
  try {
    const { db } = await import('@/lib/db')
    const count = await db.drama.count()
    diagnostics.dramaCount = count
    diagnostics.dramaModel = 'OK'
  } catch (error) {
    diagnostics.dramaModel = 'FAILED'
    diagnostics.dramaModelError = error instanceof Error ? error.message : String(error)
  }

  // Test AiProvider model
  try {
    const { db } = await import('@/lib/db')
    const count = await db.aiProvider.count()
    diagnostics.aiProviderCount = count
    diagnostics.aiProviderModel = 'OK'
  } catch (error) {
    diagnostics.aiProviderModel = 'FAILED'
    diagnostics.aiProviderModelError = error instanceof Error ? error.message : String(error)
  }

  const isHealthy = diagnostics.databaseConnection === 'OK'

  return NextResponse.json(diagnostics, {
    status: isHealthy ? 200 : 503,
  })
}

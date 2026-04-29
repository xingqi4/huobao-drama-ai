import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

// POST /api/migrate - Push Prisma schema to database
// Uses `prisma db push` which works for both SQLite and PostgreSQL
export async function POST(request: NextRequest) {
  try {
    // Check current database provider
    const dbUrl = process.env.DATABASE_URL || ''
    const isPostgres = dbUrl.startsWith('postgresql://') || dbUrl.startsWith('postgres://')
    const provider = isPostgres ? 'PostgreSQL' : 'SQLite'

    console.log(`[migrate] Running prisma db push for ${provider}...`)

    // For PostgreSQL on Vercel, ensure DIRECT_URL is set for migrations
    if (isPostgres) {
      const directUrl =
        process.env.huobao_POSTGRES_URL_NON_POOLING ||
        process.env.POSTGRES_URL_NON_POOLING ||
        process.env.DIRECT_URL ||
        dbUrl
      process.env.DATABASE_URL = directUrl
      process.env.DIRECT_URL = directUrl
    }

    // Use dynamic import for child_process (works in Node.js runtime)
    const { execSync } = await import('child_process')

    const result = execSync('npx prisma db push --accept-data-loss', {
      cwd: process.cwd(),
      env: { ...process.env },
      timeout: 60000,
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'pipe'],
    })

    console.log('[migrate] prisma db push succeeded')

    return NextResponse.json({
      status: 'ok',
      message: `Schema pushed successfully to ${provider}`,
      provider,
      output: result.slice(-500),
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    console.error('[migrate] Failed:', message)

    // If prisma db push fails, try basic table check as fallback
    try {
      const count = await db.drama.count()
      return NextResponse.json({
        status: 'partial',
        message: 'Migration had errors but database appears functional',
        error: message.slice(0, 300),
        dramaCount: count,
      })
    } catch {
      return NextResponse.json(
        { status: 'error', message: message.slice(0, 500) },
        { status: 500 }
      )
    }
  }
}

// GET /api/migrate - Check migration status
export async function GET() {
  const dbUrl = process.env.DATABASE_URL || ''
  const isPostgres = dbUrl.startsWith('postgresql://') || dbUrl.startsWith('postgres://')

  try {
    if (isPostgres) {
      // PostgreSQL: query information_schema
      const tables = await db.$queryRaw<Array<{ table_name: string }>>`
        SELECT table_name FROM information_schema.tables
        WHERE table_schema = 'public'
        ORDER BY table_name
      `
      const tableNames = tables.map((t) => t.table_name)
      const requiredTables = ['Drama', 'Episode', 'Character', 'Scene', 'Storyboard', 'AiProvider', 'AgentConfig']
      const existing = requiredTables.filter((t) => tableNames.includes(t))
      const missing = requiredTables.filter((t) => !tableNames.includes(t))

      return NextResponse.json({
        status: missing.length === 0 ? 'ok' : 'needs_migration',
        message: missing.length === 0 ? 'All tables exist' : `Missing tables: ${missing.join(', ')}`,
        provider: 'PostgreSQL',
        existing,
        missing,
        allTables: tableNames,
      })
    } else {
      // SQLite: check by querying each model
      const results: Record<string, string> = {}
      const models = ['drama', 'episode', 'character', 'scene', 'storyboard', 'aiProvider', 'agentConfig']

      for (const model of models) {
        try {
          await (db as Record<string, { count: () => Promise<number> }>)[model].count()
          results[model] = 'ok'
        } catch {
          results[model] = 'missing'
        }
      }

      const allOk = Object.values(results).every((v) => v === 'ok')

      return NextResponse.json({
        status: allOk ? 'ok' : 'needs_migration',
        message: allOk ? 'All tables exist' : 'Some tables are missing',
        provider: 'SQLite',
        tables: results,
      })
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    return NextResponse.json(
      { status: 'error', message, provider: isPostgres ? 'PostgreSQL' : 'SQLite' },
      { status: 500 }
    )
  }
}

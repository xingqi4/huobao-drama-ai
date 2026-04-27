import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { execFile } from 'child_process'
import { promisify } from 'util'

const execFileAsync = promisify(execFile)

// POST /api/migrate - Push Prisma schema to database using `prisma db push`
export async function POST() {
  try {
    console.log('[migrate] Running prisma db push...')

    // Run prisma db push programmatically
    const { stdout, stderr } = await execFileAsync('npx', ['prisma', 'db', 'push', '--accept-data-loss'], {
      cwd: process.cwd(),
      env: { ...process.env },
      timeout: 60000,
    })

    console.log('[migrate] prisma db push stdout:', stdout)
    if (stderr) {
      console.warn('[migrate] prisma db push stderr:', stderr)
    }

    return NextResponse.json({
      status: 'ok',
      message: 'Schema pushed successfully via prisma db push',
      output: stdout.slice(-500),
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    console.error('[migrate] Failed:', message)
    return NextResponse.json(
      { status: 'error', message },
      { status: 500 }
    )
  }
}

// GET /api/migrate - Check migration status by querying table existence
export async function GET() {
  try {
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
      existing,
      missing,
      allTables: tableNames,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    return NextResponse.json(
      { status: 'error', message },
      { status: 500 }
    )
  }
}

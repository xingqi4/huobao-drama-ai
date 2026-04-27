// ============================================================
// Agent API Route — /api/agent/[type]
// POST: Execute an agent with a message
// GET:  Get agent config
// ============================================================

import { NextRequest, NextResponse } from 'next/server'
import {
  AgentType,
  ALL_AGENT_TYPES,
  AGENT_NAMES,
  AGENT_DESCRIPTIONS,
} from '@/lib/agents/types'
import { DEFAULT_SYSTEM_PROMPTS } from '@/lib/agents/prompts'
import { executeAgent } from '@/lib/agents/factory'
import { loadAgentSkill } from '@/lib/agents/skills'

// ============================================================
// Validate agent type
// ============================================================

function isValidAgentType(type: string): type is AgentType {
  return ALL_AGENT_TYPES.includes(type as AgentType)
}

// ============================================================
// GET /api/agent/[type] — Get agent config
// ============================================================

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ type: string }> }
) {
  const { type } = await params

  if (!isValidAgentType(type)) {
    return NextResponse.json(
      {
        error: `Invalid agent type: "${type}". Valid types: ${ALL_AGENT_TYPES.join(', ')}`,
      },
      { status: 400 }
    )
  }

  const agentType = type as AgentType

  // Try to get DB config
  let dbConfig: {
    systemPrompt: string | null
    model: string | null
    temperature: number
    maxTokens: number
    isActive: boolean
  } | null = null

  try {
    const { db } = await import('@/lib/db')
    const agentConfigModel = (db as any).agentConfig
    if (agentConfigModel) {
      const configRow = await agentConfigModel.findUnique({
        where: { agentType },
      })
      dbConfig = configRow
    }
  } catch {
    // AgentConfig table may not exist yet
  }

  const skillContent = loadAgentSkill(agentType)

  return NextResponse.json({
    agentType,
    name: AGENT_NAMES[agentType],
    description: AGENT_DESCRIPTIONS[agentType],
    config: {
      systemPrompt: dbConfig?.systemPrompt || DEFAULT_SYSTEM_PROMPTS[agentType],
      model: dbConfig?.model || null,
      temperature: dbConfig?.temperature ?? 0.7,
      maxTokens: dbConfig?.maxTokens ?? 4096,
      isActive: dbConfig?.isActive ?? true,
    },
    hasSkill: !!skillContent,
    skillPreview: skillContent
      ? skillContent.slice(0, 200) + '...'
      : null,
  })
}

// ============================================================
// POST /api/agent/[type] — Execute agent
// ============================================================

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ type: string }> }
) {
  const { type } = await params

  if (!isValidAgentType(type)) {
    return NextResponse.json(
      {
        error: `Invalid agent type: "${type}". Valid types: ${ALL_AGENT_TYPES.join(', ')}`,
      },
      { status: 400 }
    )
  }

  const agentType = type as AgentType

  // Parse request body
  let body: { episodeId?: string; dramaId?: string; message?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json(
      { error: 'Invalid JSON body' },
      { status: 400 }
    )
  }

  const { episodeId, dramaId, message } = body

  if (!episodeId || !dramaId || !message) {
    return NextResponse.json(
      {
        error:
          'Missing required fields: episodeId, dramaId, message',
      },
      { status: 400 }
    )
  }

  // Execute the agent
  try {
    const result = await executeAgent(agentType, episodeId, dramaId, message)

    return NextResponse.json({
      agentType,
      name: AGENT_NAMES[agentType],
      ...result,
    })
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error)
    console.error(`[Agent ${agentType}] Execution failed:`, errorMsg)

    return NextResponse.json(
      {
        error: `Agent execution failed: ${errorMsg}`,
        agentType,
      },
      { status: 500 }
    )
  }
}

// ============================================================
// Agent SSE Streaming Route — /api/agent/[type]/stream
// POST: Execute an agent with real-time SSE progress feedback
// ============================================================

import { NextRequest } from 'next/server'
import { AgentType, ALL_AGENT_TYPES, AGENT_NAMES } from '@/lib/agents/types'
import { executeAgent } from '@/lib/agents/factory'

// ============================================================
// Validate agent type
// ============================================================

function isValidAgentType(type: string): type is AgentType {
  return ALL_AGENT_TYPES.includes(type as AgentType)
}

// ============================================================
// POST /api/agent/[type]/stream — Execute agent with SSE streaming
// ============================================================

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ type: string }> }
) {
  const { type } = await params

  if (!isValidAgentType(type)) {
    return new Response(
      JSON.stringify({
        error: `Invalid agent type: "${type}". Valid types: ${ALL_AGENT_TYPES.join(', ')}`,
      }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    )
  }

  const agentType = type as AgentType

  // Parse request body
  let body: { episodeId?: string; dramaId?: string; message?: string }
  try {
    body = await request.json()
  } catch {
    return new Response(
      JSON.stringify({ error: 'Invalid JSON body' }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    )
  }

  const { episodeId, dramaId, message } = body

  if (!episodeId || !dramaId || !message) {
    return new Response(
      JSON.stringify({ error: 'Missing required fields: episodeId, dramaId, message' }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    )
  }

  // Create SSE stream
  const encoder = new TextEncoder()

  const stream = new ReadableStream({
    async start(controller) {
      const sendEvent = (data: Record<string, unknown>) => {
        try {
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify(data)}\n\n`)
          )
        } catch {
          // Stream may have been closed
        }
      }

      try {
        sendEvent({
          step: 'starting',
          message: `${AGENT_NAMES[agentType]} 开始工作...`,
        })

        const result = await executeAgent(
          agentType,
          episodeId,
          dramaId,
          message,
          (step, msg) => {
            sendEvent({ step, message: msg })
          }
        )

        sendEvent({
          step: 'completed',
          text: result.text,
          toolCalls: result.toolCalls,
          steps: result.steps,
        })
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error)
        console.error(`[Agent ${agentType} Stream] Execution failed:`, errorMsg)
        sendEvent({ step: 'error', message: errorMsg })
      } finally {
        controller.close()
      }
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    },
  })
}

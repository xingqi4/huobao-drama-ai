// ============================================================
// Agent Architecture — Factory & Execution Loop
// Core file implementing the agent execution pattern inspired
// by Mastra framework. Implements an agentic loop that:
// 1. Gets agent config from DB (or defaults)
// 2. Builds instructions (base prompt + skill)
// 3. Creates tool definitions and executors
// 4. Calls LLM with tools (OpenAI function calling format)
// 5. Executes tool calls and feeds results back
// 6. Repeats until no more tool calls or max steps
// ============================================================

import { AgentType, AgentExecutionResult } from './types'
import { DEFAULT_SYSTEM_PROMPTS } from './prompts'
import { getOpenAIToolsForAgent } from './tools/index'
import { getExecutorsForAgent, ToolExecutor } from './tools/executors'
import { loadAgentSkill } from './skills'
import { getActiveProvider } from '@/lib/ai-config'

// ============================================================
// Extended message types for tool calling
// ============================================================

interface ToolCallMessage {
  id: string
  type: 'function'
  function: {
    name: string
    arguments: string
  }
}

interface ChatMessage {
  role: 'system' | 'user' | 'assistant' | 'tool'
  content: string | null
  tool_calls?: ToolCallMessage[]
  tool_call_id?: string
}

// ============================================================
// Agent Config from DB
// ============================================================

interface AgentConfigRow {
  systemPrompt: string | null
  model: string | null
  temperature: number
  maxTokens: number
  isActive: boolean
}

async function getAgentConfig(
  agentType: AgentType
): Promise<AgentConfigRow | null> {
  try {
    const { db } = await import('@/lib/db')
    const agentConfigModel = (db as any).agentConfig
    if (!agentConfigModel) return null

    const config = await agentConfigModel.findUnique({
      where: { agentType },
    })
    return config as AgentConfigRow | null
  } catch {
    // AgentConfig table might not exist yet
    return null
  }
}

// ============================================================
// LLM Call with Tool Support
// ============================================================

async function callLLMWithTools(
  messages: ChatMessage[],
  tools: ReturnType<typeof getOpenAIToolsForAgent>,
  options: {
    model?: string
    temperature?: number
    maxTokens?: number
  }
): Promise<{
  message: {
    role: string
    content: string | null
    tool_calls?: ToolCallMessage[]
  }
}> {
  const provider = await getActiveProvider('llm')
  if (!provider) {
    throw new Error('未配置 LLM 供应商。请在设置中配置 API Key。')
  }

  const body: Record<string, unknown> = {
    model: options.model ?? provider.model,
    messages: messages.map((m) => ({
      role: m.role,
      content: m.content,
      ...(m.tool_calls ? { tool_calls: m.tool_calls } : {}),
      ...(m.tool_call_id ? { tool_call_id: m.tool_call_id } : {}),
    })),
    temperature: options.temperature ?? 0.7,
    max_tokens: options.maxTokens ?? 4096,
  }

  // Add tools if provided
  if (tools.length > 0) {
    body.tools = tools
    body.tool_choice = 'auto'
  }

  const url = provider.baseUrl.endsWith('/chat/completions')
    ? provider.baseUrl
    : `${provider.baseUrl.replace(/\/$/, '')}/chat/completions`

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${provider.apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  })

  if (!res.ok) {
    const text = await res.text().catch(() => 'Unknown error')
    throw new Error(`LLM API error (${res.status}): ${text.slice(0, 300)}`)
  }

  const data = await res.json()
  return {
    message: data.choices?.[0]?.message ?? {
      role: 'assistant',
      content: '',
    },
  }
}

// ============================================================
// Main Agent Execution Function
// ============================================================

const MAX_STEPS = 20

export async function executeAgent(
  agentType: AgentType,
  episodeId: string,
  dramaId: string,
  message: string,
  onProgress?: (step: string, msg: string) => void
): Promise<AgentExecutionResult> {
  // 1. Get agent config from DB (or use defaults)
  const dbConfig = await getAgentConfig(agentType)

  const systemPrompt =
    dbConfig?.systemPrompt || DEFAULT_SYSTEM_PROMPTS[agentType]
  const model = dbConfig?.model || undefined
  const temperature = dbConfig?.temperature ?? 0.7
  const maxTokens = dbConfig?.maxTokens ?? 4096

  // 2. Build instructions (base prompt + skill)
  const skillContent = loadAgentSkill(agentType)
  const fullSystemPrompt = skillContent
    ? `${systemPrompt}\n\n---\n## 专业技能指南\n${skillContent}`
    : systemPrompt

  // 3. Create tool definitions and executors for this agent type
  const openAITools = getOpenAIToolsForAgent(agentType)
  const executors = getExecutorsForAgent(agentType)

  // 4. Initialize messages
  const messages: ChatMessage[] = [
    { role: 'system', content: fullSystemPrompt },
    { role: 'user', content: message },
  ]

  const toolCallResults: Array<{
    name: string
    arguments: Record<string, unknown>
    result: unknown
  }> = []

  let steps = 0
  let finalText = ''

  // 5. Agentic execution loop
  while (steps < MAX_STEPS) {
    steps++
    onProgress?.('thinking', `步骤 ${steps}: 调用 LLM...`)

    const response = await callLLMWithTools(messages, openAITools, {
      model,
      temperature,
      maxTokens,
    })

    const assistantMessage = response.message

    // Add assistant message to conversation
    const assistantChatMsg: ChatMessage = {
      role: 'assistant',
      content: assistantMessage.content || null,
    }
    if (assistantMessage.tool_calls && assistantMessage.tool_calls.length > 0) {
      assistantChatMsg.tool_calls = assistantMessage.tool_calls
    }
    messages.push(assistantChatMsg)

    // Check if there are tool calls to execute
    if (
      !assistantMessage.tool_calls ||
      assistantMessage.tool_calls.length === 0
    ) {
      // No more tool calls — we're done
      finalText = assistantMessage.content || ''
      break
    }

    // 6. Execute each tool call
    for (const toolCall of assistantMessage.tool_calls) {
      const toolName = toolCall.function.name
      const executor: ToolExecutor | undefined = executors[toolName]

      if (!executor) {
        // Tool not found — report error back to LLM
        const errorMsg = `Tool "${toolName}" not found. Available tools: ${Object.keys(executors).join(', ')}`
        messages.push({
          role: 'tool',
          content: JSON.stringify({ error: errorMsg }),
          tool_call_id: toolCall.id,
        })
        toolCallResults.push({
          name: toolName,
          arguments: {},
          result: { error: errorMsg },
        })
        onProgress?.('error', `工具 ${toolName} 未找到`)
        continue
      }

      // Parse arguments
      let args: Record<string, unknown>
      try {
        args = JSON.parse(toolCall.function.arguments)
      } catch {
        args = {}
        onProgress?.(
          'warning',
          `工具 ${toolName} 参数解析失败，使用空参数`
        )
      }

      onProgress?.(
        'tool_call',
        `步骤 ${steps}: 调用工具 ${toolName}...`
      )

      try {
        // Execute the tool with captured context
        const result = await executor(args, { episodeId, dramaId })

        messages.push({
          role: 'tool',
          content: JSON.stringify(result),
          tool_call_id: toolCall.id,
        })

        toolCallResults.push({
          name: toolName,
          arguments: args,
          result,
        })

        onProgress?.(
          'tool_result',
          `步骤 ${steps}: 工具 ${toolName} 执行成功`
        )
      } catch (error) {
        const errorMsg =
          error instanceof Error ? error.message : String(error)

        messages.push({
          role: 'tool',
          content: JSON.stringify({ error: errorMsg }),
          tool_call_id: toolCall.id,
        })

        toolCallResults.push({
          name: toolName,
          arguments: args,
          result: { error: errorMsg },
        })

        onProgress?.(
          'tool_error',
          `步骤 ${steps}: 工具 ${toolName} 执行失败: ${errorMsg}`
        )
      }
    }

    // Continue the loop — LLM will see tool results and decide next action
  }

  // If we hit max steps without a final text, use the last assistant message
  if (!finalText && steps >= MAX_STEPS) {
    finalText = '达到最大执行步骤数，Agent执行已终止。'
  }

  return {
    text: finalText,
    toolCalls: toolCallResults,
    steps,
  }
}

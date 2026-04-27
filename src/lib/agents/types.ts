// ============================================================
// Agent Architecture — Type Definitions
// Inspired by Mastra framework patterns for AI agent orchestration
// in a drama production pipeline.
// ============================================================

export type AgentType =
  | 'script_rewriter'
  | 'extractor'
  | 'storyboard_breaker'
  | 'voice_assigner'
  | 'grid_prompt_generator'

export interface ToolDefinition {
  name: string
  description: string
  parameters: Record<
    string,
    {
      type: 'string' | 'number' | 'boolean' | 'array' | 'object'
      description: string
      required?: boolean
      enum?: string[]
    }
  >
}

export interface ToolCall {
  id: string
  name: string
  arguments: Record<string, unknown>
}

export interface ToolResult {
  toolCallId: string
  result: unknown
}

export interface AgentConfig {
  agentType: AgentType
  systemPrompt: string
  model?: string
  temperature?: number
  maxTokens?: number
  isActive: boolean
}

export interface AgentExecutionResult {
  text: string
  toolCalls: Array<{
    name: string
    arguments: Record<string, unknown>
    result: unknown
  }>
  steps: number
}

export const AGENT_NAMES: Record<AgentType, string> = {
  script_rewriter: '剧本改写专家',
  extractor: '角色场景提取器',
  storyboard_breaker: '分镜拆解专家',
  voice_assigner: '音色分配师',
  grid_prompt_generator: '宫格提示词生成器',
}

export const AGENT_DESCRIPTIONS: Record<AgentType, string> = {
  script_rewriter:
    '将小说/故事原文改写为标准剧本格式，包含场景描述、对白和动作指示',
  extractor:
    '从剧本中智能提取角色信息和场景描述，支持去重和合并',
  storyboard_breaker:
    '将剧本拆解为分镜序列，包含镜头类型、摄影角度、提示词等',
  voice_assigner:
    '为角色自动分配合适的TTS音色',
  grid_prompt_generator:
    '生成角色/场景/宫格图的提示词',
}

export const ALL_AGENT_TYPES: AgentType[] = [
  'script_rewriter',
  'extractor',
  'storyboard_breaker',
  'voice_assigner',
  'grid_prompt_generator',
]

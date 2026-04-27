// ============================================================
// Agent Architecture — Tool Registry
// Defines tools for each agent type in OpenAI function calling format.
// Tools are closures that capture episodeId and dramaId at runtime,
// so the LLM never needs to pass these IDs (preventing hallucination).
// ============================================================

import { AgentType, ToolDefinition } from '../types'

// ---- OpenAI function calling format types ----

export interface OpenAIToolParameter {
  type: 'string' | 'number' | 'boolean' | 'array' | 'object'
  description: string
  enum?: string[]
  items?: OpenAIToolParameter
  properties?: Record<string, OpenAIToolParameter>
  required?: string[]
}

export interface OpenAIToolFunction {
  name: string
  description: string
  parameters: {
    type: 'object'
    properties: Record<string, OpenAIToolParameter>
    required: string[]
  }
}

export interface OpenAITool {
  type: 'function'
  function: OpenAIToolFunction
}

/**
 * Convert a ToolDefinition to OpenAI function calling format
 */
export function toolDefinitionToOpenAI(tool: ToolDefinition): OpenAITool {
  const properties: Record<string, OpenAIToolParameter> = {}
  const required: string[] = []

  for (const [key, param] of Object.entries(tool.parameters)) {
    properties[key] = {
      type: param.type,
      description: param.description,
      ...(param.enum ? { enum: param.enum } : {}),
    }
    if (param.required) {
      required.push(key)
    }
  }

  return {
    type: 'function',
    function: {
      name: tool.name,
      description: tool.description,
      parameters: {
        type: 'object',
        properties,
        required,
      },
    },
  }
}

// ============================================================
// Tool Definitions per Agent Type
// ============================================================

const SCRIPT_REWRITER_TOOLS: ToolDefinition[] = [
  {
    name: 'read_episode_script',
    description: '读取当前集的原始内容和已有剧本。返回rawContent和scriptContent。',
    parameters: {},
  },
  {
    name: 'save_script',
    description: '保存改写后的剧本内容到当前集。',
    parameters: {
      scriptContent: {
        type: 'string',
        description: '改写后的完整剧本内容',
        required: true,
      },
    },
  },
]

const EXTRACTOR_TOOLS: ToolDefinition[] = [
  {
    name: 'read_script_for_extraction',
    description: '读取当前集的剧本内容，用于提取角色和场景。',
    parameters: {},
  },
  {
    name: 'read_existing_characters',
    description: '读取项目中已有的角色列表，用于去重判断。',
    parameters: {},
  },
  {
    name: 'read_existing_scenes',
    description: '读取项目中已有的场景列表，用于去重判断。',
    parameters: {},
  },
  {
    name: 'save_characters',
    description: '保存提取到的角色信息。会自动与已有角色进行去重合并。参数为角色数组JSON字符串。',
    parameters: {
      characters: {
        type: 'array',
        description:
          '要保存的角色数组，每个元素包含 name, role, gender, age, appearance, personality, voiceStyle 字段',
        required: true,
      },
    },
  },
  {
    name: 'save_scenes',
    description: '保存提取到的场景信息。会自动与已有场景进行去重合并。参数为场景数组JSON字符串。',
    parameters: {
      scenes: {
        type: 'array',
        description:
          '要保存的场景数组，每个元素包含 location, timeOfDay, description, prompt 字段',
        required: true,
      },
    },
  },
]

const STORYBOARD_BREAKER_TOOLS: ToolDefinition[] = [
  {
    name: 'read_storyboard_context',
    description: '读取当前集的剧本、角色和场景信息，作为分镜拆解的上下文。',
    parameters: {},
  },
  {
    name: 'save_storyboards',
    description: '批量保存生成的分镜镜头序列。会先删除该集已有的分镜。',
    parameters: {
      storyboards: {
        type: 'array',
        description:
          '分镜数组，每个元素包含 shotNumber, title, shotType, cameraAngle, cameraMovement, action, dialogue, dialogueChar, duration, imagePrompt, videoPrompt, atmosphere 字段',
        required: true,
      },
    },
  },
  {
    name: 'update_storyboard',
    description: '更新某个特定的分镜镜头。',
    parameters: {
      shotNumber: {
        type: 'number',
        description: '要更新的镜头编号',
        required: true,
      },
      updates: {
        type: 'object',
        description: '要更新的字段，如 { imagePrompt: "...", videoPrompt: "..." }',
        required: true,
      },
    },
  },
]

const VOICE_ASSIGNER_TOOLS: ToolDefinition[] = [
  {
    name: 'get_characters',
    description: '获取项目中所有角色的信息，包括已分配和未分配音色的角色。',
    parameters: {},
  },
  {
    name: 'list_available_voices',
    description: '列出可用的TTS音色列表，包含音色ID、名称、性别和描述。',
    parameters: {
      gender: {
        type: 'string',
        description: '按性别筛选音色：male | female | all',
        enum: ['male', 'female', 'all'],
      },
    },
  },
  {
    name: 'assign_voice',
    description: '为指定角色分配TTS音色。',
    parameters: {
      characterName: {
        type: 'string',
        description: '角色名称',
        required: true,
      },
      voiceId: {
        type: 'string',
        description: 'TTS音色ID',
        required: true,
      },
    },
  },
]

const GRID_PROMPT_GENERATOR_TOOLS: ToolDefinition[] = [
  {
    name: 'read_characters',
    description: '读取项目中的角色信息，用于生成角色肖像提示词。',
    parameters: {},
  },
  {
    name: 'read_scenes',
    description: '读取项目中的场景信息，用于生成场景背景提示词。',
    parameters: {},
  },
  {
    name: 'read_shots',
    description: '读取当前集的分镜信息，用于生成宫格图提示词。',
    parameters: {},
  },
  {
    name: 'generate_character_prompt',
    description: '生成并保存角色肖像的AI绘图提示词。',
    parameters: {
      characterName: {
        type: 'string',
        description: '角色名称',
        required: true,
      },
      prompt: {
        type: 'string',
        description: '英文的AI绘图提示词',
        required: true,
      },
    },
  },
  {
    name: 'generate_scene_prompt',
    description: '生成并保存场景背景的AI绘图提示词。',
    parameters: {
      sceneLocation: {
        type: 'string',
        description: '场景地点名称',
        required: true,
      },
      prompt: {
        type: 'string',
        description: '英文的AI绘图提示词',
        required: true,
      },
    },
  },
  {
    name: 'generate_grid_prompt',
    description: '生成并保存宫格分镜图的AI绘图提示词。',
    parameters: {
      shotNumber: {
        type: 'number',
        description: '镜头编号',
        required: true,
      },
      imagePrompt: {
        type: 'string',
        description: '首帧图片的英文提示词',
        required: true,
      },
      videoPrompt: {
        type: 'string',
        description: '视频生成的XML格式提示词',
        required: true,
      },
    },
  },
]

// ============================================================
// Tool Registry Map
// ============================================================

export const AGENT_TOOLS: Record<AgentType, ToolDefinition[]> = {
  script_rewriter: SCRIPT_REWRITER_TOOLS,
  extractor: EXTRACTOR_TOOLS,
  storyboard_breaker: STORYBOARD_BREAKER_TOOLS,
  voice_assigner: VOICE_ASSIGNER_TOOLS,
  grid_prompt_generator: GRID_PROMPT_GENERATOR_TOOLS,
}

/**
 * Get OpenAI-format tool definitions for an agent type
 */
export function getOpenAIToolsForAgent(agentType: AgentType): OpenAITool[] {
  const tools = AGENT_TOOLS[agentType] || []
  return tools.map(toolDefinitionToOpenAI)
}

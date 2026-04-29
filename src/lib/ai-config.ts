// ============================================================
// AI Service Configuration — Multi-Provider Architecture
// Supports NVIDIA, OpenAI, Stability AI, SiliconFlow,
// Volcengine, Fish Audio, z-ai-sdk, and custom providers.
// Provider credentials are loaded from DB (AiProvider table)
// with env var fallbacks.
// ============================================================

import { db } from '@/lib/db'

// ============================================================
// Provider definitions — preset providers per category
// ============================================================

export type AiCategory = 'llm' | 'image' | 'video' | 'tts'

export interface ModelOption {
  id: string       // Model identifier used in API calls
  name: string     // Display name
  tags?: string[]  // Tags like '推荐', '免费', '快速', '最新'
}

export interface ProviderPreset {
  provider: string
  name: string
  defaultBaseUrl: string
  defaultModel: string
  description: string
  envKey: string // env var name for API key fallback
  availableModels?: ModelOption[] // Selectable models for this provider
}

export const PROVIDER_PRESETS: Record<AiCategory, ProviderPreset[]> = {
  llm: [
    {
      provider: 'nvidia',
      name: 'NVIDIA NIM',
      defaultBaseUrl: 'https://integrate.api.nvidia.com/v1',
      defaultModel: 'z-ai/glm-5.1',
      description: 'NVIDIA NIM API — GLM5.1, DeepSeek V4, MiniMax, Llama, Qwen 等 70+ 模型',
      envKey: 'NVIDIA_API_KEY',
      availableModels: [
        { id: 'z-ai/glm-5.1', name: 'GLM-5.1', tags: ['推荐', '最新'] },
        { id: 'z-ai/glm5', name: 'GLM-5' },
        { id: 'z-ai/glm4.7', name: 'GLM-4.7' },
        { id: 'deepseek-ai/deepseek-v4-pro', name: 'DeepSeek V4 Pro', tags: ['推荐', '最新'] },
        { id: 'deepseek-ai/deepseek-v4-flash', name: 'DeepSeek V4 Flash', tags: ['快速'] },
        { id: 'deepseek-ai/deepseek-v3.2', name: 'DeepSeek V3.2' },
        { id: 'deepseek-ai/deepseek-v3.1-terminus', name: 'DeepSeek V3.1 Terminus' },
        { id: 'minimaxai/minimax-m2.7', name: 'MiniMax M2.7', tags: ['最新'] },
        { id: 'minimaxai/minimax-m2.5', name: 'MiniMax M2.5' },
        { id: 'qwen/qwen3.5-397b-a17b', name: 'Qwen 3.5 397B', tags: ['推荐', '最新'] },
        { id: 'qwen/qwen3.5-122b-a10b', name: 'Qwen 3.5 122B' },
        { id: 'qwen/qwen3-next-80b-a3b-instruct', name: 'Qwen 3 Next 80B' },
        { id: 'qwen/qwen3-next-80b-a3b-thinking', name: 'Qwen 3 Next Thinking 80B', tags: ['推理'] },
        { id: 'moonshotai/kimi-k2.5', name: 'Kimi K2.5', tags: ['最新'] },
        { id: 'moonshotai/kimi-k2-instruct', name: 'Kimi K2' },
        { id: 'moonshotai/kimi-k2-thinking', name: 'Kimi K2 Thinking', tags: ['推理'] },
        { id: 'meta/llama-4-maverick-17b-128e-instruct', name: 'Llama 4 Maverick', tags: ['最新'] },
        { id: 'meta/llama-3.3-70b-instruct', name: 'Llama 3.3 70B' },
        { id: 'meta/llama-3.1-405b-instruct', name: 'Llama 3.1 405B' },
        { id: 'meta/llama-3.1-70b-instruct', name: 'Llama 3.1 70B' },
        { id: 'meta/llama-3.1-8b-instruct', name: 'Llama 3.1 8B', tags: ['快速'] },
        { id: 'nvidia/llama-3.1-nemotron-ultra-253b-v1', name: 'Nemotron Ultra 253B', tags: ['推荐'] },
        { id: 'nvidia/llama-3.1-nemotron-70b-instruct', name: 'Nemotron 70B' },
        { id: 'nvidia/llama-3.3-nemotron-super-49b-v1.5', name: 'Nemotron Super 49B v1.5' },
        { id: 'mistralai/mistral-large-3-675b-instruct-2512', name: 'Mistral Large 3 675B', tags: ['最新'] },
        { id: 'mistralai/mistral-medium-3-instruct', name: 'Mistral Medium 3' },
        { id: 'mistralai/mistral-small-4-119b-2603', name: 'Mistral Small 4' },
        { id: 'mistralai/mixtral-8x22b-instruct-v0.1', name: 'Mixtral 8x22B' },
        { id: 'openai/gpt-oss-120b', name: 'GPT-OSS 120B' },
        { id: '01-ai/yi-large', name: 'Yi Large' },
        { id: 'bytedance/seed-oss-36b-instruct', name: 'Seed OSS 36B' },
      ],
    },
    {
      provider: 'openai',
      name: 'OpenAI',
      defaultBaseUrl: 'https://api.openai.com/v1',
      defaultModel: 'gpt-4o',
      description: 'OpenAI GPT-4o / GPT-4o-mini',
      envKey: 'OPENAI_API_KEY',
      availableModels: [
        { id: 'gpt-4o', name: 'GPT-4o', tags: ['推荐'] },
        { id: 'gpt-4o-mini', name: 'GPT-4o Mini', tags: ['快速', '经济'] },
        { id: 'gpt-4.1', name: 'GPT-4.1', tags: ['最新'] },
        { id: 'gpt-4.1-mini', name: 'GPT-4.1 Mini', tags: ['快速'] },
        { id: 'gpt-4.1-nano', name: 'GPT-4.1 Nano', tags: ['经济'] },
        { id: 'o3', name: 'o3', tags: ['推理'] },
        { id: 'o4-mini', name: 'o4-mini', tags: ['推理', '经济'] },
      ],
    },
    {
      provider: 'siliconflow',
      name: 'SiliconFlow',
      defaultBaseUrl: 'https://api.siliconflow.cn/v1',
      defaultModel: 'deepseek-ai/DeepSeek-V3',
      description: 'SiliconFlow — DeepSeek, Qwen, Llama',
      envKey: 'SILICONFLOW_API_KEY',
      availableModels: [
        { id: 'deepseek-ai/DeepSeek-V3', name: 'DeepSeek V3', tags: ['推荐'] },
        { id: 'deepseek-ai/DeepSeek-R1', name: 'DeepSeek R1', tags: ['推理'] },
        { id: 'Qwen/Qwen2.5-72B-Instruct', name: 'Qwen 2.5 72B' },
        { id: 'Qwen/Qwen2.5-32B-Instruct', name: 'Qwen 2.5 32B' },
        { id: 'meta-llama/Meta-Llama-3.1-70B-Instruct', name: 'Llama 3.1 70B' },
        { id: 'meta-llama/Meta-Llama-3.1-8B-Instruct', name: 'Llama 3.1 8B', tags: ['快速'] },
      ],
    },
    {
      provider: 'deepseek',
      name: 'DeepSeek',
      defaultBaseUrl: 'https://api.deepseek.com/v1',
      defaultModel: 'deepseek-chat',
      description: 'DeepSeek official API',
      envKey: 'DEEPSEEK_API_KEY',
      availableModels: [
        { id: 'deepseek-chat', name: 'DeepSeek Chat', tags: ['推荐'] },
        { id: 'deepseek-reasoner', name: 'DeepSeek Reasoner', tags: ['推理'] },
      ],
    },
    {
      provider: 'custom',
      name: '自定义 OpenAI 兼容',
      defaultBaseUrl: '',
      defaultModel: '',
      description: '任何 OpenAI 兼容接口（中转站、私有部署等）',
      envKey: 'CUSTOM_LLM_API_KEY',
    },
  ],
  image: [
    {
      provider: 'siliconflow',
      name: 'SiliconFlow Image',
      defaultBaseUrl: 'https://api.siliconflow.cn/v1',
      defaultModel: 'stabilityai/stable-diffusion-xl-base-1.0',
      description: 'SiliconFlow — SDXL, FLUX 等（推荐，国内可用）',
      envKey: 'SILICONFLOW_API_KEY',
      availableModels: [
        { id: 'stabilityai/stable-diffusion-xl-base-1.0', name: 'SDXL Base 1.0', tags: ['推荐'] },
        { id: 'black-forest-labs/FLUX.1-schnell', name: 'FLUX.1 Schnell', tags: ['快速'] },
        { id: 'black-forest-labs/FLUX.1-dev', name: 'FLUX.1 Dev' },
        { id: 'stabilityai/stable-diffusion-3-5-large', name: 'SD 3.5 Large' },
        { id: 'stabilityai/stable-diffusion-3-medium', name: 'SD 3 Medium' },
      ],
    },
    {
      provider: 'openai',
      name: 'OpenAI DALL·E',
      defaultBaseUrl: 'https://api.openai.com/v1',
      defaultModel: 'dall-e-3',
      description: 'OpenAI DALL·E 3 图片生成',
      envKey: 'OPENAI_API_KEY',
      availableModels: [
        { id: 'dall-e-3', name: 'DALL·E 3', tags: ['推荐'] },
        { id: 'gpt-image-1', name: 'GPT Image 1', tags: ['最新'] },
      ],
    },
    {
      provider: 'stability',
      name: 'Stability AI',
      defaultBaseUrl: 'https://api.stability.ai/v1',
      defaultModel: 'stable-diffusion-xl-1024-v1-0',
      description: 'Stability AI 官方 API',
      envKey: 'STABILITY_API_KEY',
      availableModels: [
        { id: 'stable-diffusion-xl-1024-v1-0', name: 'SDXL 1.0 1024', tags: ['推荐'] },
        { id: 'stable-diffusion-3-5-large', name: 'SD 3.5 Large' },
        { id: 'stable-diffusion-3-medium', name: 'SD 3 Medium' },
        { id: 'stable-image-core', name: 'Stable Image Core' },
      ],
    },
    {
      provider: 'nvidia',
      name: 'NVIDIA Image',
      defaultBaseUrl: 'https://integrate.api.nvidia.com/v1',
      defaultModel: 'stabilityai/stable-diffusion-xl',
      description: 'NVIDIA NIM 图片生成（SDXL、Stable Diffusion 等）',
      envKey: 'NVIDIA_API_KEY',
      availableModels: [
        { id: 'stabilityai/stable-diffusion-xl', name: 'SDXL (NIM)', tags: ['推荐'] },
        { id: 'stabilityai/stable-diffusion-3-medium', name: 'SD 3 Medium (NIM)' },
        { id: 'stabilityai/stable-diffusion-3-large', name: 'SD 3 Large (NIM)' },
      ],
    },
    {
      provider: 'z-ai-sdk',
      name: 'Z-AI SDK',
      defaultBaseUrl: '',
      defaultModel: 'dall-e-3',
      description: '内置 z-ai-web-dev-sdk（仅本地开发可用）',
      envKey: '',
    },
    {
      provider: 'custom',
      name: '自定义图片接口',
      defaultBaseUrl: '',
      defaultModel: '',
      description: '自定义 OpenAI 兼容图片生成接口',
      envKey: 'CUSTOM_IMAGE_API_KEY',
    },
  ],
  video: [
    {
      provider: 'siliconflow',
      name: 'SiliconFlow Video',
      defaultBaseUrl: 'https://api.siliconflow.cn/v1',
      defaultModel: 'ali-video/video-01',
      description: 'SiliconFlow 视频生成（推荐，国内可用）',
      envKey: 'SILICONFLOW_API_KEY',
      availableModels: [
        { id: 'ali-video/video-01', name: 'Ali Video 01', tags: ['推荐'] },
        { id: 'tencent-video/hunyuan-video', name: 'Hunyuan Video' },
      ],
    },
    {
      provider: 'seedance',
      name: 'Seedance 2.0',
      defaultBaseUrl: 'https://api.siliconflow.cn/v1',
      defaultModel: 'bytedance-seedance/seedance-2.0-pro-250428',
      description: 'Seedance 2.0 视频生成（字节跳动，支持图生视频）',
      envKey: 'SILICONFLOW_API_KEY',
      availableModels: [
        { id: 'bytedance-seedance/seedance-2.0-pro-250428', name: 'Seedance 2.0 Pro', tags: ['推荐'] },
        { id: 'bytedance-seedance/seedance-2.0-lite-250428', name: 'Seedance 2.0 Lite', tags: ['快速'] },
      ],
    },
    {
      provider: 'volcengine',
      name: '火山引擎 (Kling)',
      defaultBaseUrl: 'https://visual.volcengineapi.com',
      defaultModel: '',
      description: '火山引擎 / Kling 视频生成',
      envKey: 'VOLCENGINE_API_KEY',
    },
    {
      provider: 'z-ai-sdk',
      name: 'Z-AI SDK 视频',
      defaultBaseUrl: '',
      defaultModel: '',
      description: '内置 z-ai-web-dev-sdk 视频生成（仅本地开发可用）',
      envKey: '',
    },
    {
      provider: 'custom',
      name: '自定义视频接口',
      defaultBaseUrl: '',
      defaultModel: '',
      description: '自定义视频生成接口',
      envKey: 'CUSTOM_VIDEO_API_KEY',
    },
  ],
  tts: [
    {
      provider: 'openai',
      name: 'OpenAI TTS',
      defaultBaseUrl: 'https://api.openai.com/v1',
      defaultModel: 'tts-1',
      description: 'OpenAI Text-to-Speech（推荐）',
      envKey: 'OPENAI_API_KEY',
      availableModels: [
        { id: 'tts-1', name: 'TTS-1', tags: ['推荐'] },
        { id: 'tts-1-hd', name: 'TTS-1 HD', tags: ['高清'] },
        { id: 'gpt-4o-mini-tts', name: 'GPT-4o Mini TTS', tags: ['最新'] },
      ],
    },
    {
      provider: 'fish-audio',
      name: 'Fish Audio',
      defaultBaseUrl: 'https://api.fish.audio/v1',
      defaultModel: 'tts-1',
      description: 'Fish Audio 语音合成',
      envKey: 'FISH_AUDIO_API_KEY',
    },
    {
      provider: 'nvidia',
      name: 'NVIDIA Riva TTS',
      defaultBaseUrl: 'https://integrate.api.nvidia.com/v1',
      defaultModel: 'nvidia/riva-tts',
      description: 'NVIDIA Riva 语音合成（支持多语言）',
      envKey: 'NVIDIA_API_KEY',
      availableModels: [
        { id: 'nvidia/riva-tts', name: 'Riva TTS', tags: ['推荐'] },
      ],
    },
    {
      provider: 'volcengine',
      name: '火山引擎 TTS',
      defaultBaseUrl: 'https://openspeech.bytedance.com/api/v1',
      defaultModel: '',
      description: '火山引擎语音合成',
      envKey: 'VOLCENGINE_API_KEY',
    },
    {
      provider: 'z-ai-sdk',
      name: 'Z-AI SDK TTS',
      defaultBaseUrl: '',
      defaultModel: '',
      description: '内置 z-ai-web-dev-sdk 语音合成（仅本地开发可用）',
      envKey: '',
    },
    {
      provider: 'custom',
      name: '自定义 TTS 接口',
      defaultBaseUrl: '',
      defaultModel: '',
      description: '自定义 TTS 接口',
      envKey: 'CUSTOM_TTS_API_KEY',
    },
  ],
}

// ============================================================
// DB-backed provider config
// ============================================================

export interface ProviderConfig {
  category: AiCategory
  provider: string
  name: string
  apiKey: string
  baseUrl: string
  model: string
  isActive: boolean
}

/**
 * Load the active provider config for a given category from DB.
 * Falls back to env vars if no DB config is active.
 */
export async function getActiveProvider(category: AiCategory): Promise<ProviderConfig | null> {
  // Try DB first
  const dbProvider = await db.aiProvider.findFirst({
    where: { category, isActive: true },
    orderBy: { sort: 'asc' },
  })

  // Check if the provider is explicitly set as active in DB
  // Some providers (like z-ai-sdk) don't need an API key
  const noKeyProviders = ['z-ai-sdk']

  if (dbProvider) {
    // Use DB record if it's active — even if apiKey is empty
    // (apiKey may come from env vars, or the provider may not need one)
    // Find preset for this provider to get defaults and env var fallbacks
    const preset = PROVIDER_PRESETS[category]?.find((p) => p.provider === dbProvider.provider)
    const needsNoKey = noKeyProviders.includes(dbProvider.provider)
    const hasApiKey = Boolean(dbProvider.apiKey)
    const envApiKey = preset?.envKey ? (process.env[preset.envKey] || '') : ''
    // Only use this DB record if it has an apiKey, can fall back to env, or doesn't need one
    if (hasApiKey || envApiKey || needsNoKey) {
      return {
        category,
        provider: dbProvider.provider,
        name: dbProvider.name || preset?.name || dbProvider.provider,
        apiKey: dbProvider.apiKey || envApiKey,
        baseUrl: dbProvider.baseUrl || preset?.defaultBaseUrl || '',
        model: dbProvider.model || preset?.defaultModel || '',
        isActive: true,
      }
    }
  }

  // Fallback: check env vars (only for providers that have env keys)
  const presets = PROVIDER_PRESETS[category]
  for (const preset of presets) {
    if (preset.envKey && process.env[preset.envKey]) {
      return {
        category,
        provider: preset.provider,
        name: preset.name,
        apiKey: process.env[preset.envKey]!,
        baseUrl: preset.defaultBaseUrl,
        model: preset.defaultModel,
        isActive: true,
      }
    }
  }

  return null
}

/**
 * Get all provider configs for a category (for settings UI).
 */
export async function getAllProviders(category: AiCategory): Promise<ProviderConfig[]> {
  const dbProviders = await db.aiProvider.findMany({
    where: { category },
    orderBy: { sort: 'asc' },
  })

  // Merge with presets
  const presets = PROVIDER_PRESETS[category]
  const result: ProviderConfig[] = []

  for (const preset of presets) {
    const existing = dbProviders.find((p) => p.provider === preset.provider)
    // Use || instead of ?? because Prisma stores '' (empty string) not null
    // ?? treats '' as a real value and won't fall back to preset defaults
    result.push({
      category,
      provider: preset.provider,
      name: existing?.name || preset.name,
      apiKey: existing?.apiKey || (preset.envKey ? (process.env[preset.envKey] || '') : ''),
      baseUrl: existing?.baseUrl || preset.defaultBaseUrl,
      model: existing?.model || preset.defaultModel,
      isActive: existing?.isActive ?? false,
    })
  }

  // Add any custom DB providers not in presets
  for (const dbP of dbProviders) {
    if (!presets.some((p) => p.provider === dbP.provider)) {
      result.push({
        category,
        provider: dbP.provider,
        name: dbP.name,
        apiKey: dbP.apiKey,
        baseUrl: dbP.baseUrl,
        model: dbP.model,
        isActive: dbP.isActive,
      })
    }
  }

  return result
}

/**
 * Save provider config to DB (upsert).
 */
export async function saveProviderConfig(config: ProviderConfig): Promise<void> {
  await db.aiProvider.upsert({
    where: {
      category_provider: {
        category: config.category,
        provider: config.provider,
      },
    },
    create: {
      category: config.category,
      provider: config.provider,
      name: config.name,
      apiKey: config.apiKey,
      baseUrl: config.baseUrl,
      model: config.model,
      isActive: config.isActive,
    },
    update: {
      name: config.name,
      apiKey: config.apiKey,
      baseUrl: config.baseUrl,
      model: config.model,
      isActive: config.isActive,
    },
  })
}

/**
 * Get existing provider config from DB (for merge during save).
 * Returns null if not found in DB.
 */
export async function getExistingProviderConfig(
  category: AiCategory,
  provider: string
): Promise<ProviderConfig | null> {
  const dbProvider = await db.aiProvider.findUnique({
    where: {
      category_provider: { category, provider },
    },
  })
  if (!dbProvider) return null
  return {
    category,
    provider: dbProvider.provider,
    name: dbProvider.name,
    apiKey: dbProvider.apiKey,
    baseUrl: dbProvider.baseUrl,
    model: dbProvider.model,
    isActive: dbProvider.isActive,
  }
}

/**
 * Set only one active provider per category (deactivate others).
 */
export async function setActiveProvider(category: AiCategory, provider: string): Promise<void> {
  await db.aiProvider.updateMany({
    where: { category },
    data: { isActive: false },
  })
  await db.aiProvider.upsert({
    where: {
      category_provider: {
        category,
        provider,
      },
    },
    create: {
      category,
      provider,
      name: PROVIDER_PRESETS[category]?.find((p) => p.provider === provider)?.name || provider,
      apiKey: '',
      baseUrl: PROVIDER_PRESETS[category]?.find((p) => p.provider === provider)?.defaultBaseUrl || '',
      model: PROVIDER_PRESETS[category]?.find((p) => p.provider === provider)?.defaultModel || '',
      isActive: true,
    },
    update: {
      isActive: true,
    },
  })
}

// ============================================================
// AI Client — unified interface with multi-provider support
// ============================================================

export const aiClient = {
  // ---- Chat / LLM ----

  async chatCompletion(
    messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>,
    options?: {
      temperature?: number
      max_tokens?: number
      model?: string
    }
  ) {
    const provider = await getActiveProvider('llm')
    if (!provider) {
      throw new Error('未配置 LLM 供应商。请在设置中配置 API Key。')
    }

    const body = {
      model: options?.model || provider.model,
      messages,
      temperature: options?.temperature ?? 0.7,
      max_tokens: options?.max_tokens ?? 4096,
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

    return res.json()
  },

  async chat(
    prompt: string,
    systemPrompt?: string,
    options?: { temperature?: number; max_tokens?: number; model?: string }
  ): Promise<string> {
    const messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }> = []
    if (systemPrompt) {
      messages.push({ role: 'system', content: systemPrompt })
    }
    messages.push({ role: 'user', content: prompt })

    const response = await this.chatCompletion(messages, options)
    return response.choices?.[0]?.message?.content ?? ''
  },

  async chatJson<T = unknown>(
    messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>,
    options?: { temperature?: number; max_tokens?: number; model?: string }
  ): Promise<T> {
    const hasJsonInstruction = messages.some(
      (m) =>
        m.role === 'system' &&
        (m.content.toLowerCase().includes('json') ||
          m.content.toLowerCase().includes('json格式'))
    )

    const finalMessages = hasJsonInstruction
      ? messages
      : [
          ...messages,
          {
            role: 'system' as const,
            content:
              'IMPORTANT: You must respond with valid JSON only. ' +
              'Do not include any prose, explanations, or markdown formatting. ' +
              'Return the raw JSON object or array.',
          },
        ]

    const response = await this.chatCompletion(finalMessages, {
      ...options,
      temperature: options?.temperature ?? 0.3,
    })

    const content = response.choices?.[0]?.message?.content ?? ''
    return parseJsonFromLlmResponse<T>(content)
  },

  // ---- Image Generation ----

  async generateImage(
    prompt: string,
    negativePrompt?: string,
    options?: { width?: number; height?: number; size?: string }
  ): Promise<string> {
    const provider = await getActiveProvider('image')
    if (!provider) {
      throw new Error('未配置图片生成供应商。请在设置中配置 API Key。')
    }

    // Provider-specific implementations
    if (provider.provider === 'nvidia') {
      return this._generateImageNvidia(prompt, negativePrompt, provider, options)
    } else if (provider.provider === 'openai' || provider.provider === 'z-ai-sdk') {
      return this._generateImageOpenAI(prompt, provider, options)
    } else if (provider.provider === 'siliconflow') {
      return this._generateImageOpenAI(prompt, provider, options)
    } else if (provider.provider === 'stability') {
      return this._generateImageStability(prompt, negativePrompt, provider, options)
    } else {
      // Generic OpenAI-compatible fallback
      return this._generateImageOpenAI(prompt, provider, options)
    }
  },

  async _generateImageNvidia(
    prompt: string,
    negativePrompt: string | undefined,
    provider: ProviderConfig,
    options?: { width?: number; height?: number; size?: string }
  ): Promise<string> {
    // Try OpenAI-compatible image generation endpoint first
    // NVIDIA NIM now supports /v1/images/generations for some models
    const baseUrl = provider.baseUrl.replace(/\/$/, '')

    // Try the OpenAI-compatible endpoint
    const url = `${baseUrl}/images/generations`
    const sizeStr = options?.size ?? '1024x1024'

    const body: Record<string, unknown> = {
      model: provider.model || 'stabilityai/stable-diffusion-xl',
      prompt,
      n: 1,
      size: sizeStr,
      response_format: 'b64_json',
    }
    if (negativePrompt) {
      body.negative_prompt = negativePrompt
    }

    const res = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${provider.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    })

    if (res.ok) {
      const data = await res.json()
      const b64 = data.data?.[0]?.b64_json
      if (b64) return b64

      const imgUrl = data.data?.[0]?.url
      if (imgUrl) {
        const imgRes = await fetch(imgUrl)
        const buffer = Buffer.from(await imgRes.arrayBuffer())
        return buffer.toString('base64')
      }

      // Some NVIDIA models return { art: "base64..." }
      if (data.art) return data.art

      throw new Error('NVIDIA image generation returned no data')
    }

    // Fallback: try the legacy SDXL-specific endpoint format
    const legacyUrl = `https://ai.api.nvidia.com/v1/genai/${provider.model || 'stabilityai/stable-diffusion-xl'}`
    const text_prompts: Array<{ text: string; weight: number }> = [
      { text: prompt, weight: 1 },
    ]
    if (negativePrompt) {
      text_prompts.push({ text: negativePrompt, weight: -1 })
    }

    const legacyRes = await fetch(legacyUrl, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${provider.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        text_prompts,
        cfg_scale: 7,
        height: options?.height ?? 1024,
        width: options?.width ?? 1024,
        steps: 50,
        sampler: 'K_DPMPP_2M',
        seed: 0,
      }),
    })

    if (!legacyRes.ok) {
      const text = await legacyRes.text().catch(() => 'Unknown error')
      throw new Error(`NVIDIA Image API error (${legacyRes.status}): ${text.slice(0, 300)}`)
    }

    const legacyData = await legacyRes.json()
    if (!legacyData.art) {
      throw new Error('NVIDIA image generation returned empty result')
    }
    return legacyData.art
  },

  async _generateImageOpenAI(
    prompt: string,
    provider: ProviderConfig,
    options?: { width?: number; height?: number; size?: string }
  ): Promise<string> {
    // Use z-ai-sdk if provider is z-ai-sdk
    if (provider.provider === 'z-ai-sdk') {
      try {
        const ZAI = (await import('z-ai-web-dev-sdk')).default
        const client = await ZAI.create()
        // z-ai-sdk CreateImageGenerationBody only supports: model, prompt, size
        // It does NOT support n, response_format, negative_prompt etc.
        const sizeStr = (options?.size ?? '1024x1024') as
          | '1024x1024'
          | '768x1344'
          | '864x1152'
          | '1344x768'
          | '1152x864'
          | '1440x720'
          | '720x1440'
        const result = await client.images.generations.create({
          model: provider.model || undefined,
          prompt,
          size: sizeStr,
        })
        // z-ai-sdk returns { data: [{ base64: "..." }] }
        const base64 = result?.data?.[0]?.base64
        if (!base64) {
          throw new Error('z-ai-web-dev-sdk 图片生成返回数据为空')
        }
        return base64
      } catch (sdkError) {
        const msg = sdkError instanceof Error ? sdkError.message : String(sdkError)
        if (msg.includes('Configuration file not found') || msg.includes('.z-ai-config')) {
          throw new Error(
            'Z-AI SDK 仅在本地开发环境可用，Vercel 部署环境不支持。' +
            '请在设置中配置其他图片生成供应商（如 SiliconFlow、OpenAI、Stability AI）。'
          )
        }
        throw sdkError
      }
    }

    // OpenAI-compatible endpoint
    const url = provider.baseUrl.endsWith('/images/generations')
      ? provider.baseUrl
      : `${provider.baseUrl.replace(/\/$/, '')}/images/generations`

    const sizeStr = options?.size ?? '1024x1024'

    const res = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${provider.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: provider.model,
        prompt,
        n: 1,
        size: sizeStr,
        response_format: 'b64_json',
      }),
    })

    if (!res.ok) {
      const text = await res.text().catch(() => 'Unknown error')
      throw new Error(`Image API error (${res.status}): ${text.slice(0, 300)}`)
    }

    const data = await res.json()
    const b64 = data.data?.[0]?.b64_json
    if (b64) return b64

    // If url format returned, fetch and convert
    const imgUrl = data.data?.[0]?.url
    if (imgUrl) {
      const imgRes = await fetch(imgUrl)
      const buffer = Buffer.from(await imgRes.arrayBuffer())
      return buffer.toString('base64')
    }

    throw new Error('Image generation returned no data')
  },

  async _generateImageStability(
    prompt: string,
    negativePrompt: string | undefined,
    provider: ProviderConfig,
    options?: { width?: number; height?: number }
  ): Promise<string> {
    const url = `${provider.baseUrl.replace(/\/$/, '')}/generation/${provider.model}/text-to-image`

    const body: Record<string, unknown> = {
      text_prompts: [{ text: prompt, weight: 1 }],
      cfg_scale: 7,
      height: options?.height ?? 1024,
      width: options?.width ?? 1024,
      steps: 30,
    }
    if (negativePrompt) {
      ;(body.text_prompts as Array<{ text: string; weight: number }>).push({
        text: negativePrompt,
        weight: -1,
      })
    }

    const res = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${provider.apiKey}`,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify(body),
    })

    if (!res.ok) {
      const text = await res.text().catch(() => 'Unknown error')
      throw new Error(`Stability API error (${res.status}): ${text.slice(0, 300)}`)
    }

    const data = await res.json()
    const base64 = data.artifacts?.[0]?.base64
    if (!base64) {
      throw new Error('Stability API returned no image data')
    }
    return base64
  },

  async generateCharacterPortrait(
    description: string,
    style?: string,
    characterName?: string,
    personality?: string
  ): Promise<string> {
    // Production-quality character portrait prompt with 6+ dimensions
    // Based on grid_prompt_generator SKILL methodology
    const styleTag = style || 'cinematic'
    const personalityExpression = personality
      ? `expressing ${personality} personality,`
      : ''

    const portraitPrompt = [
      `Professional cinematic character portrait, ${styleTag} aesthetic,`,
      characterName ? `${characterName} —` : '',
      description,
      personalityExpression,
      'dramatic Rembrandt lighting with rim light accent,',
      'rule of thirds composition, centered framing,',
      'shot on ARRI ALEXA 65, f/1.4 aperture, shallow depth of field,',
      'ultra-high detail skin texture, 8K resolution, film grain texture,',
      'character concept art, consistent art style',
    ]
      .filter(Boolean)
      .join(' ')

    const negativePrompt =
      'blurry, low quality, distorted face, extra limbs, deformed, watermark, text, signature, cartoon, anime'

    return this.generateImage(portraitPrompt, negativePrompt, {
      width: 1024,
      height: 1024,
    })
  },

  async generateStoryboardFrame(
    description: string,
    atmosphere?: string,
    shotType?: string,
    cameraAngle?: string,
    style?: string
  ): Promise<string> {
    // Production-quality storyboard frame prompt with 6+ dimensions
    const styleTag = style || 'cinematic'
    const atmosphereTag = atmosphere || 'dramatic'
    const shotTag = shotType || 'medium shot'
    const angleTag = cameraAngle || 'eye-level'

    const framePrompt = [
      `Cinematic film still, ${styleTag} visual style,`,
      description,
      `${atmosphereTag} atmosphere,`,
      `${shotTag}, ${angleTag} angle,`,
      'professional cinematography, shallow depth of field,',
      'shot on RED V-RAPTOR, anamorphic lens,',
      'professional color grading, warm tones,',
      '8K, photorealistic, film grain',
    ]
      .filter(Boolean)
      .join(' ')

    const negativePrompt =
      'blurry, low quality, amateur, cartoon, anime, watermark, text overlay, signature'

    return this.generateImage(framePrompt, negativePrompt, {
      width: 1344,
      height: 768,
    })
  },

  async generateSceneImage(
    location: string,
    timeOfDay?: string,
    style?: string,
    weather?: string
  ): Promise<string> {
    // Production-quality scene/establishing shot prompt with 6+ dimensions
    const styleTag = style || 'cinematic'
    const timeTag = timeOfDay || 'day'
    const weatherTag = weather || ''

    // Map time of day to lighting
    const lightingMap: Record<string, string> = {
      morning: 'soft warm golden light, sunrise glow',
      day: 'bright natural daylight, clear sky',
      afternoon: 'warm afternoon sunlight, long shadows',
      dusk: 'golden hour warm amber tones, sunset glow',
      night: 'cool blue moonlight, dark atmosphere',
      evening: 'warm indoor lighting, soft ambient glow',
    }
    const lighting = lightingMap[timeTag.toLowerCase()] || 'natural lighting'

    const scenePrompt = [
      `Establishing shot, ${styleTag} cinematography,`,
      `${location},`,
      `${lighting},`,
      weatherTag ? `${weatherTag},` : '',
      'no characters, no people, no figures,',
      'wide angle lens, deep depth of field,',
      'professional film production quality,',
      'rich atmospheric details, environmental storytelling,',
      '8K, photorealistic, consistent art style',
    ]
      .filter(Boolean)
      .join(' ')

    const negativePrompt =
      'blurry, low quality, amateur, people, figures, characters, watermark, text overlay, signature'

    return this.generateImage(scenePrompt, negativePrompt, {
      width: 1344,
      height: 768,
    })
  },

  // ---- Video Generation ----

  async generateVideo(
    storyboardId: string,
    prompt: string,
    firstFrameUrl?: string
  ): Promise<void> {
    const provider = await getActiveProvider('video')
    if (!provider) {
      throw new Error('未配置视频生成供应商。请在设置中配置 API Key。')
    }

    // Update status
    await db.storyboard.update({
      where: { id: storyboardId },
      data: { status: 'processing' },
    })

    try {
      let videoUrl = ''

      if (provider.provider === 'z-ai-sdk') {
        videoUrl = await this._generateVideoZai(prompt, firstFrameUrl)
      } else if (provider.provider === 'siliconflow') {
        videoUrl = await this._generateVideoSiliconFlow(prompt, firstFrameUrl, provider)
      } else if (provider.provider === 'seedance') {
        videoUrl = await this._generateVideoSeedance(prompt, firstFrameUrl, provider)
      } else if (provider.provider === 'volcengine') {
        videoUrl = await this._generateVideoVolcengine(prompt, firstFrameUrl, provider)
      } else {
        // Generic: try z-ai-sdk as fallback
        videoUrl = await this._generateVideoZai(prompt, firstFrameUrl)
      }

      await db.storyboard.update({
        where: { id: storyboardId },
        data: { videoUrl, status: 'completed' },
      })
    } catch (error) {
      await db.storyboard.update({
        where: { id: storyboardId },
        data: { status: 'failed' },
      })
      throw error
    }
  },

  async _generateVideoZai(prompt: string, firstFrameUrl?: string): Promise<string> {
    const ZAI = (await import('z-ai-web-dev-sdk')).default
    const client = await ZAI.create()

    const videoRequestBody: Record<string, unknown> = {
      prompt,
      quality: 'speed',
      with_audio: false,
      size: '1344x768',
      fps: 30,
      duration: 5,
    }
    if (firstFrameUrl) {
      videoRequestBody.image_url = firstFrameUrl
    }

    const task = await client.video.generations.create(
      videoRequestBody as import('z-ai-web-dev-sdk').CreateVideoGenerationBody
    )

    const maxPolls = 60
    const pollInterval = 5000
    let result = await client.async.result.query(task.id)
    let pollCount = 0

    while (result.task_status === 'PROCESSING' && pollCount < maxPolls) {
      pollCount++
      await new Promise((resolve) => setTimeout(resolve, pollInterval))
      result = await client.async.result.query(task.id)
    }

    if (result.task_status === 'SUCCESS') {
      const url =
        result.video_result?.[0]?.url ||
        result.video_url ||
        result.url ||
        result.video ||
        ''
      if (!url) throw new Error('Video generation succeeded but no URL was returned')
      return String(url)
    } else {
      throw new Error(
        `Video generation ${result.task_status === 'FAIL' ? 'failed' : 'timed out'}`
      )
    }
  },

  async _generateVideoSiliconFlow(
    prompt: string,
    _firstFrameUrl: string | undefined,
    provider: ProviderConfig
  ): Promise<string> {
    const url = `${provider.baseUrl.replace(/\/$/, '')}/video/submit`

    const res = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${provider.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: provider.model || 'ali-video/video-01',
        prompt,
        image_size: '1344x768',
      }),
    })

    if (!res.ok) {
      const text = await res.text().catch(() => '')
      throw new Error(`SiliconFlow Video API error (${res.status}): ${text.slice(0, 300)}`)
    }

    const data = await res.json()
    const requestId = data.requestId || data.id

    if (!requestId) {
      throw new Error('SiliconFlow video submission returned no request ID')
    }

    // Poll for result
    const statusUrl = `${provider.baseUrl.replace(/\/$/, '')}/video/status/${requestId}`
    const maxPolls = 60
    const pollInterval = 5000

    for (let i = 0; i < maxPolls; i++) {
      await new Promise((resolve) => setTimeout(resolve, pollInterval))
      const statusRes = await fetch(statusUrl, {
        headers: { Authorization: `Bearer ${provider.apiKey}` },
      })
      const statusData = await statusRes.json()

      if (statusData.status === 'Succeed' || statusData.status === 'SUCCESS') {
        return statusData.results?.videos?.[0]?.url || statusData.video_url || ''
      }
      if (statusData.status === 'Failed' || statusData.status === 'FAIL') {
        throw new Error('SiliconFlow video generation failed')
      }
    }

    throw new Error('SiliconFlow video generation timed out')
  },

  async _generateVideoSeedance(
    prompt: string,
    firstFrameUrl: string | undefined,
    provider: ProviderConfig
  ): Promise<string> {
    const baseUrl = provider.baseUrl.replace(/\/$/, '')
    const submitUrl = `${baseUrl}/video/submit`

    const submitBody: Record<string, unknown> = {
      model: provider.model || 'bytedance-seedance/seedance-2.0-pro-250428',
      prompt,
    }

    // Seedance 2.0 supports image-to-video via image_url parameter
    if (firstFrameUrl) {
      submitBody.image_url = firstFrameUrl
    }

    const res = await fetch(submitUrl, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${provider.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(submitBody),
    })

    if (!res.ok) {
      const text = await res.text().catch(() => '')
      throw new Error(`Seedance 2.0 Video API error (${res.status}): ${text.slice(0, 300)}`)
    }

    const data = await res.json()
    const requestId = data.requestId || data.id

    if (!requestId) {
      throw new Error('Seedance 2.0 video submission returned no request ID')
    }

    // Poll for result
    const statusUrl = `${baseUrl}/video/status/${requestId}`
    const maxPolls = 120 // Seedance may take longer
    const pollInterval = 5000

    for (let i = 0; i < maxPolls; i++) {
      await new Promise((resolve) => setTimeout(resolve, pollInterval))
      const statusRes = await fetch(statusUrl, {
        headers: { Authorization: `Bearer ${provider.apiKey}` },
      })
      const statusData = await statusRes.json()

      if (statusData.status === 'Succeed' || statusData.status === 'SUCCESS') {
        const videoUrl =
          statusData.results?.videos?.[0]?.url ||
          statusData.video_url ||
          statusData.results?.content?.[0]?.url ||
          ''
        if (!videoUrl) {
          throw new Error('Seedance 2.0 video generation succeeded but no URL was returned')
        }
        return videoUrl
      }
      if (statusData.status === 'Failed' || statusData.status === 'FAIL') {
        const reason = statusData.reason || statusData.message || 'Unknown reason'
        throw new Error(`Seedance 2.0 video generation failed: ${reason}`)
      }
    }

    throw new Error('Seedance 2.0 video generation timed out')
  },

  async _generateVideoVolcengine(
    prompt: string,
    _firstFrameUrl: string | undefined,
    _provider: ProviderConfig
  ): Promise<string> {
    // Volcengine requires specific SDK, fallback to z-ai-sdk
    return this._generateVideoZai(prompt, _firstFrameUrl)
  },

  // ---- TTS Generation ----

  async generateTts(
    storyboardId: string,
    text: string,
    voiceId?: string,
    voiceStyle?: string
  ): Promise<void> {
    const provider = await getActiveProvider('tts')
    if (!provider) {
      throw new Error('未配置语音合成供应商。请在设置中配置 API Key。')
    }

    await db.storyboard.update({
      where: { id: storyboardId },
      data: { status: 'processing' },
    })

    try {
      let audioDataUrl = ''

      if (provider.provider === 'z-ai-sdk') {
        audioDataUrl = await this._generateTtsZai(text, voiceId)
      } else if (provider.provider === 'openai') {
        audioDataUrl = await this._generateTtsOpenAI(text, voiceId, provider, voiceStyle)
      } else if (provider.provider === 'fish-audio') {
        audioDataUrl = await this._generateTtsFishAudio(text, voiceId, provider)
      } else if (provider.provider === 'nvidia') {
        audioDataUrl = await this._generateTtsNvidia(text, voiceId, provider)
      } else {
        audioDataUrl = await this._generateTtsZai(text, voiceId)
      }

      await db.storyboard.update({
        where: { id: storyboardId },
        data: { ttsAudioUrl: audioDataUrl, status: 'completed' },
      })
    } catch (error) {
      await db.storyboard.update({
        where: { id: storyboardId },
        data: { status: 'failed' },
      })
      throw error
    }
  },

  async _generateTtsZai(text: string, voiceId?: string): Promise<string> {
    try {
      const ZAI = (await import('z-ai-web-dev-sdk')).default
      const client = await ZAI.create()

      // z-ai-sdk TTS: response_format must be 'wav' for non-stream, 'pcm' for stream
      const response = await client.audio.tts.create({
        input: text,
        voice: voiceId || 'tongtong',
        speed: 1.0,
        response_format: 'wav',
        stream: false,
      })

      // The SDK returns a standard Response object
      if (!response || !response.body) {
        throw new Error('z-ai-web-dev-sdk TTS 返回空响应')
      }

      const arrayBuffer = await response.arrayBuffer()
      const buffer = Buffer.from(new Uint8Array(arrayBuffer))
      if (buffer.length === 0) {
        throw new Error('z-ai-web-dev-sdk TTS 返回空音频数据')
      }
      const base64Audio = buffer.toString('base64')
      return `data:audio/wav;base64,${base64Audio}`
    } catch (sdkError) {
      const msg = sdkError instanceof Error ? sdkError.message : String(sdkError)
      if (msg.includes('Configuration file not found') || msg.includes('.z-ai-config')) {
        throw new Error(
          'Z-AI SDK TTS 仅在本地开发环境可用。' +
          '请在设置中配置其他语音合成供应商（如 OpenAI TTS）。'
        )
      }
      throw sdkError
    }
  },

  async _generateTtsOpenAI(
    text: string,
    voiceId: string | undefined,
    provider: ProviderConfig,
    voiceStyle?: string
  ): Promise<string> {
    const url = `${provider.baseUrl.replace(/\/$/, '')}/audio/speech`

    const body: Record<string, unknown> = {
      model: provider.model || 'tts-1',
      input: text,
      voice: voiceId || 'alloy',
      response_format: 'wav',
    }

    // For gpt-4o-mini-tts model, add instructions parameter for voice style/personality
    if (provider.model === 'gpt-4o-mini-tts' && voiceStyle) {
      body.instructions = voiceStyle
    }

    const res = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${provider.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    })

    if (!res.ok) {
      const text = await res.text().catch(() => '')
      throw new Error(`OpenAI TTS API error (${res.status}): ${text.slice(0, 300)}`)
    }

    const buffer = Buffer.from(await res.arrayBuffer())
    const base64Audio = buffer.toString('base64')
    return `data:audio/wav;base64,${base64Audio}`
  },

  async _generateTtsFishAudio(
    text: string,
    voiceId: string | undefined,
    provider: ProviderConfig
  ): Promise<string> {
    const url = `${provider.baseUrl.replace(/\/$/, '')}/tts`

    const res = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${provider.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        text,
        reference_id: voiceId || '',
        format: 'wav',
      }),
    })

    if (!res.ok) {
      const errText = await res.text().catch(() => '')
      throw new Error(`Fish Audio TTS API error (${res.status}): ${errText.slice(0, 300)}`)
    }

    const buffer = Buffer.from(await res.arrayBuffer())
    const base64Audio = buffer.toString('base64')
    return `data:audio/wav;base64,${base64Audio}`
  },

  async _generateTtsNvidia(
    text: string,
    voiceId: string | undefined,
    provider: ProviderConfig
  ): Promise<string> {
    // NVIDIA Riva TTS uses OpenAI-compatible /audio/speech endpoint
    const baseUrl = provider.baseUrl.replace(/\/$/, '')
    const url = `${baseUrl}/audio/speech`

    const res = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${provider.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: provider.model || 'nvidia/riva-tts',
        input: text,
        voice: voiceId || 'default',
        response_format: 'wav',
      }),
    })

    if (!res.ok) {
      const errText = await res.text().catch(() => '')
      throw new Error(`NVIDIA Riva TTS API error (${res.status}): ${errText.slice(0, 300)}`)
    }

    const buffer = Buffer.from(await res.arrayBuffer())
    const base64Audio = buffer.toString('base64')
    return `data:audio/wav;base64,${base64Audio}`
  },

  // ---- Connection Test ----

  async testConnection(category: AiCategory): Promise<{
    success: boolean
    provider?: string
    model?: string
    error?: string
    responsePreview?: string
  }> {
    try {
      const provider = await getActiveProvider(category)
      if (!provider) {
        return {
          success: false,
          error: `未配置 ${category.toUpperCase()} 供应商，请在设置中配置 API Key`,
        }
      }

      if (category === 'llm') {
        const response = await this.chat('Say "OK" and nothing else.', undefined, {
          max_tokens: 10,
          temperature: 0,
        })
        return {
          success: true,
          provider: provider.name,
          model: provider.model,
          responsePreview: response.slice(0, 100),
        }
      }

      // For other categories, just verify API key is set
      return {
        success: true,
        provider: provider.name,
        model: provider.model,
        responsePreview: `${provider.name} API Key 已配置`,
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      }
    }
  },
}

// ============================================================
// JSON Response Parsing (same as before)
// ============================================================

export function parseJsonFromLlmResponse<T = unknown>(text: string): T {
  try {
    return JSON.parse(text) as T
  } catch {
    // continue
  }

  const fenceMatch = text.match(/```(?:json)?\s*\n?([\s\S]*?)\n?\s*```/)
  if (fenceMatch?.[1]) {
    try {
      return JSON.parse(fenceMatch[1]) as T
    } catch {
      // continue
    }
  }

  const objectStart = text.indexOf('{')
  const arrayStart = text.indexOf('[')

  let jsonStart = -1
  if (objectStart !== -1 && arrayStart !== -1) {
    jsonStart = Math.min(objectStart, arrayStart)
  } else if (objectStart !== -1) {
    jsonStart = objectStart
  } else if (arrayStart !== -1) {
    jsonStart = arrayStart
  }

  if (jsonStart !== -1) {
    const opener = text[jsonStart]
    const closer = opener === '{' ? '}' : ']'
    let depth = 0
    let inString = false
    let escape = false

    for (let i = jsonStart; i < text.length; i++) {
      const ch = text[i]

      if (escape) {
        escape = false
        continue
      }

      if (ch === '\\' && inString) {
        escape = true
        continue
      }

      if (ch === '"') {
        inString = !inString
        continue
      }

      if (inString) continue

      if (ch === opener) depth++
      if (ch === closer) depth--

      if (depth === 0) {
        try {
          return JSON.parse(text.slice(jsonStart, i + 1)) as T
        } catch {
          break
        }
      }
    }
  }

  throw new Error(
    `Failed to parse JSON from LLM response. First 500 characters:\n${text.slice(0, 500)}`
  )
}

// ============================================================
// Preset system prompts for common drama-production tasks
// ============================================================

export const AI_SYSTEM_PROMPTS = {
  SCRIPT_REWRITE: `你是一位专业的短剧编剧。你的任务是将原始故事内容改写为格式化的短剧剧本。

改写规则：
1. 保留核心情节和角色关系
2. 增强画面感，将叙述性文字转化为可视化场景描写
3. 用对话驱动情节，减少旁白
4. 每场戏控制在30-60秒
5. 不写镜头语言（景别、角度等），这些属于分镜步骤

格式化剧本格式：
## S编号 | 内景/外景 · 地点 | 时间段

动作描写自然段

角色名：（状态/表情）台词内容

请直接输出改写后的剧本，不要添加其他说明。`,

  EXTRACT: `你是一位专业的短剧分析师。你的任务是从剧本中提取角色和场景信息。

请从剧本中提取所有角色和场景，以JSON格式返回：
{
  "characters": [
    { "name": "角色名", "role": "protagonist/antagonist/supporting/extras", "gender": "male/female/unknown", "appearance": "外貌描写（300-500字详细描述，包含性别、年龄、体型、面部特征、发型、着装）", "personality": "性格特点描述" }
  ],
  "scenes": [
    { "location": "地点名", "timeOfDay": "day/night/dawn/dusk", "description": "场景描述", "prompt": "用于AI图片生成的英文提示词（纯背景，不含人物）" }
  ]
}

只返回JSON，不要添加其他内容。`,

  STORYBOARD: `你是一位专业的短剧分镜师。你的任务是将剧本拆解为分镜镜头。

每个镜头包含以下字段：
- shotNumber: 镜头序号
- title: 镜头标题（3-5字）
- shotType: 景别（close-up/medium/wide/extreme-close-up/medium-close-up/full-shot/long-shot/over-the-shoulder/point-of-view）
- cameraAngle: 角度（eye-level/high-angle/low-angle/dutch-angle/birds-eye/worms-eye）
- cameraMovement: 运镜（static/pan-left/pan-right/tilt-up/tilt-down/zoom-in/zoom-out/dolly-in/dolly-out/tracking/crane-up/handheld）
- action: 画面动作描述（中文）
- dialogue: 对话内容
- dialogueChar: 说话角色名
- duration: 镜头时长（秒，3-15秒）
- imagePrompt: 静态画面英文提示词（用于首帧图片生成，详细描述场景、角色、光照、构图）
- videoPrompt: 视频英文提示词（描述镜头运动和角色动作变化）
- atmosphere: 氛围描述（中文，如紧张、温馨、悬疑等）

请以JSON数组格式返回分镜列表。只返回JSON，不要添加其他内容。`,

  CREATIVE: `你是一位专注于短剧创作的AI助手，擅长写作、分析和创意决策。你的回答应该富有想象力但专业，提供详细、可操作的建议。`,
} as const

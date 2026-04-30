import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { db } from '@/lib/db'
import { getAllProviders, saveProviderConfig, setActiveProvider, PROVIDER_PRESETS, type AiCategory, type ProviderConfig, getExistingProviderConfig } from '@/lib/ai-config'

/**
 * Mask an API key — show only the last 4 characters.
 * Returns empty string if key is empty/falsy.
 */
function maskApiKey(apiKey: string): string {
  if (!apiKey) return ''
  if (apiKey.length <= 4) return '****'
  return `****${apiKey.slice(-4)}`
}

/**
 * Apply masking to provider configs based on user role.
 * Admins see full keys, non-admins see masked keys.
 */
function maskProvidersForRole(
  providers: Record<string, ProviderConfig[]>,
  isAdmin: boolean
): Record<string, ProviderConfig[]> {
  if (isAdmin) return providers

  const masked: Record<string, ProviderConfig[]> = {}
  for (const [category, list] of Object.entries(providers)) {
    masked[category] = list.map((p) => ({
      ...p,
      apiKey: maskApiKey(p.apiKey),
    }))
  }
  return masked
}

// GET /api/settings - Return current settings with provider configs
// Non-admin users receive masked API keys (only last 4 chars visible)
export async function GET() {
  try {
    // Check authentication and role
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: '未登录' }, { status: 401 })
    }

    const userRole = (session.user as any).role as string
    const isAdmin = userRole === 'admin'

    // Get all provider configs from DB
    const providers: Record<string, ProviderConfig[]> = {}
    for (const cat of ['llm', 'image', 'video', 'tts'] as AiCategory[]) {
      providers[cat] = await getAllProviders(cat)
    }

    // Mask API keys for non-admin users
    const maskedProviders = maskProvidersForRole(providers, isAdmin)

    return NextResponse.json({
      providers: maskedProviders,
      presets: PROVIDER_PRESETS,
      isAdmin, // Let frontend know if user is admin
    })
  } catch (error) {
    console.error('Failed to read settings:', error)
    return NextResponse.json(
      { error: 'Failed to read settings' },
      { status: 500 }
    )
  }
}

// POST /api/settings - Save provider configs
// Only admin users can modify provider settings
export async function POST(request: NextRequest) {
  try {
    // Check authentication and role — only admins can save settings
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: '未登录' }, { status: 401 })
    }

    const userRole = (session.user as any).role as string
    if (userRole !== 'admin') {
      return NextResponse.json(
        { error: '权限不足：只有管理员可以修改设置' },
        { status: 403 }
      )
    }

    const data = await request.json()
    const { category, provider, name, apiKey, baseUrl, model, isActive } = data

    if (!category || !provider) {
      return NextResponse.json(
        { error: 'category and provider are required' },
        { status: 400 }
      )
    }

    // If this is being set as active, deactivate others in same category
    if (isActive) {
      await setActiveProvider(category as AiCategory, provider)
    }

    // Only save full config if fields beyond category/provider/isActive are provided
    // This prevents handleSetActive from overwriting previously saved apiKey/baseUrl/model with empty strings
    const hasConfigFields = apiKey !== undefined || baseUrl !== undefined || model !== undefined || name !== undefined
    if (hasConfigFields) {
      // Get existing config to merge (preserve fields not explicitly provided)
      const existing = await getExistingProviderConfig(category as AiCategory, provider)

      // Check if apiKey is a masked value (starts with ****) — if so, preserve existing key
      const isMaskedKey = apiKey && apiKey.startsWith('****')
      const effectiveApiKey = isMaskedKey
        ? (existing?.apiKey || '')
        : (apiKey !== undefined ? (apiKey || existing?.apiKey || '') : (existing?.apiKey || ''))

      await saveProviderConfig({
        category: category as AiCategory,
        provider,
        name: name !== undefined ? (name || existing?.name || provider) : (existing?.name || provider),
        apiKey: effectiveApiKey,
        baseUrl: baseUrl !== undefined ? (baseUrl || existing?.baseUrl || '') : (existing?.baseUrl || ''),
        model: model !== undefined ? (model || existing?.model || '') : (existing?.model || ''),
        isActive: isActive ?? existing?.isActive ?? false,
      })
    }

    // Return updated providers (admin sees full keys since they just saved)
    const providers: Record<string, ProviderConfig[]> = {}
    for (const cat of ['llm', 'image', 'video', 'tts'] as AiCategory[]) {
      providers[cat] = await getAllProviders(cat)
    }

    return NextResponse.json({ providers })
  } catch (error) {
    console.error('Failed to save settings:', error)
    return NextResponse.json(
      { error: 'Failed to save settings' },
      { status: 500 }
    )
  }
}

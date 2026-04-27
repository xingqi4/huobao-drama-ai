import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getAllProviders, saveProviderConfig, setActiveProvider, PROVIDER_PRESETS, type AiCategory } from '@/lib/ai-config'

// GET /api/settings - Return current settings with provider configs
export async function GET() {
  try {
    // Get all provider configs from DB
    const providers: Record<string, Awaited<ReturnType<typeof getAllProviders>>> = {}
    for (const cat of ['llm', 'image', 'video', 'tts'] as AiCategory[]) {
      providers[cat] = await getAllProviders(cat)
    }

    return NextResponse.json({
      providers,
      presets: PROVIDER_PRESETS,
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
export async function POST(request: NextRequest) {
  try {
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

    await saveProviderConfig({
      category: category as AiCategory,
      provider,
      name: name || provider,
      apiKey: apiKey || '',
      baseUrl: baseUrl || '',
      model: model || '',
      isActive: isActive ?? false,
    })

    // Return updated providers
    const providers: Record<string, Awaited<ReturnType<typeof getAllProviders>>> = {}
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

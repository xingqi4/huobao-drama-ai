import { NextRequest, NextResponse } from 'next/server'
import { aiClient } from '@/lib/ai-config'
import type { AiCategory } from '@/lib/ai-config'

// POST /api/ai/test-connection - Test AI provider connectivity
// Body: { category: AiCategory, model?: string }
// If model is provided, temporarily override the active provider's model for testing
export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}))
    const category = (body.category || 'llm') as AiCategory
    const testModel = body.model as string | undefined

    // If a specific model is requested for testing, use it
    if (testModel && category === 'llm') {
      try {
        const response = await aiClient.chat('Say "OK" and nothing else.', undefined, {
          max_tokens: 10,
          temperature: 0,
          model: testModel,
        })
        return NextResponse.json({
          success: true,
          model: testModel,
          responsePreview: response.slice(0, 100),
        })
      } catch (error) {
        return NextResponse.json({
          success: false,
          model: testModel,
          error: error instanceof Error ? error.message : 'Unknown error',
        })
      }
    }

    const result = await aiClient.testConnection(category)
    return NextResponse.json(result)
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Unknown error occurred'

    return NextResponse.json({
      success: false,
      error: message,
    })
  }
}

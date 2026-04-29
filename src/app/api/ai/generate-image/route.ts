import { NextRequest, NextResponse } from 'next/server'
import { aiClient } from '@/lib/ai-config'

// POST /api/ai/generate-image - AI Generate Image (multi-provider)
export async function POST(request: NextRequest) {
  try {
    const { prompt, size, storyboardId, atmosphere } = await request.json()

    if (!prompt) {
      return NextResponse.json(
        { error: 'prompt is required' },
        { status: 400 }
      )
    }

    // Generate image using multi-provider aiClient
    let base64Image: string

    if (storyboardId || atmosphere) {
      base64Image = await aiClient.generateStoryboardFrame(prompt, atmosphere)
    } else {
      const negativePrompt =
        'blurry, low quality, distorted, watermark, text overlay'
      base64Image = await aiClient.generateImage(prompt, negativePrompt, {
        size: size || '1024x1024',
      })
    }

    // Convert base64 to data URL
    const imageUrl = `data:image/png;base64,${base64Image}`

    return NextResponse.json({ imageUrl, prompt })
  } catch (error) {
    console.error('Failed to generate image:', error)
    const message = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json(
      { error: message },
      { status: 500 }
    )
  }
}

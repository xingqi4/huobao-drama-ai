import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { aiClient } from '@/lib/ai-config'

// POST /api/ai/generate-scene-image - AI Generate Scene Image
// Generates an image from a scene's prompt and saves it to the scene record
export async function POST(request: NextRequest) {
  try {
    const { sceneId, style } = await request.json()

    if (!sceneId) {
      return NextResponse.json(
        { error: 'sceneId is required' },
        { status: 400 }
      )
    }

    // Get scene
    const scene = await db.scene.findUnique({
      where: { id: sceneId },
    })

    if (!scene) {
      return NextResponse.json({ error: 'Scene not found' }, { status: 404 })
    }

    // Build prompt from scene info
    const scenePrompt = scene.prompt || [
      'Cinematic establishing shot,',
      style ? `${style} style,` : '',
      scene.location,
      scene.timeOfDay ? `${scene.timeOfDay} lighting,` : '',
      scene.description,
      'professional cinematography, high quality, film still',
    ].filter(Boolean).join(' ')

    if (!scenePrompt.trim()) {
      return NextResponse.json(
        { error: 'Scene has no prompt or description to generate image from' },
        { status: 400 }
      )
    }

    const negativePrompt = 'blurry, low quality, amateur, cartoon, anime, watermark, text overlay, people, characters'

    // Generate scene image
    const base64Image = await aiClient.generateImage(scenePrompt, negativePrompt, {
      width: 1344,
      height: 768,
    })

    // Convert base64 to data URL
    const imageUrl = `data:image/png;base64,${base64Image}`

    // Save imageUrl to scene record
    const updatedScene = await db.scene.update({
      where: { id: sceneId },
      data: { imageUrl },
    })

    return NextResponse.json({ scene: updatedScene, imageUrl })
  } catch (error) {
    console.error('Failed to generate scene image:', error)
    const message = error instanceof Error ? error.message : 'Failed to generate scene image'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

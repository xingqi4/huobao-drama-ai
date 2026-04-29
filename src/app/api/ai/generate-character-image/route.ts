import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { aiClient } from '@/lib/ai-config'

// POST /api/ai/generate-character-image - AI Generate Character Portrait
// Returns a data URL (data:image/png;base64,...) for Vercel compatibility
export async function POST(request: NextRequest) {
  try {
    const { characterId, style } = await request.json()

    if (!characterId) {
      return NextResponse.json(
        { error: 'characterId is required' },
        { status: 400 }
      )
    }

    // Get character
    const character = await db.character.findUnique({
      where: { id: characterId },
    })

    if (!character) {
      return NextResponse.json({ error: 'Character not found' }, { status: 404 })
    }

    // Build description from character appearance
    const appearanceDesc =
      character.appearance || `${character.name}, ${character.gender}`
    const description = [
      appearanceDesc,
      character.personality ? `Personality: ${character.personality}` : '',
    ]
      .filter(Boolean)
      .join('. ')

    // Generate character portrait using aiClient
    const base64Image = await aiClient.generateCharacterPortrait(
      description,
      style || character.role
    )

    // Convert base64 to data URL for Vercel compatibility (no filesystem writes)
    const imageUrl = `data:image/png;base64,${base64Image}`

    // Save imageUrl to character record
    const updatedCharacter = await db.character.update({
      where: { id: characterId },
      data: { imageUrl },
    })

    return NextResponse.json({ character: updatedCharacter, imageUrl })
  } catch (error) {
    console.error('Failed to generate character image:', error)
    return NextResponse.json(
      { error: 'Failed to generate character image' },
      { status: 500 }
    )
  }
}

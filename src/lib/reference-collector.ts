// ============================================================
// Reference Image Collector
// Collects character and scene reference images from the database
// for injection into image generation prompts — the core
// consistency mechanism for maintaining character/scene coherence
// across AI-generated storyboard frames.
// ============================================================

import { db } from '@/lib/db'

export interface CollectedReferences {
  characterImages: Array<{
    name: string
    imageUrl: string
    description: string
  }>
  sceneImages: Array<{
    location: string
    imageUrl: string
    description: string
  }>
  allImageUrls: string[]
}

/**
 * Collect reference images for a storyboard frame.
 * Looks up the episode → drama → characters + scenes,
 * then gathers their reference images.
 *
 * @param episodeId   The episode ID to look up
 * @param dialogueChar  Optional: character name mentioned in dialogue (for prioritized lookup)
 * @param sceneLocation Optional: scene location string (for scene reference lookup)
 */
export async function collectStoryboardReferences(
  episodeId: string,
  dialogueChar?: string,
  sceneLocation?: string
): Promise<CollectedReferences> {
  // 1. Find the episode and drama
  const episode = await db.episode.findUnique({
    where: { id: episodeId },
    select: { dramaId: true },
  })
  if (!episode) return { characterImages: [], sceneImages: [], allImageUrls: [] }

  const dramaId = episode.dramaId

  // 2. Collect character reference images
  const characterImages: CollectedReferences['characterImages'] = []

  // If a specific character is mentioned in dialogue, prioritize their reference
  if (dialogueChar) {
    // Support alias matching (e.g., "顾娘子/顾盼之")
    const characters = await db.character.findMany({
      where: { dramaId, name: { contains: dialogueChar } },
      include: { appearances: { where: { appearanceIndex: 0 }, take: 1 } },
    })

    for (const char of characters) {
      const primaryAppearance = char.appearances[0]
      if (primaryAppearance?.imageUrl) {
        characterImages.push({
          name: char.name,
          imageUrl: primaryAppearance.imageUrl,
          description: primaryAppearance.description || char.appearance,
        })
      } else if (char.imageUrl) {
        characterImages.push({
          name: char.name,
          imageUrl: char.imageUrl,
          description: char.appearance,
        })
      }
    }
  }

  // If no specific character matched, collect ALL character references for this drama
  if (characterImages.length === 0) {
    const allCharacters = await db.character.findMany({
      where: { dramaId },
      include: { appearances: { where: { appearanceIndex: 0 }, take: 1 } },
    })

    for (const char of allCharacters) {
      const primaryAppearance = char.appearances[0]
      if (primaryAppearance?.imageUrl) {
        characterImages.push({
          name: char.name,
          imageUrl: primaryAppearance.imageUrl,
          description: primaryAppearance.description || char.appearance,
        })
      } else if (char.imageUrl) {
        characterImages.push({
          name: char.name,
          imageUrl: char.imageUrl,
          description: char.appearance,
        })
      }
    }
  }

  // 3. Collect scene reference images
  const sceneImages: CollectedReferences['sceneImages'] = []

  if (sceneLocation) {
    const scenes = await db.scene.findMany({
      where: { dramaId, location: { contains: sceneLocation } },
      include: { images: { where: { isSelected: true }, take: 1 } },
    })

    for (const scene of scenes) {
      const selectedImage = scene.images[0]
      if (selectedImage?.imageUrl) {
        sceneImages.push({
          location: scene.location,
          imageUrl: selectedImage.imageUrl,
          description: selectedImage.description || scene.description,
        })
      } else if (scene.imageUrl) {
        sceneImages.push({
          location: scene.location,
          imageUrl: scene.imageUrl,
          description: scene.description,
        })
      }
    }
  }

  // 4. Deduplicate and filter image URLs
  const allImageUrls = Array.from(
    new Set(
      [
        ...characterImages.map((c) => c.imageUrl),
        ...sceneImages.map((s) => s.imageUrl),
      ].filter((url): url is string => Boolean(url && url.trim()))
    )
  )

  return { characterImages, sceneImages, allImageUrls }
}

/**
 * Build an enhanced prompt that includes character/scene descriptions
 * from the collected references. This is used when the image provider
 * does NOT support reference images natively — the text descriptions
 * still help the model maintain some consistency.
 *
 * @param basePrompt   The original image generation prompt
 * @param references   Collected references from collectStoryboardReferences()
 * @returns Enhanced prompt string
 */
export function buildEnhancedPrompt(
  basePrompt: string,
  references: CollectedReferences
): string {
  const parts: string[] = []

  if (references.characterImages.length > 0) {
    const charDescs = references.characterImages
      .map((c) => `${c.name} (${c.description})`)
      .join('; ')
    parts.push(`Characters in scene: [${charDescs}]`)
  }

  if (references.sceneImages.length > 0) {
    const sceneDescs = references.sceneImages
      .map((s) => `${s.location} (${s.description})`)
      .join('; ')
    parts.push(`Scene: [${sceneDescs}]`)
  }

  if (parts.length === 0) return basePrompt

  // Keep the enhanced context concise — don't overload the model
  return `${parts.join('. ')}. ${basePrompt}`
}

/**
 * Collect reference images for character portrait generation.
 * This is used when generating sub-appearances — the primary
 * appearance image can be passed as reference for consistency.
 *
 * @param characterId  The character ID
 * @returns Array of reference image URLs (primary appearance)
 */
export async function collectCharacterReferences(
  characterId: string
): Promise<string[]> {
  const appearances = await db.characterAppearance.findMany({
    where: { characterId, appearanceIndex: 0 },
    take: 1,
  })

  const urls: string[] = []
  const primary = appearances[0]
  if (primary?.imageUrl && primary.imageUrl.trim()) {
    urls.push(primary.imageUrl)
  }

  // Also check character.imageUrl as fallback
  if (urls.length === 0) {
    const character = await db.character.findUnique({
      where: { id: characterId },
      select: { imageUrl: true },
    })
    if (character?.imageUrl && character.imageUrl.trim()) {
      urls.push(character.imageUrl)
    }
  }

  return urls.filter(Boolean)
}

/**
 * Collect reference images for scene image generation.
 * Finds existing selected images for the scene to use as reference.
 *
 * @param sceneId  The scene ID
 * @returns Array of reference image URLs
 */
export async function collectSceneReferences(
  sceneId: string
): Promise<string[]> {
  const images = await db.sceneImage.findMany({
    where: { sceneId, isSelected: true },
    take: 1,
  })

  const urls: string[] = []
  if (images[0]?.imageUrl && images[0].imageUrl.trim()) {
    urls.push(images[0].imageUrl)
  }

  // Also check scene.imageUrl as fallback
  if (urls.length === 0) {
    const scene = await db.scene.findUnique({
      where: { id: sceneId },
      select: { imageUrl: true },
    })
    if (scene?.imageUrl && scene.imageUrl.trim()) {
      urls.push(scene.imageUrl)
    }
  }

  return urls.filter(Boolean)
}

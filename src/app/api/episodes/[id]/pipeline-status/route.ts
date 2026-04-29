import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

// GET /api/episodes/[id]/pipeline-status - Get detailed production pipeline status
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    const episode = await db.episode.findUnique({
      where: { id },
      include: {
        storyboards: { orderBy: { shotNumber: 'asc' } },
      },
    })

    if (!episode) {
      return NextResponse.json({ error: 'Episode not found' }, { status: 404 })
    }

    const storyboards = episode.storyboards
    const total = storyboards.length

    // Script rewrite status
    const scriptRewrite = {
      status: episode.scriptContent
        ? 'done'
        : episode.scriptStatus === 'processing'
          ? 'partial'
          : 'pending',
      hasContent: !!episode.scriptContent?.trim(),
    }

    // Extract characters & scenes
    const characters = await db.character.findMany({
      where: { dramaId: episode.dramaId },
    })
    const scenes = await db.scene.findMany({
      where: { dramaId: episode.dramaId },
    })
    const extractCharacters = {
      status: characters.length > 0 ? 'done' : episode.extractStatus === 'processing' ? 'partial' : 'pending',
      count: characters.length,
    }
    const extractScenes = {
      status: scenes.length > 0 ? 'done' : episode.extractStatus === 'processing' ? 'partial' : 'pending',
      count: scenes.length,
    }

    // Generate images
    const imagesCompleted = storyboards.filter((s) => s.firstFrameUrl).length
    const generateImages = {
      status: imagesCompleted === total && total > 0
        ? 'done'
        : imagesCompleted > 0
          ? 'partial'
          : 'pending',
      completed: imagesCompleted,
      total,
    }

    // Generate videos (no longer requires firstFrameUrl — text-to-video is supported)
    const videosCompleted = storyboards.filter((s) => s.videoUrl).length
    const generateVideos = {
      status: videosCompleted === total && total > 0
        ? 'done'
        : videosCompleted > 0
          ? 'partial'
          : 'pending',
      completed: videosCompleted,
      total,
    }

    // Generate TTS
    const ttsCompleted = storyboards.filter((s) => s.ttsAudioUrl).length
    const dialogueCount = storyboards.filter((s) => s.dialogue).length
    const generateTts = {
      status: dialogueCount > 0 && ttsCompleted >= dialogueCount
        ? 'done'
        : ttsCompleted > 0
          ? 'partial'
          : 'pending',
      completed: ttsCompleted,
      total: dialogueCount,
    }

    // Compose shots
    const composedCompleted = storyboards.filter((s) => s.composedUrl).length
    const composeShots = {
      status: composedCompleted === total && total > 0
        ? 'done'
        : composedCompleted > 0
          ? 'partial'
          : 'pending',
      completed: composedCompleted,
      total,
    }

    // Merge episode
    const mergeEpisode = {
      status: storyboards.every((s) => s.composedUrl) && total > 0 ? 'done' : 'pending',
      mergedUrl: null as string | null,
    }

    return NextResponse.json({
      scriptRewrite,
      extractCharacters,
      extractScenes,
      generateImages,
      generateVideos,
      generateTts,
      composeShots,
      mergeEpisode,
    })
  } catch (error) {
    console.error('Failed to get pipeline status:', error)
    const message = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

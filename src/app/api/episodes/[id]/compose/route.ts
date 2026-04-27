import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

// GET /api/episodes/[id]/compose?storyboardId=xxx
// Returns compositing instructions for client-side audio-video compositing
// This does NOT try to do server-side compositing (no FFmpeg in Vercel)
// Instead, it provides the necessary data for the client to compose using Canvas + Web Audio API
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const { searchParams } = new URL(request.url)
    const storyboardId = searchParams.get('storyboardId')

    if (!storyboardId) {
      return NextResponse.json(
        { error: 'storyboardId query parameter is required' },
        { status: 400 }
      )
    }

    const storyboard = await db.storyboard.findUnique({
      where: { id: storyboardId },
    })

    if (!storyboard) {
      return NextResponse.json(
        { error: 'Storyboard not found' },
        { status: 404 }
      )
    }

    if (!storyboard.videoUrl) {
      return NextResponse.json(
        { error: 'Storyboard has no video URL — cannot compose without video' },
        { status: 400 }
      )
    }

    // Return all the data the client needs for compositing
    return NextResponse.json({
      storyboardId: storyboard.id,
      shotNumber: storyboard.shotNumber,
      title: storyboard.title,
      // Video source
      videoUrl: storyboard.videoUrl,
      // Audio source (TTS)
      audioUrl: storyboard.ttsAudioUrl || null,
      // Subtitle data
      dialogue: storyboard.dialogue || null,
      dialogueChar: storyboard.dialogueChar || null,
      // Duration info
      duration: storyboard.duration || 5,
      // Compositing instructions for client
      composeInstructions: {
        hasVideo: !!storyboard.videoUrl,
        hasAudio: !!storyboard.ttsAudioUrl,
        hasSubtitle: !!storyboard.dialogue,
        // The client should:
        // 1. Create a canvas and draw video frames onto it
        // 2. If audio exists, use Web Audio API to mix video audio + TTS audio
        // 3. If subtitle exists, overlay text on canvas
        // 4. Use MediaRecorder to capture canvas stream + audio stream
        // 5. Save the composed result as a blob URL
        steps: [
          'Load video element with videoUrl',
          storyboard.ttsAudioUrl ? 'Load audio element with audioUrl' : null,
          'Create canvas element (1024x576)',
          'Draw video frames onto canvas with requestAnimationFrame',
          storyboard.dialogue ? 'Overlay subtitle text on canvas' : null,
          storyboard.ttsAudioUrl ? 'Use Web Audio API to create mixed audio stream' : null,
          'Capture canvas stream + audio stream with MediaRecorder',
          'Save composed blob and update storyboard.composedUrl',
        ].filter(Boolean),
      },
    })
  } catch (error) {
    console.error('Failed to get compose data:', error)
    const message = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

// POST /api/episodes/[id]/compose
// Save the composed result URL back to the storyboard
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const { storyboardId, composedUrl } = await request.json()

    if (!storyboardId || !composedUrl) {
      return NextResponse.json(
        { error: 'storyboardId and composedUrl are required' },
        { status: 400 }
      )
    }

    const storyboard = await db.storyboard.update({
      where: { id: storyboardId },
      data: { composedUrl },
    })

    return NextResponse.json({ storyboard })
  } catch (error) {
    console.error('Failed to save composed result:', error)
    const message = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

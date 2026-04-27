import { NextRequest, NextResponse } from 'next/server'
import { aiClient } from '@/lib/ai-config'
import { db } from '@/lib/db'

// POST /api/ai/generate-video - Generate video for a storyboard shot (multi-provider)
// Supports both text-to-video (no firstFrameUrl) and image-to-video (with firstFrameUrl)
// When firstFrameUrl is provided, uses it as the first frame for image-to-video generation
// When firstFrameUrl is absent, uses text-to-video (prompt-only)
export async function POST(request: NextRequest) {
  try {
    const { storyboardId, prompt, firstFrameUrl } = await request.json()

    if (!storyboardId) {
      return NextResponse.json(
        { error: 'storyboardId is required' },
        { status: 400 }
      )
    }

    // Get storyboard from DB
    const storyboard = await db.storyboard.findUnique({
      where: { id: storyboardId },
    })

    if (!storyboard) {
      return NextResponse.json(
        { error: 'Storyboard not found' },
        { status: 404 }
      )
    }

    // Use storyboard's videoPrompt if no prompt provided
    const videoPrompt = prompt || storyboard.videoPrompt || storyboard.action || ''

    if (!videoPrompt) {
      return NextResponse.json(
        { error: 'No prompt provided and storyboard has no video prompt or action' },
        { status: 400 }
      )
    }

    // firstFrameUrl is optional - when present, it's image-to-video; when absent, text-to-video
    const frameUrl = firstFrameUrl || storyboard.firstFrameUrl || undefined

    // Use multi-provider aiClient
    // The aiClient.generateVideo handles both text-to-video and image-to-video
    await aiClient.generateVideo(storyboardId, videoPrompt, frameUrl)

    // Fetch updated storyboard
    const updatedStoryboard = await db.storyboard.findUnique({
      where: { id: storyboardId },
    })

    return NextResponse.json({
      storyboard: updatedStoryboard,
      mode: frameUrl ? 'image-to-video' : 'text-to-video',
    })
  } catch (error) {
    console.error('Failed to generate video:', error)
    const message = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json(
      { error: message },
      { status: 500 }
    )
  }
}

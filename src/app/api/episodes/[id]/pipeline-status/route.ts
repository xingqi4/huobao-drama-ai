import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { isFFmpegAvailable } from '@/lib/ffmpeg'

// Pipeline steps in order:
// raw_content → script_rewrite → character_extract → voice_assign →
// storyboard → character_images → scene_images → dubbing →
// shot_frames → video → compose_merge

interface StepStatus {
  status: 'pending' | 'partial' | 'done'
  label: string
  completed: number
  total: number
  extra?: Record<string, unknown>
}

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

    // ── Step 1: Raw Content ──
    const rawContent: StepStatus = {
      label: '原始内容',
      completed: episode.rawContent?.trim() ? 1 : 0,
      total: 1,
      status: episode.rawContent?.trim() ? 'done' : 'pending',
    }

    // ── Step 2: Script Rewrite ──
    const scriptRewrite: StepStatus = {
      label: '剧本改写',
      completed: episode.scriptContent?.trim() ? 1 : 0,
      total: 1,
      status: episode.scriptContent?.trim()
        ? 'done'
        : episode.scriptStatus === 'processing'
          ? 'partial'
          : 'pending',
      extra: { scriptStatus: episode.scriptStatus },
    }

    // ── Step 3: Character Extract ──
    const characters = await db.character.findMany({
      where: { dramaId: episode.dramaId },
    })
    const characterExtract: StepStatus = {
      label: '角色提取',
      completed: characters.length > 0 ? 1 : 0,
      total: 1,
      status: characters.length > 0
        ? 'done'
        : episode.extractStatus === 'processing'
          ? 'partial'
          : 'pending',
      extra: {
        count: characters.length,
        extractStatus: episode.extractStatus,
      },
    }

    // ── Step 4: Voice Assign ──
    const charactersWithVoice = characters.filter((c) => c.voiceId)
    const voiceAssign: StepStatus = {
      label: '配音分配',
      completed: charactersWithVoice.length,
      total: characters.length,
      status: characters.length > 0 && charactersWithVoice.length >= characters.length
        ? 'done'
        : charactersWithVoice.length > 0
          ? 'partial'
          : 'pending',
    }

    // ── Step 5: Storyboard Generation ──
    const storyboard: StepStatus = {
      label: '分镜生成',
      completed: total > 0 ? 1 : 0,
      total: 1,
      status: total > 0
        ? 'done'
        : episode.storyboardStatus === 'processing'
          ? 'partial'
          : 'pending',
      extra: { count: total, storyboardStatus: episode.storyboardStatus },
    }

    // ── Step 6: Character Images ──
    const charactersWithImage = characters.filter((c) => c.imageUrl)
    const characterImages: StepStatus = {
      label: '角色图片',
      completed: charactersWithImage.length,
      total: characters.length,
      status: characters.length > 0 && charactersWithImage.length >= characters.length
        ? 'done'
        : charactersWithImage.length > 0
          ? 'partial'
          : 'pending',
    }

    // ── Step 7: Scene Images ──
    const scenes = await db.scene.findMany({
      where: { dramaId: episode.dramaId },
      include: { images: true },
    })
    const scenesWithImage = scenes.filter((s) => s.imageUrl || s.images.some((i) => i.imageUrl))
    const sceneImages: StepStatus = {
      label: '场景图片',
      completed: scenesWithImage.length,
      total: scenes.length,
      status: scenes.length > 0 && scenesWithImage.length >= scenes.length
        ? 'done'
        : scenesWithImage.length > 0
          ? 'partial'
          : 'pending',
    }

    // ── Step 8: Dubbing (TTS) ──
    const dialogueCount = storyboards.filter((s) => s.dialogue).length
    const ttsCompleted = storyboards.filter((s) => s.ttsAudioUrl).length
    const dubbing: StepStatus = {
      label: '配音生成',
      completed: ttsCompleted,
      total: dialogueCount,
      status: dialogueCount > 0 && ttsCompleted >= dialogueCount
        ? 'done'
        : ttsCompleted > 0
          ? 'partial'
          : 'pending',
    }

    // ── Step 9: Shot Frames (first frame images) ──
    const framesCompleted = storyboards.filter((s) => s.firstFrameUrl).length
    const shotFrames: StepStatus = {
      label: '镜头图片',
      completed: framesCompleted,
      total,
      status: total > 0 && framesCompleted === total
        ? 'done'
        : framesCompleted > 0
          ? 'partial'
          : 'pending',
    }

    // ── Step 10: Video Generation ──
    const videosCompleted = storyboards.filter((s) => s.videoUrl).length
    const video: StepStatus = {
      label: '视频生成',
      completed: videosCompleted,
      total,
      status: total > 0 && videosCompleted === total
        ? 'done'
        : videosCompleted > 0
          ? 'partial'
          : 'pending',
    }

    // ── Step 11: Compose & Merge ──
    const composedCompleted = storyboards.filter((s) => s.composedUrl).length

    // Check for merge records
    const latestMerge = await db.videoMerge.findFirst({
      where: { episodeId: id },
      orderBy: { createdAt: 'desc' },
    })

    const composeMerge: StepStatus = {
      label: '合成合并',
      completed: composedCompleted,
      total,
      status: total > 0 && composedCompleted === total
        ? 'done'
        : composedCompleted > 0
          ? 'partial'
          : 'pending',
      extra: {
        mergedUrl: episode.videoUrl,
        mergeStatus: latestMerge?.status || null,
        mergeDuration: latestMerge?.duration || 0,
      },
    }

    // ── Overall Pipeline Progress ──
    const steps: StepStatus[] = [
      rawContent,
      scriptRewrite,
      characterExtract,
      voiceAssign,
      storyboard,
      characterImages,
      sceneImages,
      dubbing,
      shotFrames,
      video,
      composeMerge,
    ]

    // Calculate overall progress (weighted)
    const totalWeight = steps.reduce((sum, s) => sum + s.total, 0)
    const completedWeight = steps.reduce((sum, s) => sum + s.completed, 0)
    const overallProgress = totalWeight > 0 ? Math.round((completedWeight / totalWeight) * 100) : 0

    // Find the current active step
    let currentStep = ''
    for (const step of steps) {
      if (step.status === 'partial') {
        currentStep = step.label
        break
      }
      if (step.status === 'pending') {
        currentStep = step.label
        break
      }
    }
    if (!currentStep && steps.every((s) => s.status === 'done')) {
      currentStep = 'completed'
    }

    // FFmpeg availability
    const ffmpegAvailable = await isFFmpegAvailable()

    return NextResponse.json({
      // Detailed steps
      steps: {
        rawContent,
        scriptRewrite,
        characterExtract,
        voiceAssign,
        storyboard,
        characterImages,
        sceneImages,
        dubbing,
        shotFrames,
        video,
        composeMerge,
      },
      // Summary
      summary: {
        totalSteps: steps.length,
        completedSteps: steps.filter((s) => s.status === 'done').length,
        partialSteps: steps.filter((s) => s.status === 'partial').length,
        pendingSteps: steps.filter((s) => s.status === 'pending').length,
        overallProgress,
        currentStep,
      },
      // Environment
      ffmpegAvailable,
      // Legacy compatibility — keep the old format for existing frontend
      scriptRewrite: {
        status: scriptRewrite.status,
        hasContent: scriptRewrite.completed > 0,
      },
      extractCharacters: {
        status: characterExtract.status,
        count: characters.length,
      },
      extractScenes: {
        status: scenes.length > 0 ? 'done' : episode.extractStatus === 'processing' ? 'partial' : 'pending',
        count: scenes.length,
      },
      generateImages: {
        status: shotFrames.status,
        completed: framesCompleted,
        total,
      },
      generateVideos: {
        status: video.status,
        completed: videosCompleted,
        total,
      },
      generateTts: {
        status: dubbing.status,
        completed: ttsCompleted,
        total: dialogueCount,
      },
      composeShots: {
        status: composeMerge.status,
        completed: composedCompleted,
        total,
      },
      mergeEpisode: {
        status: episode.videoUrl ? 'done' : 'pending',
        mergedUrl: episode.videoUrl,
      },
    })
  } catch (error) {
    console.error('Failed to get pipeline status:', error)
    const message = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

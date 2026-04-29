'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useAppStore, type EpisodeDetail, type Character, type Scene, type Storyboard } from '@/lib/store'
import { api } from '@/lib/api'
import { useToast } from '@/hooks/use-toast'
import { AgentExecutionPanel, useAgentExecution } from '@/components/agent-execution-panel'
import { ModelSelector } from '@/components/model-selector'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Textarea } from '@/components/ui/textarea'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import { Progress } from '@/components/ui/progress'
import {
  Collapsible,
  CollapsibleTrigger,
  CollapsibleContent,
} from '@/components/ui/collapsible'
import {
  ArrowLeft,
  Loader2,
  Sparkles,
  FileText,
  Users,
  Film,
  Clapperboard,
  Check,
  ChevronRight,
  Clock,
  Camera,
  Image as ImageIcon,
  Video,
  RefreshCw,
  MapPin,
  UserCircle,
  ChevronDown,
  PanelLeftClose,
  PanelLeftOpen,
  Mic,
  Play,
  Copy,
  Upload,
  Download,
  Wand2,
  Layers,
  Music,
  Eye,
  FileVideo,
  RotateCcw,
  Info,
} from 'lucide-react'

// ── Types ────────────────────────────────────────────────────

type StepKey = 'raw' | 'rewrite' | 'extract' | 'voice' | 'storyboard' | 'production'

interface StepDef {
  key: StepKey
  label: string
  icon: React.ReactNode
  subSteps?: { key: StepKey; label: string }[]
}

// ── Step definitions ─────────────────────────────────────────

const STEPS: StepDef[] = [
  {
    key: 'raw',
    label: '剧本',
    icon: <FileText className="size-4" />,
    subSteps: [
      { key: 'raw', label: '原始内容' },
      { key: 'rewrite', label: 'AI改写' },
    ],
  },
  {
    key: 'extract',
    label: '提取',
    icon: <Users className="size-4" />,
  },
  {
    key: 'voice',
    label: '音色',
    icon: <Mic className="size-4" />,
  },
  {
    key: 'storyboard',
    label: '分镜',
    icon: <Film className="size-4" />,
  },
  {
    key: 'production',
    label: '制作',
    icon: <Clapperboard className="size-4" />,
  },
]

// ── Helpers ──────────────────────────────────────────────────

function statusBadge(status: string) {
  switch (status) {
    case 'completed':
      return <Badge className="status-completed text-[10px] px-1.5 py-0">完成</Badge>
    case 'processing':
      return <Badge className="status-processing text-[10px] px-1.5 py-0 amber-pulse">生成中</Badge>
    case 'failed':
      return <Badge className="status-failed text-[10px] px-1.5 py-0">失败</Badge>
    default:
      return <Badge variant="outline" className="text-[10px] px-1.5 py-0">待处理</Badge>
  }
}

function shotTypeLabel(type: string): string {
  const map: Record<string, string> = {
    'close-up': '特写',
    'medium': '中景',
    'wide': '全景',
    'extreme-close-up': '大特写',
    'medium-close-up': '近景',
    'full-shot': '全景',
    'long-shot': '远景',
    'over-the-shoulder': '过肩',
    'point-of-view': '主观',
  }
  return map[type] ?? type
}

// ── Panel transition ─────────────────────────────────────────

const panelVariants = {
  initial: { opacity: 0, x: 16 },
  animate: { opacity: 1, x: 0 },
  exit: { opacity: 0, x: -16 },
}

// ── Main component ───────────────────────────────────────────

export function EpisodeWorkspace() {
  const {
    selectedDramaId,
    selectedEpisodeId,
    currentEpisode,
    setCurrentEpisode,
    currentDrama,
    navigateToProject,
    aiLoading,
    setAiLoading,
  } = useAppStore()
  const { toast } = useToast()

  const [activeStep, setActiveStep] = useState<StepKey>('raw')
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [rawContent, setRawContent] = useState('')
  const [scriptContent, setScriptContent] = useState('')
  const [characters, setCharacters] = useState<Character[]>([])
  const [scenes, setScenes] = useState<Scene[]>([])
  const [storyboards, setStoryboards] = useState<Storyboard[]>([])
  const [saving, setSaving] = useState(false)
  const [generatingCharImg, setGeneratingCharImg] = useState<string | null>(null)
  const [generatingSceneImg, setGeneratingSceneImg] = useState<string | null>(null)
  const [generatingShotImg, setGeneratingShotImg] = useState<string | null>(null)
  const [generatingVideo, setGeneratingVideo] = useState<string | null>(null)
  const [generatingTts, setGeneratingTts] = useState<string | null>(null)
  const [copiedField, setCopiedField] = useState<string | null>(null)
  const [uploadingField, setUploadingField] = useState<string | null>(null)
  const [generationProgress, setGenerationProgress] = useState<{
    step: string
    message: string
    progress: number
  } | null>(null)

  // Agent execution hook — manages SSE streaming with rich log rendering
  const agentExec = useAgentExecution()
  const [batchProgress, setBatchProgress] = useState<{
    current: number
    total: number
    message: string
  } | null>(null)
  const [generatingAllTts, setGeneratingAllTts] = useState(false)
  const [composing, setComposing] = useState<string | null>(null)
  const [composingAll, setComposingAll] = useState(false)
  const [previewMode, setPreviewMode] = useState(false)
  const [currentPreviewShot, setCurrentPreviewShot] = useState(0)
  const [exporting, setExporting] = useState(false)
  const previewVideoRef = useRef<HTMLVideoElement>(null)
  const previewAudioRef = useRef<HTMLAudioElement>(null)

  // Workspace model selection - persisted in global store + localStorage
  const { workspaceModels, setWorkspaceModel, initWorkspaceModels } = useAppStore()

  // Initialize workspace models from active provider config (only fills empty fields)
  useEffect(() => {
    api.ai.getActiveModels().then((models) => {
      initWorkspaceModels({
        llm: models.llm?.model || '',
        image: models.image?.model || '',
        video: models.video?.model || '',
        tts: models.tts?.model || '',
      })
    }).catch(() => {})
  }, [initWorkspaceModels])

  // ── Fetch episode data ─────────────────────────────────────

  const fetchEpisode = useCallback(async () => {
    if (!selectedEpisodeId) return
    try {
      const detail = await api.episodes.get(selectedEpisodeId)
      setCurrentEpisode(detail)
      // Sync local state from episode
      setRawContent(detail.rawContent ?? '')
      setScriptContent(detail.scriptContent ?? '')
      // Fetch characters & scenes from drama
      if (selectedDramaId) {
        const dramaDetail = await api.dramas.get(selectedDramaId)
        setCharacters(dramaDetail.characters ?? [])
        setScenes(dramaDetail.scenes ?? [])
      }
      setStoryboards(detail.storyboards ?? [])
    } catch (err) {
      toast({ title: '加载集数据失败', description: String(err), variant: 'destructive' })
    }
  }, [selectedEpisodeId, selectedDramaId, setCurrentEpisode, toast])

  useEffect(() => {
    fetchEpisode()
  }, [fetchEpisode])

  // ── Step completion logic ──────────────────────────────────

  const isStepCompleted = useCallback(
    (step: StepKey): boolean => {
      switch (step) {
        case 'raw':
          return !!rawContent.trim()
        case 'rewrite':
          return !!scriptContent.trim()
        case 'extract':
          return characters.length > 0 || scenes.length > 0
        case 'voice':
          return characters.length > 0 && characters.some((c) => c.voiceId)
        case 'storyboard':
          return storyboards.length > 0
        case 'production':
          return storyboards.some((s) => s.composedUrl || s.videoUrl)
        default:
          return false
      }
    },
    [rawContent, scriptContent, characters, scenes, storyboards]
  )

  const completedCount = STEPS.reduce((acc, s) => {
    if (s.subSteps) {
      return acc + s.subSteps.filter((ss) => isStepCompleted(ss.key)).length
    }
    return acc + (isStepCompleted(s.key) ? 1 : 0)
  }, 0)
  const totalSteps = STEPS.reduce((acc, s) => acc + (s.subSteps?.length ?? 1), 0)
  const progressPercent = Math.round((completedCount / totalSteps) * 100)

  // ── Save raw content ───────────────────────────────────────

  const handleSaveRaw = async () => {
    if (!selectedEpisodeId) return
    setSaving(true)
    try {
      await api.episodes.update(selectedEpisodeId, { rawContent })
      toast({ title: '内容已保存' })
      fetchEpisode()
    } catch (err) {
      toast({ title: '保存失败', description: String(err), variant: 'destructive' })
    } finally {
      setSaving(false)
    }
  }

  // ── Save script content ────────────────────────────────────

  const handleSaveScript = async () => {
    if (!selectedEpisodeId) return
    setSaving(true)
    try {
      await api.episodes.update(selectedEpisodeId, { scriptContent })
      toast({ title: '剧本已保存' })
      fetchEpisode()
    } catch (err) {
      toast({ title: '保存失败', description: String(err), variant: 'destructive' })
    } finally {
      setSaving(false)
    }
  }

  // ── AI: Rewrite script (via Agent) ──────────────────────────

  const handleRewrite = async () => {
    if (!selectedEpisodeId || !selectedDramaId) return
    setAiLoading(true)
    try {
      await agentExec.startAgent(
        'script_rewriter',
        selectedEpisodeId,
        selectedDramaId,
        '请将原始内容改写为标准剧本格式，使用read_episode_script工具读取内容，改写后用save_script工具保存。',
        { model: workspaceModels.llm || undefined }
      )
      toast({ title: '剧本改写完成' })
      await fetchEpisode()
      setActiveStep('rewrite')
    } catch (err) {
      toast({ title: '改写失败', description: String(err), variant: 'destructive' })
    } finally {
      setAiLoading(false)
    }
  }

  // ── AI: Skip rewrite (copy raw → script) ───────────────────

  const handleSkipRewrite = async () => {
    if (!selectedEpisodeId) return
    setAiLoading(true)
    try {
      await api.episodes.update(selectedEpisodeId, { scriptContent: rawContent })
      toast({ title: '已使用原始内容作为剧本' })
      await fetchEpisode()
      setActiveStep('rewrite')
    } catch (err) {
      toast({ title: '操作失败', description: String(err), variant: 'destructive' })
    } finally {
      setAiLoading(false)
    }
  }

  // ── AI: Extract (via Agent) ─────────────────────────────────

  const handleExtract = async () => {
    if (!selectedEpisodeId || !selectedDramaId) return
    setAiLoading(true)
    try {
      await agentExec.startAgent(
        'extractor',
        selectedEpisodeId,
        selectedDramaId,
        '请从剧本中提取所有角色和场景信息。先使用read_script_for_extraction读取剧本，再使用read_existing_characters和read_existing_scenes查看已有数据，最后用save_characters和save_scenes保存提取结果（注意去重）.',
        { model: workspaceModels.llm || undefined }
      )
      toast({ title: '角色与场景提取完成' })
      await fetchEpisode()
    } catch (err) {
      toast({ title: '提取失败', description: String(err), variant: 'destructive' })
    } finally {
      setAiLoading(false)
    }
  }

  // ── AI: Voice assign (via Agent) ─────────────────────────────

  const handleVoiceAssign = async () => {
    if (!selectedEpisodeId || !selectedDramaId) return
    setAiLoading(true)
    try {
      await agentExec.startAgent(
        'voice_assigner',
        selectedEpisodeId,
        selectedDramaId,
        '请为所有角色分配合适的TTS音色。先使用get_characters获取角色列表，使用list_available_voices获取可用音色，然后根据角色性别、年龄、性格特征为每个角色分配最合适的音色。',
        { model: workspaceModels.llm || undefined }
      )
      toast({ title: '音色分配完成' })
      await fetchEpisode()
    } catch (err) {
      toast({ title: '音色分配失败', description: String(err), variant: 'destructive' })
    } finally {
      setAiLoading(false)
    }
  }

  // ── AI: Generate storyboard (via Agent) ──────────────────────

  const handleGenerateStoryboard = async () => {
    if (!selectedEpisodeId || !selectedDramaId) return
    setAiLoading(true)
    try {
      await agentExec.startAgent(
        'storyboard_breaker',
        selectedEpisodeId,
        selectedDramaId,
        '请将剧本拆解为分镜序列。先使用read_storyboard_context读取剧本、角色和场景信息，然后为每个镜头生成完整的分镜数据。⚠️重要：每个分镜的imagePrompt必须是6维度专业英文提示词（风格+构图+角色+场景+光线+画质），videoPrompt必须使用3秒分段XML格式。一步到位，无需二次增强。最后用save_storyboards保存所有分镜。',
        { model: workspaceModels.llm || undefined }
      )
      toast({ title: '分镜生成完成' })
      await fetchEpisode()
    } catch (err) {
      toast({ title: '分镜生成失败', description: String(err), variant: 'destructive' })
    } finally {
      setAiLoading(false)
    }
  }

  // ── AI: Enhance single shot prompt (via storyboard_breaker Agent) ──

  const handleEnhanceShotPrompt = async (storyboard: Storyboard) => {
    if (!selectedEpisodeId || !selectedDramaId) return
    setAiLoading(true)
    try {
      await agentExec.startAgent(
        'storyboard_breaker',
        selectedEpisodeId,
        selectedDramaId,
        `请为镜头${storyboard.shotNumber}重新生成更专业的imagePrompt和videoPrompt。先使用read_storyboard_context读取上下文，然后使用update_storyboard更新镜头${storyboard.shotNumber}的提示词。imagePrompt必须包含6个维度（风格+构图+角色+场景+光线+画质），videoPrompt必须使用XML格式。`,
        { model: workspaceModels.llm || undefined }
      )
      toast({ title: `镜头 ${storyboard.shotNumber} 提示词已增强` })
      await fetchEpisode()
    } catch (err) {
      toast({ title: '提示词增强失败', description: String(err), variant: 'destructive' })
    } finally {
      setAiLoading(false)
    }
  }

  // ── AI: Generate scene image ───────────────────────────────

  const handleGenerateSceneImage = async (sceneId: string) => {
    setGeneratingSceneImg(sceneId)
    try {
      await api.ai.generateSceneImage(sceneId)
      toast({ title: '场景图已生成' })
      await fetchEpisode()
    } catch (err) {
      toast({ title: '场景图生成失败', description: String(err), variant: 'destructive' })
    } finally {
      setGeneratingSceneImg(null)
    }
  }

  // ── AI: Generate character image ───────────────────────────

  const handleGenerateCharImage = async (charId: string) => {
    setGeneratingCharImg(charId)
    try {
      await api.ai.generateCharacterImage(charId)
      toast({ title: '角色头像已生成' })
      await fetchEpisode()
    } catch (err) {
      toast({ title: '头像生成失败', description: String(err), variant: 'destructive' })
    } finally {
      setGeneratingCharImg(null)
    }
  }

  // ── AI: Generate shot image ────────────────────────────────

  const handleGenerateShotImage = async (storyboard: Storyboard) => {
    if (!storyboard.imagePrompt) {
      toast({ title: '该镜头没有图片提示词', variant: 'destructive' })
      return
    }
    setGeneratingShotImg(storyboard.id)
    try {
      const result = await api.ai.generateImage(storyboard.imagePrompt, '1024x576')
      await api.storyboards.update(storyboard.id, { firstFrameUrl: result.imageUrl })
      toast({ title: `镜头 ${storyboard.shotNumber} 图片已生成` })
      await fetchEpisode()
    } catch (err) {
      toast({ title: '图片生成失败', description: String(err), variant: 'destructive' })
    } finally {
      setGeneratingShotImg(null)
    }
  }

  // ── AI: Generate all shot images ───────────────────────────

  const handleGenerateAllImages = async () => {
    const pending = storyboards.filter((s) => !s.firstFrameUrl && s.imagePrompt)
    if (pending.length === 0) {
      toast({ title: '没有可生成的镜头图片' })
      return
    }
    setBatchProgress({ current: 0, total: pending.length, message: '生成图片中...' })
    let successCount = 0
    for (let i = 0; i < pending.length; i++) {
      const sb = pending[i]
      setGeneratingShotImg(sb.id)
      setBatchProgress({ current: i + 1, total: pending.length, message: `生成图片 ${i + 1}/${pending.length}...` })
      try {
        const result = await api.ai.generateImage(sb.imagePrompt!, '1024x576')
        await api.storyboards.update(sb.id, { firstFrameUrl: result.imageUrl })
        successCount++
      } catch {
        // Continue with next shot even if one fails
      }
    }
    setGeneratingShotImg(null)
    setBatchProgress(null)
    toast({ title: `${successCount}/${pending.length}个镜头图片生成完毕` })
    await fetchEpisode()
  }

  // ── AI: Generate video for a storyboard ────────────────────

  const handleGenerateVideo = async (storyboard: Storyboard) => {
    if (!storyboard.videoPrompt && !storyboard.imagePrompt) {
      toast({ title: '该镜头没有视频提示词', variant: 'destructive' })
      return
    }
    setGeneratingVideo(storyboard.id)
    try {
      const prompt = storyboard.videoPrompt ?? storyboard.imagePrompt ?? ''
      const result = await api.ai.generateVideo(storyboard.id, prompt, storyboard.firstFrameUrl ?? undefined)
      toast({ title: `镜头 ${storyboard.shotNumber} 视频已生成` })
      await fetchEpisode()
    } catch (err) {
      toast({ title: '视频生成失败', description: String(err), variant: 'destructive' })
    } finally {
      setGeneratingVideo(null)
    }
  }

  // ── AI: Generate TTS for a storyboard ───────────────────────

  const handleGenerateTts = async (storyboard: Storyboard) => {
    if (!storyboard.dialogue) {
      toast({ title: '该镜头没有对白', variant: 'destructive' })
      return
    }
    setGeneratingTts(storyboard.id)
    try {
      // Look up the character's voiceId from the characters state
      let voiceId: string | undefined
      if (storyboard.dialogueChar) {
        const character = characters.find(
          (c) => c.name.toLowerCase() === storyboard.dialogueChar!.toLowerCase()
        )
        if (character?.voiceId) {
          voiceId = character.voiceId
        }
      }
      await api.ai.generateTts(storyboard.id, storyboard.dialogue, voiceId)
      toast({ title: `镜头 ${storyboard.shotNumber} 配音已生成` })
      await fetchEpisode()
    } catch (err) {
      toast({ title: '配音生成失败', description: String(err), variant: 'destructive' })
    } finally {
      setGeneratingTts(null)
    }
  }

  // ── AI: Generate all videos ─────────────────────────────────

  const handleGenerateAllVideos = async () => {
    // Remove firstFrameUrl restriction — text-to-video is now supported
    const pending = storyboards.filter((s) => !s.videoUrl && (s.videoPrompt || s.imagePrompt))
    if (pending.length === 0) {
      toast({ title: '没有可生成的镜头视频（需要镜头有视频提示词）' })
      return
    }
    setBatchProgress({ current: 0, total: pending.length, message: '生成视频中...' })
    let successCount = 0
    for (let i = 0; i < pending.length; i++) {
      const sb = pending[i]
      setGeneratingVideo(sb.id)
      setBatchProgress({ current: i + 1, total: pending.length, message: `生成视频 ${i + 1}/${pending.length}（${sb.firstFrameUrl ? '图生视频' : '文生视频'}）...` })
      try {
        const prompt = sb.videoPrompt ?? sb.imagePrompt ?? ''
        await api.ai.generateVideo(sb.id, prompt, sb.firstFrameUrl ?? undefined)
        successCount++
      } catch {
        // Continue with next shot even if one fails
      }
    }
    setGeneratingVideo(null)
    setBatchProgress(null)
    toast({ title: `${successCount}/${pending.length}个镜头视频生成完毕` })
    await fetchEpisode()
  }

  // ── AI: Generate all extract images (characters + scenes) ───

  const handleGenerateAllExtractImages = async () => {
    const charsPending = characters.filter((c) => !c.imageUrl)
    const scenesPending = scenes.filter((s) => !s.imageUrl)
    const total = charsPending.length + scenesPending.length

    if (total === 0) {
      toast({ title: '所有角色和场景都已有图片' })
      return
    }

    setBatchProgress({ current: 0, total, message: '一键生成图片中...' })
    let successCount = 0

    // Generate character images first
    for (let i = 0; i < charsPending.length; i++) {
      const char = charsPending[i]
      setGeneratingCharImg(char.id)
      setBatchProgress({ current: i + 1, total, message: `生成角色头像 ${i + 1}/${total}...` })
      try {
        await api.ai.generateCharacterImage(char.id)
        successCount++
      } catch {
        // continue
      }
    }
    setGeneratingCharImg(null)

    // Then generate scene images
    for (let i = 0; i < scenesPending.length; i++) {
      const scene = scenesPending[i]
      setGeneratingSceneImg(scene.id)
      setBatchProgress({ current: charsPending.length + i + 1, total, message: `生成场景图 ${charsPending.length + i + 1}/${total}...` })
      try {
        await api.ai.generateSceneImage(scene.id)
        successCount++
      } catch {
        // continue
      }
    }
    setGeneratingSceneImg(null)
    setBatchProgress(null)
    toast({ title: `${successCount}/${total}个图片生成完毕` })
    await fetchEpisode()
  }

  // ── Copy to clipboard ──────────────────────────────────────

  const handleCopy = async (text: string, fieldId: string) => {
    try {
      await navigator.clipboard.writeText(text)
      setCopiedField(fieldId)
      toast({ title: '已复制到剪贴板' })
      setTimeout(() => setCopiedField(null), 2000)
    } catch {
      toast({ title: '复制失败', variant: 'destructive' })
    }
  }

  // ── Upload local file ──────────────────────────────────────

  const handleUpload = async (
    file: File,
    options: {
      storyboardId?: string
      characterId?: string
      sceneId?: string
      fieldType: string
    },
    fieldKey: string
  ) => {
    setUploadingField(fieldKey)
    try {
      await api.upload.file(file, options)
      toast({ title: '上传成功' })
      await fetchEpisode()
    } catch (err) {
      toast({ title: '上传失败', description: String(err), variant: 'destructive' })
    } finally {
      setUploadingField(null)
    }
  }

  // ── Generate all TTS ─────────────────────────────────────────

  const handleGenerateAllTts = async () => {
    const pending = storyboards.filter((s) => s.dialogue && !s.ttsAudioUrl)
    if (pending.length === 0) {
      toast({ title: '没有可生成的配音（需要镜头有对白）' })
      return
    }
    setGeneratingAllTts(true)
    setBatchProgress({ current: 0, total: pending.length, message: '生成配音中...' })
    let successCount = 0
    for (let i = 0; i < pending.length; i++) {
      const sb = pending[i]
      setGeneratingTts(sb.id)
      setBatchProgress({ current: i + 1, total: pending.length, message: `生成配音 ${i + 1}/${pending.length}...` })
      try {
        await api.ai.generateTts(sb.id, sb.dialogue!)
        successCount++
      } catch {
        // Continue with next shot even if one fails
      }
    }
    setGeneratingTts(null)
    setBatchProgress(null)
    setGeneratingAllTts(false)
    toast({ title: `${successCount}/${pending.length}个镜头配音生成完毕` })
    await fetchEpisode()
  }

  // ── Compose a single shot (client-side Canvas + Web Audio + MediaRecorder) ────

  const handleComposeShot = async (storyboard: Storyboard) => {
    if (!storyboard.videoUrl) {
      toast({ title: '该镜头没有视频，无法合成', variant: 'destructive' })
      return
    }
    setComposing(storyboard.id)
    try {
      // Use Canvas + Web Audio API + MediaRecorder for real compositing
      const canvas = document.createElement('canvas')
      canvas.width = 1024
      canvas.height = 576
      const ctx = canvas.getContext('2d')
      if (!ctx) throw new Error('Canvas context not available')

      // Load video
      const videoEl = document.createElement('video')
      videoEl.crossOrigin = 'anonymous'
      videoEl.playsInline = true
      videoEl.muted = true // Mute video element; we'll capture audio separately
      videoEl.src = storyboard.videoUrl

      await new Promise<void>((resolve, reject) => {
        videoEl.onloadeddata = () => resolve()
        videoEl.onerror = () => reject(new Error('Failed to load video'))
      })

      // Setup canvas stream
      const canvasStream = canvas.captureStream(30)

      // Setup audio if TTS exists
      let audioCtx: AudioContext | null = null
      let mixedStream: MediaStream | null = null

      if (storyboard.ttsAudioUrl) {
        try {
          audioCtx = new AudioContext()
          // Create audio sources
          const videoSource = audioCtx.createMediaElementSource(
            Object.assign(document.createElement('video'), {
              crossOrigin: 'anonymous',
              src: storyboard.videoUrl,
            })
          )
          const ttsAudioEl = new Audio(storyboard.ttsAudioUrl)
          const ttsSource = audioCtx.createMediaElementSource(ttsAudioEl)

          // Create destination for mixed audio
          const dest = audioCtx.createMediaStreamDestination()

          // Mix video audio + TTS audio
          videoSource.connect(dest)
          ttsSource.connect(dest)
          videoSource.connect(audioCtx.destination) // For monitoring
          ttsSource.connect(audioCtx.destination)

          // Combine canvas video + mixed audio
          const audioTracks = dest.stream.getAudioTracks()
          const videoTracks = canvasStream.getVideoTracks()
          mixedStream = new MediaStream([...videoTracks, ...audioTracks])
        } catch {
          // If audio mixing fails, just use canvas stream without audio
          console.warn('Audio mixing failed, composing without TTS audio')
        }
      }

      const outputStream = mixedStream || canvasStream

      const recorder = new MediaRecorder(outputStream, {
        mimeType: MediaRecorder.isTypeSupported('video/webm;codecs=vp9')
          ? 'video/webm;codecs=vp9'
          : 'video/webm',
        videoBitsPerSecond: 5000000,
      })

      const chunks: Blob[] = []
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunks.push(e.data)
      }

      const blob = await new Promise<Blob>((resolve, reject) => {
        recorder.onstop = () => {
          resolve(new Blob(chunks, { type: 'video/webm' }))
        }
        recorder.onerror = reject
        recorder.start()
      })

      // Play video and draw frames onto canvas
      videoEl.currentTime = 0
      await new Promise<void>((resolveCompose) => {
        const drawFrame = () => {
          if (videoEl.paused || videoEl.ended) {
            ctx!.drawImage(videoEl, 0, 0, canvas.width, canvas.height)
            // Draw subtitle if dialogue exists
            if (storyboard.dialogue) {
              ctx!.fillStyle = 'rgba(0,0,0,0.6)'
              ctx!.fillRect(0, canvas.height - 60, canvas.width, 60)
              ctx!.fillStyle = 'white'
              ctx!.font = 'bold 20px sans-serif'
              ctx!.textAlign = 'center'
              const subtitleText = storyboard.dialogueChar
                ? `${storyboard.dialogueChar}：${storyboard.dialogue}`
                : storyboard.dialogue
              ctx!.fillText(subtitleText, canvas.width / 2, canvas.height - 25)
            }
            return
          }
          ctx!.drawImage(videoEl, 0, 0, canvas.width, canvas.height)
          // Draw subtitle if dialogue exists
          if (storyboard.dialogue) {
            ctx!.fillStyle = 'rgba(0,0,0,0.6)'
            ctx!.fillRect(0, canvas.height - 60, canvas.width, 60)
            ctx!.fillStyle = 'white'
            ctx!.font = 'bold 20px sans-serif'
            ctx!.textAlign = 'center'
            const subtitleText = storyboard.dialogueChar
              ? `${storyboard.dialogueChar}：${storyboard.dialogue}`
              : storyboard.dialogue
            ctx!.fillText(subtitleText, canvas.width / 2, canvas.height - 25)
          }
          requestAnimationFrame(drawFrame)
        }
        videoEl.onplay = () => drawFrame()
        videoEl.onended = () => {
          // Draw final frame one more time then stop
          drawFrame()
          setTimeout(() => resolveCompose(), 100)
        }
        videoEl.play().catch(() => resolveCompose())
      })

      recorder.stop()
      const composedBlob = await blob

      // Create a blob URL for the composed result
      const composedUrl = URL.createObjectURL(composedBlob)

      // Save to the storyboard
      await api.storyboards.update(storyboard.id, { composedUrl })

      if (audioCtx) {
        audioCtx.close().catch(() => {})
      }

      toast({ title: `镜头 ${storyboard.shotNumber} 已合成（含字幕+配音）` })
      await fetchEpisode()
    } catch (err) {
      toast({ title: '合成失败', description: String(err), variant: 'destructive' })
    } finally {
      setComposing(null)
    }
  }

  // ── Compose all shots ───────────────────────────────────────

  const handleComposeAll = async () => {
    const composable = storyboards.filter((s) => s.videoUrl && !s.composedUrl)
    if (composable.length === 0) {
      toast({ title: '没有可合成的镜头（需要有视频）' })
      return
    }
    setComposingAll(true)
    setBatchProgress({ current: 0, total: composable.length, message: '合成中...' })
    let successCount = 0
    for (let i = 0; i < composable.length; i++) {
      const sb = composable[i]
      setComposing(sb.id)
      setBatchProgress({ current: i + 1, total: composable.length, message: `合成镜头 ${i + 1}/${composable.length}（字幕+配音）...` })
      try {
        // Use the real compositing workflow
        await handleComposeShot(sb)
        successCount++
      } catch {
        // Continue with next shot even if one fails
      }
    }
    setComposing(null)
    setBatchProgress(null)
    setComposingAll(false)
    toast({ title: `${successCount}/${composable.length}个镜头合成完毕` })
    await fetchEpisode()
  }

  // ── Preview all shots in sequence ───────────────────────────

  const handleStartPreview = () => {
    const videoShots = storyboards.filter((s) => s.videoUrl)
    if (videoShots.length === 0) {
      toast({ title: '没有可预览的镜头视频', variant: 'destructive' })
      return
    }
    setCurrentPreviewShot(0)
    setPreviewMode(true)
  }

  const handlePreviewEnded = () => {
    const videoShots = storyboards.filter((s) => s.videoUrl)
    if (currentPreviewShot < videoShots.length - 1) {
      setCurrentPreviewShot((prev) => prev + 1)
    } else {
      setPreviewMode(false)
      setCurrentPreviewShot(0)
    }
  }

  // ── Export final video (client-side canvas + MediaRecorder + audio mixing) ─

  const handleExport = async () => {
    const videoShots = storyboards.filter((s) => s.composedUrl || s.videoUrl)
    if (videoShots.length === 0) {
      toast({ title: '没有可导出的镜头视频', variant: 'destructive' })
      return
    }
    setExporting(true)
    try {
      const canvas = document.createElement('canvas')
      canvas.width = 1024
      canvas.height = 576
      const ctx = canvas.getContext('2d')
      if (!ctx) throw new Error('Canvas context not available')

      const canvasStream = canvas.captureStream(30)

      // Try to create an audio context for mixing
      let audioCtx: AudioContext | null = null
      let mixedStream: MediaStream | null = null

      try {
        audioCtx = new AudioContext()
        const dest = audioCtx.createMediaStreamDestination()
        // Connect all TTS audio tracks
        const audioTracks = dest.stream.getAudioTracks()
        const videoTracks = canvasStream.getVideoTracks()
        if (audioTracks.length > 0) {
          mixedStream = new MediaStream([...videoTracks, ...audioTracks])
        }
      } catch {
        // If AudioContext not available, just use canvas stream
      }

      const outputStream = mixedStream || canvasStream

      const recorder = new MediaRecorder(outputStream, {
        mimeType: MediaRecorder.isTypeSupported('video/webm;codecs=vp9')
          ? 'video/webm;codecs=vp9'
          : 'video/webm',
        videoBitsPerSecond: 5000000,
      })

      const chunks: Blob[] = []
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunks.push(e.data)
      }

      const blob = await new Promise<Blob>((resolve, reject) => {
        recorder.onstop = () => {
          resolve(new Blob(chunks, { type: 'video/webm' }))
        }
        recorder.onerror = reject
        recorder.start()
      })

      // Play each shot video onto the canvas
      const tempVideo = document.createElement('video')
      tempVideo.crossOrigin = 'anonymous'
      tempVideo.playsInline = true
      tempVideo.muted = true

      for (let i = 0; i < videoShots.length; i++) {
        const shot = videoShots[i]
        const videoSource = shot.composedUrl || shot.videoUrl!
        setBatchProgress({
          current: i + 1,
          total: videoShots.length,
          message: `导出镜头 ${i + 1}/${videoShots.length}...`,
        })

        await new Promise<void>((resolveShot) => {
          tempVideo.src = videoSource
          tempVideo.onloadeddata = () => {
            tempVideo.play()
          }
          tempVideo.onended = () => {
            resolveShot()
          }
          tempVideo.onerror = () => {
            resolveShot() // Skip on error
          }

          // Draw frames with subtitle overlay
          const drawFrame = () => {
            if (tempVideo.paused || tempVideo.ended) {
              ctx!.drawImage(tempVideo, 0, 0, canvas.width, canvas.height)
              // Draw subtitle
              if (shot.dialogue) {
                ctx!.fillStyle = 'rgba(0,0,0,0.6)'
                ctx!.fillRect(0, canvas.height - 60, canvas.width, 60)
                ctx!.fillStyle = 'white'
                ctx!.font = 'bold 20px sans-serif'
                ctx!.textAlign = 'center'
                const subtitleText = shot.dialogueChar
                  ? `${shot.dialogueChar}：${shot.dialogue}`
                  : shot.dialogue
                ctx!.fillText(subtitleText, canvas.width / 2, canvas.height - 25)
              }
              return
            }
            ctx!.drawImage(tempVideo, 0, 0, canvas.width, canvas.height)
            // Draw subtitle
            if (shot.dialogue) {
              ctx!.fillStyle = 'rgba(0,0,0,0.6)'
              ctx!.fillRect(0, canvas.height - 60, canvas.width, 60)
              ctx!.fillStyle = 'white'
              ctx!.font = 'bold 20px sans-serif'
              ctx!.textAlign = 'center'
              const subtitleText = shot.dialogueChar
                ? `${shot.dialogueChar}：${shot.dialogue}`
                : shot.dialogue
              ctx!.fillText(subtitleText, canvas.width / 2, canvas.height - 25)
            }
            requestAnimationFrame(drawFrame)
          }
          tempVideo.onplay = () => {
            drawFrame()
          }
        })

        // Small pause between shots
        await new Promise((r) => setTimeout(r, 300))
      }

      recorder.stop()
      const resultBlob = await blob

      if (audioCtx) {
        audioCtx.close().catch(() => {})
      }

      // Download
      const url = URL.createObjectURL(resultBlob)
      const a = document.createElement('a')
      a.href = url
      a.download = `episode-export-${Date.now()}.webm`
      a.click()
      URL.revokeObjectURL(url)

      toast({ title: '视频导出成功（含字幕叠加）' })
    } catch (err) {
      toast({ title: '导出失败', description: String(err), variant: 'destructive' })
    } finally {
      setExporting(false)
      setBatchProgress(null)
    }
  }

  // ── Derive current processing state from episode ───────────

  const episode = currentEpisode as EpisodeDetail | null
  const isRewriting = episode?.scriptStatus === 'processing'
  const isExtracting = episode?.extractStatus === 'processing'
  const isStoryboarding = episode?.storyboardStatus === 'processing'

  // ── Determine sidebar step active state ────────────────────

  const isSidebarStepActive = (step: StepDef): boolean => {
    if (step.subSteps) {
      return step.subSteps.some((ss) => ss.key === activeStep)
    }
    return step.key === activeStep
  }

  // ── Render panel: Raw content ──────────────────────────────

  const renderRawPanel = () => (
    <div className="flex flex-col h-full">
      {/* Toolbar */}
      <div className="flex items-center justify-between px-6 py-3 border-b border-border/50">
        <div className="flex items-center gap-3">
          <span className="text-xs font-mono text-primary/80">01</span>
          <h2 className="text-sm font-semibold">原始内容</h2>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs text-muted-foreground">{rawContent.length} 字</span>
          <Button size="sm" onClick={handleSaveRaw} disabled={saving || !rawContent.trim()}>
            {saving ? <Loader2 className="size-3.5 animate-spin" /> : null}
            保存
          </Button>
        </div>
      </div>

      {/* Text area */}
      <div className="flex-1 p-6">
        {rawContent.trim() || true ? (
          <Textarea
            className="h-full min-h-[60vh] resize-none bg-muted/30 border-border/50 focus-visible:ring-primary/30 text-sm leading-relaxed"
            placeholder="粘贴小说原文、故事大纲或分镜描述..."
            value={rawContent}
            onChange={(e) => setRawContent(e.target.value)}
            onBlur={rawContent.trim() ? handleSaveRaw : undefined}
          />
        ) : null}
      </div>
    </div>
  )

  // ── Render panel: AI Rewrite ───────────────────────────────

  const renderRewritePanel = () => {
    // No script content and not loading → empty state
    if (!scriptContent.trim() && !isRewriting && !aiLoading) {
      return (
        <div className="flex-1 flex items-center justify-center p-6">
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center max-w-md"
          >
            <div className="mx-auto size-16 rounded-full bg-primary/10 flex items-center justify-center mb-5">
              <Sparkles className="size-8 text-primary" />
            </div>
            <h2 className="text-lg font-semibold mb-2">AI改写剧本</h2>
            <p className="text-sm text-muted-foreground mb-6">
              AI将把原始内容改写为标准剧本格式，包含场景描述、对白和动作指示
            </p>
            <div className="flex gap-3 justify-center">
              <Button
                onClick={handleRewrite}
                disabled={!rawContent.trim() || aiLoading}
                className="amber-glow"
              >
                <Sparkles className="size-4" />
                开始改写
              </Button>
              <Button variant="outline" onClick={handleSkipRewrite} disabled={!rawContent.trim()}>
                跳过改写
              </Button>
            </div>
            {!rawContent.trim() && (
              <p className="text-xs text-muted-foreground mt-4">请先在「原始内容」中填写内容</p>
            )}
          </motion.div>
        </div>
      )
    }

    // Loading state — show Agent Execution Panel
    if (isRewriting || (aiLoading && activeStep === 'rewrite')) {
      return (
        <div className="flex-1 p-6 overflow-y-auto">
          <AgentExecutionPanel
            agentType="script_rewriter"
            agentName="剧本改写专家"
            isRunning={agentExec.isRunning('script_rewriter')}
            logs={agentExec.logs['script_rewriter'] || []}
            resultText={agentExec.resultTexts['script_rewriter']}
            duration={agentExec.durations['script_rewriter']}
            error={agentExec.errors['script_rewriter']}
          />
        </div>
      )
    }

    // Content exists → editable textarea
    return (
      <div className="flex flex-col h-full">
        <div className="flex items-center justify-between px-6 py-3 border-b border-border/50">
          <div className="flex items-center gap-3">
            <span className="text-xs font-mono text-primary/80">02</span>
            <h2 className="text-sm font-semibold">AI改写</h2>
            {episode?.scriptStatus && statusBadge(episode.scriptStatus)}
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs text-muted-foreground">{scriptContent.length} 字</span>
            <Button
              size="sm"
              variant="outline"
              onClick={handleRewrite}
              disabled={aiLoading || isRewriting}
            >
              <RefreshCw className="size-3.5" />
              重新改写
            </Button>
            <Button size="sm" onClick={handleSaveScript} disabled={saving}>
              {saving ? <Loader2 className="size-3.5 animate-spin" /> : null}
              保存
            </Button>
          </div>
        </div>
        <div className="flex-1 p-6">
          <Textarea
            className="h-full min-h-[60vh] resize-none bg-muted/30 border-border/50 focus-visible:ring-primary/30 text-sm leading-relaxed font-mono"
            value={scriptContent}
            onChange={(e) => setScriptContent(e.target.value)}
          />
        </div>
      </div>
    )
  }

  // ── Render panel: Extract ──────────────────────────────────

  const renderExtractPanel = () => {
    // Empty state
    if (characters.length === 0 && scenes.length === 0 && !isExtracting && !aiLoading) {
      return (
        <div className="flex-1 flex items-center justify-center p-6">
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center max-w-md"
          >
            <div className="mx-auto size-16 rounded-full bg-primary/10 flex items-center justify-center mb-5">
              <Users className="size-8 text-primary" />
            </div>
            <h2 className="text-lg font-semibold mb-2">提取角色与场景</h2>
            <p className="text-sm text-muted-foreground mb-6">
              AI将从剧本中提取角色信息和场景描述，用于后续分镜制作
            </p>
            <Button
              onClick={handleExtract}
              disabled={!scriptContent.trim() || aiLoading}
              className="amber-glow"
            >
              <Sparkles className="size-4" />
              开始提取
            </Button>
            {!scriptContent.trim() && (
              <p className="text-xs text-muted-foreground mt-4">请先在「AI改写」中完成剧本</p>
            )}
          </motion.div>
        </div>
      )
    }

    // Loading state — show Agent Execution Panel
    if (isExtracting || (aiLoading && activeStep === 'extract')) {
      return (
        <div className="flex-1 p-6 overflow-y-auto">
          <AgentExecutionPanel
            agentType="extractor"
            agentName="角色场景提取器"
            isRunning={agentExec.isRunning('extractor')}
            logs={agentExec.logs['extractor'] || []}
            resultText={agentExec.resultTexts['extractor']}
            duration={agentExec.durations['extractor']}
            error={agentExec.errors['extractor']}
          />
        </div>
      )
    }

    // Content exists
    return (
      <div className="flex flex-col h-full">
        <div className="flex items-center justify-between px-6 py-3 border-b border-border/50">
          <div className="flex items-center gap-3">
            <span className="text-xs font-mono text-primary/80">03</span>
            <h2 className="text-sm font-semibold">提取角色与场景</h2>
            {episode?.extractStatus && statusBadge(episode.extractStatus)}
          </div>
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={handleGenerateAllExtractImages}
              disabled={aiLoading || isExtracting || (!characters.some(c => !c.imageUrl) && !scenes.some(s => !s.imageUrl))}
            >
              {batchProgress ? <Loader2 className="size-3.5 animate-spin" /> : <ImageIcon className="size-3.5" />}
              一键生成图片
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={handleExtract}
              disabled={aiLoading || isExtracting}
            >
              <RefreshCw className="size-3.5" />
              重新提取
            </Button>
          </div>
        </div>

        <ScrollArea className="flex-1">
          <div className="p-6 grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Characters */}
            <div>
              <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
                <UserCircle className="size-4 text-primary" />
                角色列表
                <Badge variant="secondary" className="text-[10px]">{characters.length}</Badge>
              </h3>
              <div className="space-y-3">
                {characters.map((char) => (
                  <Card key={char.id} className="border-border/50 py-0 gap-0">
                    <CardContent className="p-4">
                      <div className="flex gap-3">
                        {/* Avatar */}
                        <div className="flex-shrink-0">
                          {char.imageUrl ? (
                            <img
                              src={char.imageUrl}
                              alt={char.name}
                              className="size-16 rounded-lg object-cover border border-border/50"
                            />
                          ) : (
                            <div className="size-16 rounded-lg bg-muted flex items-center justify-center">
                              <UserCircle className="size-8 text-muted-foreground/50" />
                            </div>
                          )}
                        </div>
                        {/* Info */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="font-semibold text-sm">{char.name}</span>
                            <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                              {char.role === 'protagonist' ? '主角' : char.role === 'antagonist' ? '反派' : char.role === 'supporting' ? '配角' : char.role}
                            </Badge>
                            {char.gender && (
                              <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                                {char.gender}
                              </Badge>
                            )}
                          </div>
                          {char.appearance && (
                            <p className="text-xs text-muted-foreground line-clamp-2">{char.appearance}</p>
                          )}
                          <div className="flex items-center gap-1.5 mt-2 flex-wrap">
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-7 text-xs text-primary hover:text-primary"
                              onClick={() => handleGenerateCharImage(char.id)}
                              disabled={generatingCharImg === char.id}
                            >
                              {generatingCharImg === char.id ? (
                                <Loader2 className="size-3 animate-spin" />
                              ) : (
                                <Camera className="size-3" />
                              )}
                              {char.imageUrl ? '重新生成头像' : '生成头像'}
                            </Button>
                            {char.appearance && (
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-7 text-xs text-muted-foreground hover:text-foreground"
                                onClick={() => handleCopy(char.appearance!, `char-appearance-${char.id}`)}
                              >
                                {copiedField === `char-appearance-${char.id}` ? (
                                  <Check className="size-3 text-emerald-500" />
                                ) : (
                                  <Copy className="size-3" />
                                )}
                                复制外貌描述
                              </Button>
                            )}
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-7 text-xs text-muted-foreground hover:text-foreground"
                              disabled={uploadingField === `char-image-${char.id}`}
                              onClick={() => {
                                const input = document.getElementById(`upload-char-${char.id}`) as HTMLInputElement
                                input?.click()
                              }}
                            >
                              {uploadingField === `char-image-${char.id}` ? (
                                <Loader2 className="size-3 animate-spin" />
                              ) : (
                                <Upload className="size-3" />
                              )}
                              本地上传头像
                            </Button>
                            <input
                              id={`upload-char-${char.id}`}
                              type="file"
                              accept="image/*"
                              className="hidden"
                              onChange={(e) => {
                                const file = e.target.files?.[0]
                                if (file) handleUpload(file, { characterId: char.id, fieldType: 'imageUrl' }, `char-image-${char.id}`)
                                e.target.value = ''
                              }}
                            />
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
                {characters.length === 0 && (
                  <p className="text-xs text-muted-foreground py-4 text-center">暂无角色</p>
                )}
              </div>
            </div>

            {/* Scenes */}
            <div>
              <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
                <MapPin className="size-4 text-primary" />
                场景列表
                <Badge variant="secondary" className="text-[10px]">{scenes.length}</Badge>
              </h3>
              <div className="space-y-3">
                {scenes.map((scene) => (
                  <Card key={scene.id} className="border-border/50 py-0 gap-0">
                    <CardContent className="p-4">
                      <div className="flex items-start gap-3">
                        {scene.imageUrl ? (
                          <img
                            src={scene.imageUrl}
                            alt={scene.location}
                            className="size-16 rounded-lg object-cover border border-border/50 flex-shrink-0"
                          />
                        ) : (
                          <div className="size-16 rounded-lg bg-muted flex items-center justify-center flex-shrink-0">
                            <MapPin className="size-6 text-muted-foreground/50" />
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="font-semibold text-sm">{scene.location}</span>
                            {scene.timeOfDay && (
                              <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                                <Clock className="size-2.5 mr-1" />
                                {scene.timeOfDay}
                              </Badge>
                            )}
                          </div>
                          {scene.description && (
                            <p className="text-xs text-muted-foreground line-clamp-2">{scene.description}</p>
                          )}
                          <div className="flex items-center gap-1.5 mt-2 flex-wrap">
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-7 text-xs text-primary hover:text-primary"
                              onClick={() => handleGenerateSceneImage(scene.id)}
                              disabled={generatingSceneImg === scene.id}
                            >
                              {generatingSceneImg === scene.id ? (
                                <Loader2 className="size-3 animate-spin" />
                              ) : (
                                <Camera className="size-3" />
                              )}
                              {scene.imageUrl ? '重新生成场景图' : '生成场景图'}
                            </Button>
                            {scene.prompt && (
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-7 text-xs text-muted-foreground hover:text-foreground"
                                onClick={() => handleCopy(scene.prompt, `scene-prompt-${scene.id}`)}
                              >
                                {copiedField === `scene-prompt-${scene.id}` ? (
                                  <Check className="size-3 text-emerald-500" />
                                ) : (
                                  <Copy className="size-3" />
                                )}
                                复制场景提示词
                              </Button>
                            )}
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-7 text-xs text-muted-foreground hover:text-foreground"
                              disabled={uploadingField === `scene-image-${scene.id}`}
                              onClick={() => {
                                const input = document.getElementById(`upload-scene-${scene.id}`) as HTMLInputElement
                                input?.click()
                              }}
                            >
                              {uploadingField === `scene-image-${scene.id}` ? (
                                <Loader2 className="size-3 animate-spin" />
                              ) : (
                                <Upload className="size-3" />
                              )}
                              上传场景图
                            </Button>
                            <input
                              id={`upload-scene-${scene.id}`}
                              type="file"
                              accept="image/*"
                              className="hidden"
                              onChange={(e) => {
                                const file = e.target.files?.[0]
                                if (file) handleUpload(file, { sceneId: scene.id, fieldType: 'imageUrl' }, `scene-image-${scene.id}`)
                                e.target.value = ''
                              }}
                            />
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
                {scenes.length === 0 && (
                  <p className="text-xs text-muted-foreground py-4 text-center">暂无场景</p>
                )}
              </div>
            </div>
          </div>
        </ScrollArea>
      </div>
    )
  }

  // ── Render panel: Voice Assignment ──────────────────────────

  const renderVoicePanel = () => {
    const hasVoices = characters.some((c) => c.voiceId)

    // Empty state - no characters yet
    if (characters.length === 0 && !aiLoading) {
      return (
        <div className="flex-1 flex items-center justify-center p-6">
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center max-w-md"
          >
            <div className="mx-auto size-16 rounded-full bg-primary/10 flex items-center justify-center mb-5">
              <Mic className="size-8 text-primary" />
            </div>
            <h2 className="text-lg font-semibold mb-2">音色分配</h2>
            <p className="text-sm text-muted-foreground mb-6">
              请先完成角色提取，AI将为每个角色分配合适的TTS音色
            </p>
            <p className="text-xs text-muted-foreground">请先在「提取」步骤中完成角色提取</p>
          </motion.div>
        </div>
      )
    }

    // Loading state — show Agent Execution Panel
    if (aiLoading && activeStep === 'voice') {
      return (
        <div className="flex-1 p-6 overflow-y-auto">
          <AgentExecutionPanel
            agentType="voice_assigner"
            agentName="音色分配师"
            isRunning={agentExec.isRunning('voice_assigner')}
            logs={agentExec.logs['voice_assigner'] || []}
            resultText={agentExec.resultTexts['voice_assigner']}
            duration={agentExec.durations['voice_assigner']}
            error={agentExec.errors['voice_assigner']}
          />
        </div>
      )
    }

    // Content exists
    return (
      <div className="flex flex-col h-full">
        <div className="flex items-center justify-between px-6 py-3 border-b border-border/50">
          <div className="flex items-center gap-3">
            <span className="text-xs font-mono text-primary/80">04</span>
            <h2 className="text-sm font-semibold">音色分配</h2>
            {hasVoices && <Badge className="status-completed text-[10px] px-1.5 py-0">已分配</Badge>}
          </div>
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              onClick={handleVoiceAssign}
              disabled={aiLoading || characters.length === 0}
              className="amber-glow"
            >
              <Sparkles className="size-3.5" />
              AI分配音色
            </Button>
          </div>
        </div>

        <ScrollArea className="flex-1">
          <div className="p-6 space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {characters.map((char) => (
                <Card key={char.id} className="border-border/50">
                  <CardContent className="p-4">
                    <div className="flex items-start gap-3">
                      {/* Character avatar */}
                      <div className="size-12 rounded-full bg-muted flex items-center justify-center overflow-hidden shrink-0">
                        {char.imageUrl ? (
                          <img src={char.imageUrl} alt={char.name} className="size-full object-cover" />
                        ) : (
                          <UserCircle className="size-8 text-muted-foreground" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-medium text-sm">{char.name}</span>
                          <Badge variant="outline" className="text-[10px] px-1 py-0">
                            {char.gender === 'male' ? '男' : char.gender === 'female' ? '女' : '未知'}
                          </Badge>
                          {char.role && (
                            <Badge variant="outline" className="text-[10px] px-1 py-0">
                              {char.role === 'protagonist' ? '主角' : char.role === 'antagonist' ? '反派' : char.role === 'supporting' ? '配角' : '龙套'}
                            </Badge>
                          )}
                        </div>
                        {char.personality && (
                          <p className="text-xs text-muted-foreground mb-2 truncate">{char.personality}</p>
                        )}
                        <div className="flex items-center gap-2">
                          {char.voiceId ? (
                            <div className="flex items-center gap-1.5 text-xs text-green-600">
                              <Mic className="size-3" />
                              <span>已分配: {char.voiceId}</span>
                            </div>
                          ) : (
                            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                              <Mic className="size-3" />
                              <span>未分配</span>
                            </div>
                          )}
                          {char.voiceStyle && (
                            <span className="text-xs text-muted-foreground">· {char.voiceStyle}</span>
                          )}
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>

            {characters.length === 0 && (
              <div className="text-center py-8 text-muted-foreground text-sm">
                暂无角色数据，请先完成角色提取
              </div>
            )}
          </div>
        </ScrollArea>
      </div>
    )
  }

  // ── Render panel: Storyboard ───────────────────────────────

  const renderStoryboardPanel = () => {
    // Empty state
    if (storyboards.length === 0 && !isStoryboarding && !aiLoading) {
      return (
        <div className="flex-1 flex items-center justify-center p-6">
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center max-w-md"
          >
            <div className="mx-auto size-16 rounded-full bg-primary/10 flex items-center justify-center mb-5">
              <Film className="size-8 text-primary" />
            </div>
            <h2 className="text-lg font-semibold mb-2">生成分镜</h2>
            <p className="text-sm text-muted-foreground mb-6">
              AI将把剧本拆解为单独的镜头，包含景别、运镜、动作描述和对白
            </p>
            <Button
              onClick={handleGenerateStoryboard}
              disabled={!scriptContent.trim() || aiLoading}
              className="amber-glow"
            >
              <Sparkles className="size-4" />
              开始生成分镜
            </Button>
            {!scriptContent.trim() && (
              <p className="text-xs text-muted-foreground mt-4">请先在「AI改写」中完成剧本</p>
            )}
          </motion.div>
        </div>
      )
    }

    // Loading state — show Agent Execution Panel
    if (isStoryboarding || (aiLoading && activeStep === 'storyboard')) {
      return (
        <div className="flex-1 p-6 overflow-y-auto">
          <AgentExecutionPanel
            agentType="storyboard_breaker"
            agentName="分镜拆解专家"
            isRunning={agentExec.isRunning('storyboard_breaker')}
            logs={agentExec.logs['storyboard_breaker'] || []}
            resultText={agentExec.resultTexts['storyboard_breaker']}
            duration={agentExec.durations['storyboard_breaker']}
            error={agentExec.errors['storyboard_breaker']}
          />
        </div>
      )
    }

    // Derived data for toolbar
    const pendingImageShots = storyboards.filter((s) => !s.firstFrameUrl && s.imagePrompt)
    // Text-to-video is now supported — no firstFrameUrl requirement
    const pendingVideoShots = storyboards.filter((s) => !s.videoUrl && (s.videoPrompt || s.imagePrompt))
    const t2vShots = pendingVideoShots.filter((s) => !s.firstFrameUrl)
    const i2vShots = pendingVideoShots.filter((s) => s.firstFrameUrl)

    // Storyboard cards with media preview + action buttons
    return (
      <div className="flex flex-col h-full">
        <div className="flex items-center justify-between px-6 py-3 border-b border-border/50 flex-wrap gap-2">
          <div className="flex items-center gap-3">
            <span className="text-xs font-mono text-primary/80">05</span>
            <h2 className="text-sm font-semibold">分镜列表</h2>
            <Badge variant="secondary" className="text-[10px]">{storyboards.length} 镜</Badge>
            {episode?.storyboardStatus && statusBadge(episode.storyboardStatus)}
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {batchProgress && (
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Loader2 className="size-3 animate-spin" />
                <span>{batchProgress.message}</span>
                <Progress value={(batchProgress.current / batchProgress.total) * 100} className="h-1.5 w-20" />
              </div>
            )}
            {pendingVideoShots.length > 0 && (
              <Button
                size="sm"
                variant="outline"
                onClick={handleGenerateAllVideos}
                disabled={!!generatingVideo || !!generatingShotImg}
                className="amber-glow"
              >
                {generatingVideo ? <Loader2 className="size-3.5 animate-spin" /> : <Video className="size-3.5" />}
                生成全部视频
                <Badge variant="secondary" className="text-[9px] px-1 py-0 ml-1">
                  {pendingVideoShots.length}
                  {t2vShots.length > 0 && ` (文${t2vShots.length}+图${i2vShots.length})`}
                </Badge>
              </Button>
            )}
            {pendingImageShots.length > 0 && (
              <Button
                size="sm"
                variant="outline"
                onClick={handleGenerateAllImages}
                disabled={!!generatingShotImg || !!generatingVideo}
                className="amber-glow"
              >
                {generatingShotImg ? <Loader2 className="size-3.5 animate-spin" /> : <ImageIcon className="size-3.5" />}
                生成全部图片
              </Button>
            )}
            <Button
              size="sm"
              variant="outline"
              onClick={handleGenerateStoryboard}
              disabled={aiLoading || isStoryboarding}
            >
              <RefreshCw className="size-3.5" />
              重新生成
            </Button>
          </div>
        </div>

        <ScrollArea className="flex-1">
          <div className="p-6 space-y-4">
            {storyboards.map((sb) => (
              <Card key={sb.id} className="border-border/50 py-0 gap-0">
                <CardContent className="p-4">
                  {/* Shot header */}
                  <div className="flex items-start gap-3 mb-3">
                    <div className="flex-shrink-0 size-9 rounded bg-primary/10 flex items-center justify-center">
                      <span className="text-xs font-bold text-primary">
                        {String(sb.shotNumber).padStart(2, '0')}
                      </span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h4 className="text-sm font-semibold">{sb.title}</h4>
                        <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                          {shotTypeLabel(sb.shotType)}
                        </Badge>
                        {sb.cameraAngle && (
                          <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                            {sb.cameraAngle}
                          </Badge>
                        )}
                        {sb.cameraMovement && (
                          <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                            {sb.cameraMovement}
                          </Badge>
                        )}
                        {sb.duration > 0 && (
                          <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                            <Clock className="size-2.5" />
                            {sb.duration}s
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">{sb.action}</p>
                    </div>
                  </div>

                  {/* Media preview area */}
                  <div className="ml-12 mb-3">
                    {(sb.videoUrl || sb.firstFrameUrl) ? (
                      <div className="relative rounded-lg overflow-hidden border border-border/50 max-w-sm">
                        {sb.videoUrl ? (
                          <video
                            src={sb.videoUrl}
                            controls
                            className="w-full aspect-video object-cover"
                            poster={sb.firstFrameUrl ?? undefined}
                          />
                        ) : (
                          <img
                            src={sb.firstFrameUrl!}
                            alt={`镜头 ${sb.shotNumber}`}
                            className="w-full aspect-video object-cover"
                          />
                        )}
                        {(generatingShotImg === sb.id || generatingVideo === sb.id) && (
                          <div className="absolute inset-0 bg-background/60 flex items-center justify-center">
                            <div className="text-center">
                              <Loader2 className="size-6 text-primary animate-spin mx-auto mb-1" />
                              <p className="text-[10px] text-muted-foreground">
                                {generatingVideo === sb.id ? '生成视频中...' : '生成图片中...'}
                              </p>
                            </div>
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="max-w-sm aspect-video rounded-lg bg-muted/50 border border-dashed border-border/50 flex items-center justify-center">
                        <div className="text-center">
                          <Camera className="size-6 text-muted-foreground/30 mx-auto mb-1" />
                          <p className="text-[10px] text-muted-foreground/50">暂无素材</p>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Status indicators */}
                  <div className="ml-12 mb-3 flex items-center gap-2 flex-wrap">
                    {sb.firstFrameUrl ? (
                      <Badge className="status-completed text-[9px] px-1.5 py-0 gap-0.5">
                        <Check className="size-2.5" /> 图片
                      </Badge>
                    ) : null}
                    {sb.videoUrl ? (
                      <Badge className="status-completed text-[9px] px-1.5 py-0 gap-0.5">
                        <Check className="size-2.5" /> 视频
                      </Badge>
                    ) : null}
                    {sb.ttsAudioUrl ? (
                      <Badge className="status-completed text-[9px] px-1.5 py-0 gap-0.5">
                        <Check className="size-2.5" /> 配音
                      </Badge>
                    ) : null}
                    {!sb.firstFrameUrl && !sb.videoUrl && !sb.ttsAudioUrl && (
                      <Badge variant="outline" className="text-[9px] px-1.5 py-0">待生成</Badge>
                    )}
                  </div>

                  {/* Quick action buttons row */}
                  <div className="ml-12 mb-3 flex items-center gap-1.5 flex-wrap">
                    {!sb.firstFrameUrl && sb.imagePrompt && (
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => handleGenerateShotImage(sb)}
                        disabled={generatingShotImg === sb.id}
                        className="h-7 text-[11px] px-2.5"
                      >
                        {generatingShotImg === sb.id ? (
                          <Loader2 className="size-3 animate-spin" />
                        ) : (
                          <ImageIcon className="size-3" />
                        )}
                        生成图片
                      </Button>
                    )}
                    {/* Generate Video — works with OR without firstFrameUrl */}
                    {!sb.videoUrl && (sb.videoPrompt || sb.imagePrompt) && (
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => handleGenerateVideo(sb)}
                        disabled={generatingVideo === sb.id}
                        className="h-7 text-[11px] px-2.5 amber-glow"
                      >
                        {generatingVideo === sb.id ? (
                          <Loader2 className="size-3 animate-spin" />
                        ) : (
                          <Video className="size-3" />
                        )}
                        {sb.firstFrameUrl ? '图生视频' : '文生视频'}
                      </Button>
                    )}
                    {sb.videoUrl && (sb.videoPrompt || sb.imagePrompt) && (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleGenerateVideo(sb)}
                        disabled={generatingVideo === sb.id}
                        className="h-7 text-[11px] px-2.5 text-primary hover:text-primary"
                      >
                        {generatingVideo === sb.id ? (
                          <Loader2 className="size-3 animate-spin" />
                        ) : (
                          <RefreshCw className="size-3" />
                        )}
                        重新生成视频
                      </Button>
                    )}
                    {sb.dialogue && !sb.ttsAudioUrl && (
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => handleGenerateTts(sb)}
                        disabled={generatingTts === sb.id}
                        className="h-7 text-[11px] px-2.5"
                      >
                        {generatingTts === sb.id ? (
                          <Loader2 className="size-3 animate-spin" />
                        ) : (
                          <Mic className="size-3" />
                        )}
                        生成配音
                      </Button>
                    )}
                    {/* Upload buttons */}
                    {!sb.firstFrameUrl && (
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 text-[11px] px-2.5 text-muted-foreground hover:text-foreground"
                        disabled={uploadingField === `sb-img-${sb.id}`}
                        onClick={() => {
                          const input = document.getElementById(`upload-sb-img-${sb.id}`) as HTMLInputElement
                          input?.click()
                        }}
                      >
                        {uploadingField === `sb-img-${sb.id}` ? (
                          <Loader2 className="size-3 animate-spin" />
                        ) : (
                          <Upload className="size-3" />
                        )}
                        上传图片
                      </Button>
                    )}
                    {sb.firstFrameUrl && !sb.videoUrl && (
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 text-[11px] px-2.5 text-muted-foreground hover:text-foreground"
                        disabled={uploadingField === `sb-vid-${sb.id}`}
                        onClick={() => {
                          const input = document.getElementById(`upload-sb-vid-${sb.id}`) as HTMLInputElement
                          input?.click()
                        }}
                      >
                        {uploadingField === `sb-vid-${sb.id}` ? (
                          <Loader2 className="size-3 animate-spin" />
                        ) : (
                          <Upload className="size-3" />
                        )}
                        上传视频
                      </Button>
                    )}
                    {/* Hidden file inputs */}
                    <input
                      id={`upload-sb-img-${sb.id}`}
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0]
                        if (file) handleUpload(file, { storyboardId: sb.id, fieldType: 'firstFrameUrl' }, `sb-img-${sb.id}`)
                        e.target.value = ''
                      }}
                    />
                    <input
                      id={`upload-sb-vid-${sb.id}`}
                      type="file"
                      accept="video/*"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0]
                        if (file) handleUpload(file, { storyboardId: sb.id, fieldType: 'videoUrl' }, `sb-vid-${sb.id}`)
                        e.target.value = ''
                      }}
                    />
                  </div>

                  {/* TTS Audio player */}
                  {sb.ttsAudioUrl && (
                    <div className="ml-12 mb-3 flex items-center gap-2">
                      <Mic className="size-3 text-primary/70 flex-shrink-0" />
                      <audio
                        src={sb.ttsAudioUrl}
                        controls
                        className="h-6 flex-1 [&::-webkit-media-controls-panel]:bg-muted/50"
                        style={{ minWidth: 0 }}
                      />
                    </div>
                  )}

                  {/* Dialogue */}
                  {sb.dialogue && (
                    <div className="ml-12 mb-2 pl-3 border-l-2 border-primary/30">
                      <div className="flex items-start gap-1.5">
                        <p className="text-xs text-muted-foreground italic flex-1">
                          {sb.dialogueChar && <span className="font-medium not-italic text-foreground/80">{sb.dialogueChar}：</span>}
                          {sb.dialogue}
                        </p>
                        <button
                          onClick={() => handleCopy(sb.dialogue!, `sb-dialogue-${sb.id}`)}
                          className="flex-shrink-0 p-0.5 rounded hover:bg-muted/50 text-muted-foreground hover:text-foreground transition-colors"
                          title="复制对白"
                        >
                          {copiedField === `sb-dialogue-${sb.id}` ? (
                            <Check className="size-3 text-emerald-500" />
                          ) : (
                            <Copy className="size-3" />
                          )}
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Collapsible prompts + enhance button */}
                  <div className="ml-12 space-y-1">
                    {(sb.imagePrompt || sb.videoPrompt) && (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleEnhanceShotPrompt(sb)}
                        disabled={aiLoading}
                        className="h-6 text-[10px] px-2 text-primary/70 hover:text-primary gap-1 mb-1"
                      >
                        <Wand2 className="size-3" />
                        AI增强提示词
                      </Button>
                    )}
                    {!sb.imagePrompt && !sb.videoPrompt && (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleEnhanceShotPrompt(sb)}
                        disabled={aiLoading}
                        className="h-6 text-[10px] px-2 text-primary/70 hover:text-primary gap-1 mb-1"
                      >
                        <Wand2 className="size-3" />
                        生成提示词
                      </Button>
                    )}
                    {sb.imagePrompt && (
                      <Collapsible>
                        <CollapsibleTrigger className="flex items-center gap-1.5 text-[11px] text-muted-foreground hover:text-foreground transition-colors">
                          <ChevronDown className="size-3" />
                          <ImageIcon className="size-3" />
                          图片提示词
                        </CollapsibleTrigger>
                        <CollapsibleContent>
                          <div className="flex items-start gap-1.5 mt-1">
                            <p className="text-xs text-muted-foreground bg-muted/30 rounded p-2 flex-1">
                              {sb.imagePrompt}
                            </p>
                            <button
                              onClick={() => handleCopy(sb.imagePrompt!, `sb-img-${sb.id}`)}
                              className="flex-shrink-0 p-1 rounded hover:bg-muted/50 text-muted-foreground hover:text-foreground transition-colors"
                              title="复制"
                            >
                              {copiedField === `sb-img-${sb.id}` ? (
                                <Check className="size-3 text-emerald-500" />
                              ) : (
                                <Copy className="size-3" />
                              )}
                            </button>
                          </div>
                        </CollapsibleContent>
                      </Collapsible>
                    )}
                    {sb.videoPrompt && (
                      <Collapsible>
                        <CollapsibleTrigger className="flex items-center gap-1.5 text-[11px] text-muted-foreground hover:text-foreground transition-colors">
                          <ChevronDown className="size-3" />
                          <Video className="size-3" />
                          视频提示词
                        </CollapsibleTrigger>
                        <CollapsibleContent>
                          <div className="flex items-start gap-1.5 mt-1">
                            <p className="text-xs text-muted-foreground bg-muted/30 rounded p-2 flex-1">
                              {sb.videoPrompt}
                            </p>
                            <button
                              onClick={() => handleCopy(sb.videoPrompt!, `sb-vid-${sb.id}`)}
                              className="flex-shrink-0 p-1 rounded hover:bg-muted/50 text-muted-foreground hover:text-foreground transition-colors"
                              title="复制"
                            >
                              {copiedField === `sb-vid-${sb.id}` ? (
                                <Check className="size-3 text-emerald-500" />
                              ) : (
                                <Copy className="size-3" />
                              )}
                            </button>
                          </div>
                        </CollapsibleContent>
                      </Collapsible>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </ScrollArea>
      </div>
    )
  }

  // ── Render panel: Production ───────────────────────────────

  const renderProductionPanel = () => {
    const hasAnyStoryboard = storyboards.length > 0
    const totalShots = storyboards.length
    const shotsWithImage = storyboards.filter((s) => s.firstFrameUrl).length
    const shotsWithVideo = storyboards.filter((s) => s.videoUrl).length
    const shotsWithTts = storyboards.filter((s) => s.ttsAudioUrl).length
    const shotsComposed = storyboards.filter((s) => s.composedUrl).length
    const shotsWithDialogue = storyboards.filter((s) => s.dialogue).length
    const pendingTtsShots = storyboards.filter((s) => s.dialogue && !s.ttsAudioUrl)
    // Text-to-video is now supported
    const pendingVideoShots = storyboards.filter((s) => !s.videoUrl && (s.videoPrompt || s.imagePrompt))

    // Get video shots for preview
    const videoShots = storyboards.filter((s) => s.videoUrl || s.composedUrl)
    const currentPreviewStoryboard = previewMode && videoShots[currentPreviewShot]

    // Pipeline completion percentage
    const pipelinePercent = totalShots > 0
      ? Math.round(((shotsWithImage + shotsWithVideo + shotsWithTts + shotsComposed) / (totalShots * 4)) * 100)
      : 0

    return (
      <div className="flex flex-col h-full">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-3 border-b border-border/50 flex-wrap gap-2">
          <div className="flex items-center gap-3">
            <span className="text-xs font-mono text-primary/80">06</span>
            <div>
              <h2 className="text-sm font-semibold">后期制作</h2>
              <p className="text-[10px] text-muted-foreground">配音 · 合成（字幕+配音） · 预览 · 导出</p>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {batchProgress && (
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Loader2 className="size-3 animate-spin" />
                <span>{batchProgress.message}</span>
                <Progress value={(batchProgress.current / batchProgress.total) * 100} className="h-1.5 w-20" />
              </div>
            )}
          </div>
        </div>

        {!hasAnyStoryboard ? (
          <div className="flex-1 flex items-center justify-center p-6">
            <div className="text-center max-w-md">
              <div className="mx-auto size-16 rounded-full bg-muted flex items-center justify-center mb-5">
                <Clapperboard className="size-8 text-muted-foreground/50" />
              </div>
              <h2 className="text-lg font-semibold mb-2">后期制作</h2>
              <p className="text-sm text-muted-foreground">
                请先在「分镜」步骤中生成分镜后再进行后期制作
              </p>
              <Button
                variant="outline"
                className="mt-4"
                onClick={() => setActiveStep('storyboard')}
              >
                前往分镜
              </Button>
            </div>
          </div>
        ) : (
          <ScrollArea className="flex-1">
            <div className="p-6 space-y-6">
              {/* Pipeline status bar — more detailed */}
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                <Card className="border-border/50 py-0 gap-0">
                  <CardContent className="p-3 text-center">
                    <div className="flex items-center justify-center gap-1.5 mb-1">
                      <ImageIcon className="size-3.5 text-primary/70" />
                      <span className="text-[10px] text-muted-foreground">图片</span>
                    </div>
                    <div className="text-lg font-bold">{shotsWithImage}<span className="text-xs font-normal text-muted-foreground">/{totalShots}</span></div>
                    <Progress value={totalShots > 0 ? (shotsWithImage / totalShots) * 100 : 0} className="h-1 mt-1.5" />
                  </CardContent>
                </Card>
                <Card className="border-border/50 py-0 gap-0">
                  <CardContent className="p-3 text-center">
                    <div className="flex items-center justify-center gap-1.5 mb-1">
                      <Video className="size-3.5 text-primary/70" />
                      <span className="text-[10px] text-muted-foreground">视频</span>
                    </div>
                    <div className="text-lg font-bold">{shotsWithVideo}<span className="text-xs font-normal text-muted-foreground">/{totalShots}</span></div>
                    <Progress value={totalShots > 0 ? (shotsWithVideo / totalShots) * 100 : 0} className="h-1 mt-1.5" />
                  </CardContent>
                </Card>
                <Card className="border-border/50 py-0 gap-0">
                  <CardContent className="p-3 text-center">
                    <div className="flex items-center justify-center gap-1.5 mb-1">
                      <Mic className="size-3.5 text-primary/70" />
                      <span className="text-[10px] text-muted-foreground">配音</span>
                    </div>
                    <div className="text-lg font-bold">{shotsWithTts}<span className="text-xs font-normal text-muted-foreground">/{shotsWithDialogue}</span></div>
                    <Progress value={shotsWithDialogue > 0 ? (shotsWithTts / shotsWithDialogue) * 100 : 0} className="h-1 mt-1.5" />
                  </CardContent>
                </Card>
                <Card className="border-border/50 py-0 gap-0">
                  <CardContent className="p-3 text-center">
                    <div className="flex items-center justify-center gap-1.5 mb-1">
                      <Layers className="size-3.5 text-primary/70" />
                      <span className="text-[10px] text-muted-foreground">合成</span>
                    </div>
                    <div className="text-lg font-bold">{shotsComposed}<span className="text-xs font-normal text-muted-foreground">/{shotsWithVideo}</span></div>
                    <Progress value={shotsWithVideo > 0 ? (shotsComposed / shotsWithVideo) * 100 : 0} className="h-1 mt-1.5" />
                  </CardContent>
                </Card>
                <Card className="border-border/50 py-0 gap-0 sm:col-span-1 col-span-2">
                  <CardContent className="p-3 text-center">
                    <div className="flex items-center justify-center gap-1.5 mb-1">
                      <Clapperboard className="size-3.5 text-primary/70" />
                      <span className="text-[10px] text-muted-foreground">总进度</span>
                    </div>
                    <div className="text-lg font-bold">{pipelinePercent}<span className="text-xs font-normal text-muted-foreground">%</span></div>
                    <Progress value={pipelinePercent} className="h-1 mt-1.5" />
                  </CardContent>
                </Card>
              </div>

              {/* Toolbar actions */}
              <div className="flex items-center gap-2 flex-wrap">
                {pendingVideoShots.length > 0 && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={handleGenerateAllVideos}
                    disabled={!!generatingVideo || !!generatingShotImg}
                  >
                    {generatingVideo ? <Loader2 className="size-3.5 animate-spin" /> : <Video className="size-3.5" />}
                    生成全部视频
                    <Badge variant="secondary" className="text-[9px] px-1 py-0 ml-1">{pendingVideoShots.length}</Badge>
                  </Button>
                )}
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleGenerateAllTts}
                  disabled={generatingAllTts || !!generatingTts || pendingTtsShots.length === 0}
                >
                  {generatingAllTts || generatingTts ? <Loader2 className="size-3.5 animate-spin" /> : <Music className="size-3.5" />}
                  生成全部配音
                  {pendingTtsShots.length > 0 && (
                    <Badge variant="secondary" className="text-[9px] px-1 py-0 ml-1">{pendingTtsShots.length}</Badge>
                  )}
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleComposeAll}
                  disabled={composingAll || !!composing || shotsWithVideo === 0}
                  className="amber-glow"
                >
                  {composingAll || composing ? <Loader2 className="size-3.5 animate-spin" /> : <Layers className="size-3.5" />}
                  一键合成（字幕+配音）
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleStartPreview}
                  disabled={videoShots.length === 0}
                >
                  <Eye className="size-3.5" />
                  预览完整视频
                </Button>
                <Button
                  size="sm"
                  onClick={handleExport}
                  disabled={exporting || videoShots.length === 0}
                  className="amber-glow"
                >
                  {exporting ? <Loader2 className="size-3.5 animate-spin" /> : <Download className="size-3.5" />}
                  导出成片
                </Button>
              </div>

              {/* Timeline view — with video players */}
              <div>
                <h3 className="text-xs font-semibold text-muted-foreground mb-3 flex items-center gap-1.5">
                  <Film className="size-3.5" />
                  镜头时间线
                  <Badge variant="secondary" className="text-[9px] px-1 py-0">{totalShots} 镜</Badge>
                </h3>
                <div className="space-y-3">
                  {storyboards.map((sb) => {
                    const hasImage = !!sb.firstFrameUrl
                    const hasVideo = !!sb.videoUrl
                    const hasTts = !!sb.ttsAudioUrl
                    const isComposed = !!sb.composedUrl
                    const isProcessing = generatingShotImg === sb.id || generatingVideo === sb.id || generatingTts === sb.id || composing === sb.id

                    return (
                      <Card key={sb.id} className={`border-border/50 py-0 gap-0 ${isComposed ? 'ring-1 ring-emerald-500/30' : ''}`}>
                        <CardContent className="p-4">
                          <div className="flex items-start gap-3">
                            {/* Shot number + video thumbnail */}
                            <div className="flex-shrink-0">
                              {sb.videoUrl ? (
                                <div className="relative w-28 h-16 rounded overflow-hidden border border-border/50">
                                  <video
                                    src={sb.composedUrl || sb.videoUrl}
                                    className="w-full h-full object-cover"
                                    muted
                                    onMouseEnter={(e) => (e.target as HTMLVideoElement).play().catch(() => {})}
                                    onMouseLeave={(e) => { const v = e.target as HTMLVideoElement; v.pause(); v.currentTime = 0; }}
                                    playsInline
                                    loop
                                    poster={sb.firstFrameUrl ?? undefined}
                                  />
                                  <div className="absolute top-1 left-1 bg-black/60 text-white text-[9px] font-mono px-1 rounded">
                                    {isComposed ? '✅' : '🎬'}
                                  </div>
                                </div>
                              ) : sb.firstFrameUrl ? (
                                <div className="relative w-28 h-16 rounded overflow-hidden border border-border/50">
                                  <img src={sb.firstFrameUrl} alt={`镜头${sb.shotNumber}`} className="w-full h-full object-cover" />
                                  <div className="absolute inset-0 flex items-center justify-center bg-black/20">
                                    <Play className="size-3.5 text-white" />
                                  </div>
                                </div>
                              ) : (
                                <div className="w-28 h-16 rounded bg-muted/50 flex items-center justify-center">
                                  <span className="text-xs font-bold text-muted-foreground/50">
                                    {String(sb.shotNumber).padStart(2, '0')}
                                  </span>
                                </div>
                              )}
                            </div>

                            {/* Shot info + pipeline */}
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-1.5">
                                <span className="text-xs font-bold text-primary">#{String(sb.shotNumber).padStart(2, '0')}</span>
                                <span className="text-xs font-medium truncate">{sb.title}</span>
                                {isProcessing && (
                                  <Loader2 className="size-3 text-primary animate-spin flex-shrink-0" />
                                )}
                                {isComposed && (
                                  <Badge className="status-completed text-[9px] px-1.5 py-0 gap-0.5">
                                    <Check className="size-2.5" /> 已合成
                                  </Badge>
                                )}
                              </div>
                              {/* Pipeline progress with icons */}
                              <div className="flex items-center gap-1.5 text-[10px] mb-2">
                                <span className={`inline-flex items-center gap-0.5 ${hasImage ? 'text-emerald-500 font-medium' : 'text-muted-foreground/40'}`}>
                                  <ImageIcon className="size-2.5" /> 图片
                                </span>
                                <ChevronRight className="size-2 text-muted-foreground/30" />
                                <span className={`inline-flex items-center gap-0.5 ${hasVideo ? 'text-emerald-500 font-medium' : 'text-muted-foreground/40'}`}>
                                  <Video className="size-2.5" /> 视频
                                </span>
                                <ChevronRight className="size-2 text-muted-foreground/30" />
                                <span className={`inline-flex items-center gap-0.5 ${hasTts ? 'text-emerald-500 font-medium' : sb.dialogue ? 'text-amber-500' : 'text-muted-foreground/40'}`}>
                                  <Mic className="size-2.5" /> 配音
                                </span>
                                <ChevronRight className="size-2 text-muted-foreground/30" />
                                <span className={`inline-flex items-center gap-0.5 ${isComposed ? 'text-emerald-500 font-medium' : 'text-muted-foreground/40'}`}>
                                  <Layers className="size-2.5" /> 合成
                                </span>
                              </div>
                              {/* Subtitle preview */}
                              {sb.dialogue && (
                                <div className="text-[10px] text-muted-foreground italic bg-muted/30 rounded px-2 py-1 mb-2">
                                  {sb.dialogueChar && <span className="font-medium not-italic text-foreground/80">{sb.dialogueChar}：</span>}
                                  {sb.dialogue}
                                </div>
                              )}
                            </div>

                            {/* Per-shot actions */}
                            <div className="flex items-center gap-1 flex-shrink-0 flex-wrap">
                              {!hasImage && sb.imagePrompt && (
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="h-7 text-[10px] px-2"
                                  onClick={() => handleGenerateShotImage(sb)}
                                  disabled={generatingShotImg === sb.id}
                                  title="生成图片"
                                >
                                  {generatingShotImg === sb.id ? <Loader2 className="size-3 animate-spin" /> : <ImageIcon className="size-3" />}
                                  图片
                                </Button>
                              )}
                              {/* Video generation — works with OR without firstFrameUrl */}
                              {!hasVideo && (sb.videoPrompt || sb.imagePrompt) && (
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="h-7 text-[10px] px-2 text-primary hover:text-primary"
                                  onClick={() => handleGenerateVideo(sb)}
                                  disabled={generatingVideo === sb.id}
                                  title={sb.firstFrameUrl ? '图生视频' : '文生视频'}
                                >
                                  {generatingVideo === sb.id ? <Loader2 className="size-3 animate-spin" /> : <Video className="size-3" />}
                                  {sb.firstFrameUrl ? '图生视频' : '文生视频'}
                                </Button>
                              )}
                              {sb.dialogue && !hasTts && (
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="h-7 text-[10px] px-2"
                                  onClick={() => handleGenerateTts(sb)}
                                  disabled={generatingTts === sb.id}
                                  title="生成配音"
                                >
                                  {generatingTts === sb.id ? <Loader2 className="size-3 animate-spin" /> : <Mic className="size-3" />}
                                  配音
                                </Button>
                              )}
                              {hasVideo && !isComposed && (
                                <Button
                                  size="sm"
                                  variant="secondary"
                                  className="h-7 text-[10px] px-2 amber-glow"
                                  onClick={() => handleComposeShot(sb)}
                                  disabled={composing === sb.id}
                                  title="合成（字幕+配音叠加）"
                                >
                                  {composing === sb.id ? <Loader2 className="size-3 animate-spin" /> : <Layers className="size-3" />}
                                  合成
                                </Button>
                              )}
                            </div>
                          </div>

                          {/* Audio player + composed video preview */}
                          <div className="mt-2 pl-[124px] space-y-2">
                            {sb.ttsAudioUrl && (
                              <div className="flex items-center gap-2">
                                <Music className="size-3 text-primary/60 flex-shrink-0" />
                                <audio
                                  src={sb.ttsAudioUrl}
                                  controls
                                  className="h-5 flex-1 [&::-webkit-media-controls-panel]:bg-muted/50"
                                  style={{ minWidth: 0 }}
                                />
                              </div>
                            )}
                            {sb.composedUrl && (
                              <div className="rounded overflow-hidden border border-emerald-500/20 max-w-md">
                                <video
                                  src={sb.composedUrl}
                                  controls
                                  className="w-full aspect-video"
                                />
                              </div>
                            )}
                          </div>
                        </CardContent>
                      </Card>
                    )
                  })}
                </div>
              </div>

              {/* Sequence Preview */}
              {previewMode && currentPreviewStoryboard && (
                <div className="border border-border/50 rounded-lg overflow-hidden">
                  <div className="flex items-center justify-between px-4 py-2 bg-muted/30 border-b border-border/50">
                    <div className="flex items-center gap-2">
                      <Eye className="size-3.5 text-primary" />
                      <span className="text-xs font-semibold">完整预览</span>
                      <Badge variant="secondary" className="text-[9px] px-1.5 py-0">
                        {currentPreviewShot + 1}/{videoShots.length}
                      </Badge>
                    </div>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-6 text-xs"
                      onClick={() => { setPreviewMode(false); setCurrentPreviewShot(0) }}
                    >
                      关闭预览
                    </Button>
                  </div>
                  <div className="relative bg-black">
                    <video
                      ref={previewVideoRef}
                      src={currentPreviewStoryboard.composedUrl || currentPreviewStoryboard.videoUrl!}
                      onEnded={handlePreviewEnded}
                      controls
                      autoPlay
                      className="w-full aspect-video"
                      poster={currentPreviewStoryboard.firstFrameUrl ?? undefined}
                    />
                    {/* Shot number + subtitle overlay */}
                    <div className="absolute top-3 left-3 bg-black/60 text-white text-xs font-mono px-2 py-0.5 rounded">
                      #{String(currentPreviewStoryboard.shotNumber).padStart(2, '0')} {currentPreviewStoryboard.title}
                    </div>
                    {/* Subtitle overlay */}
                    {currentPreviewStoryboard.dialogue && !currentPreviewStoryboard.composedUrl && (
                      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-black/70 text-white text-sm px-4 py-1.5 rounded max-w-[80%] text-center">
                        {currentPreviewStoryboard.dialogueChar && (
                          <span className="font-medium">{currentPreviewStoryboard.dialogueChar}：</span>
                        )}
                        {currentPreviewStoryboard.dialogue}
                      </div>
                    )}
                    {/* Hidden audio for TTS sync */}
                    {currentPreviewStoryboard.ttsAudioUrl && (
                      <audio
                        ref={previewAudioRef}
                        src={currentPreviewStoryboard.ttsAudioUrl}
                        autoPlay
                        className="hidden"
                      />
                    )}
                  </div>
                  {/* Shot navigation */}
                  <div className="flex items-center justify-center gap-2 p-2 bg-muted/20">
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7 text-xs"
                      disabled={currentPreviewShot === 0}
                      onClick={() => setCurrentPreviewShot(Math.max(0, currentPreviewShot - 1))}
                    >
                      上一镜
                    </Button>
                    <span className="text-xs text-muted-foreground">
                      {currentPreviewShot + 1} / {videoShots.length}
                    </span>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7 text-xs"
                      disabled={currentPreviewShot >= videoShots.length - 1}
                      onClick={() => setCurrentPreviewShot(Math.min(videoShots.length - 1, currentPreviewShot + 1))}
                    >
                      下一镜
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </ScrollArea>
        )}
      </div>
    )
  }

  // ── Render active panel ────────────────────────────────────

  const renderActivePanel = () => {
    switch (activeStep) {
      case 'raw':
        return renderRawPanel()
      case 'rewrite':
        return renderRewritePanel()
      case 'extract':
        return renderExtractPanel()
      case 'voice':
        return renderVoicePanel()
      case 'storyboard':
        return renderStoryboardPanel()
      case 'production':
        return renderProductionPanel()
      default:
        return null
    }
  }

  // ── Episode info for top bar ───────────────────────────────

  const dramaTitle = currentDrama?.title ?? '项目'
  const episodeTitle = episode?.title || (episode ? `第${episode.episodeNumber}集` : '集')

  return (
    <div className="flex-1 flex flex-col h-screen overflow-hidden">
      {/* ── Top Bar ────────────────────────────────────────── */}
      <header className="flex-shrink-0 border-b border-border/50 bg-background/80 backdrop-blur-md z-10">
        <div className="flex items-center gap-3 px-4 py-2.5">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigateToProject(selectedDramaId!)}
            className="text-muted-foreground hover:text-foreground -ml-2"
          >
            <ArrowLeft className="size-4" />
            <span className="hidden sm:inline">返回</span>
          </Button>

          <Separator orientation="vertical" className="h-5" />

          <h1 className="text-sm font-semibold truncate">{dramaTitle}</h1>

          <Badge variant="secondary" className="text-xs flex-shrink-0">
            {episodeTitle}
          </Badge>

          {/* Model selectors - desktop inline */}
          <div className="hidden md:flex items-center gap-2 ml-auto">
            <ModelSelector
              category="llm"
              value={workspaceModels.llm}
              onChange={(m) => setWorkspaceModel('llm', m)}
            />
            <ModelSelector
              category="image"
              value={workspaceModels.image}
              onChange={(m) => setWorkspaceModel('image', m)}
            />
            <ModelSelector
              category="video"
              value={workspaceModels.video}
              onChange={(m) => setWorkspaceModel('video', m)}
            />
          </div>

          {/* Status badges - desktop */}
          <div className="hidden md:flex items-center gap-2">
            {episode?.scriptStatus && episode.scriptStatus !== 'pending' && (
              <div className="flex items-center gap-1">
                <FileText className="size-3 text-muted-foreground" />
                {statusBadge(episode.scriptStatus)}
              </div>
            )}
            {episode?.extractStatus && episode.extractStatus !== 'pending' && (
              <div className="flex items-center gap-1">
                <Users className="size-3 text-muted-foreground" />
                {statusBadge(episode.extractStatus)}
              </div>
            )}
            {episode?.storyboardStatus && episode.storyboardStatus !== 'pending' && (
              <div className="flex items-center gap-1">
                <Film className="size-3 text-muted-foreground" />
                {statusBadge(episode.storyboardStatus)}
              </div>
            )}
          </div>

          {/* Mobile sidebar toggle */}
          <Button
            variant="ghost"
            size="icon"
            className="md:hidden ml-auto size-8"
            onClick={() => setSidebarOpen(!sidebarOpen)}
          >
            {sidebarOpen ? <PanelLeftClose className="size-4" /> : <PanelLeftOpen className="size-4" />}
          </Button>
        </div>

        {/* Mobile model selectors row */}
        <div className="flex md:hidden items-center gap-2 px-4 pb-2 overflow-x-auto">
          <ModelSelector
            category="llm"
            value={workspaceModels.llm}
            onChange={(m) => setWorkspaceModel('llm', m)}
          />
          <ModelSelector
            category="image"
            value={workspaceModels.image}
            onChange={(m) => setWorkspaceModel('image', m)}
          />
          <ModelSelector
            category="video"
            value={workspaceModels.video}
            onChange={(m) => setWorkspaceModel('video', m)}
          />
        </div>
      </header>

      {/* ── Body: Sidebar + Main ───────────────────────────── */}
      <div className="flex-1 flex overflow-hidden">
        {/* Sidebar */}
        <AnimatePresence>
          {sidebarOpen && (
            <motion.aside
              initial={{ width: 0, opacity: 0 }}
              animate={{ width: 240, opacity: 1 }}
              exit={{ width: 0, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="flex-shrink-0 border-r border-border/50 bg-card/50 overflow-hidden"
            >
              <div className="w-[240px] h-full flex flex-col">
                {/* Pipeline steps */}
                <ScrollArea className="flex-1">
                  <div className="p-3 space-y-1">
                    {STEPS.map((step, idx) => (
                      <div key={step.key}>
                        {/* Main step */}
                        <button
                          onClick={() => {
                            if (step.subSteps) {
                              setActiveStep(step.subSteps[0].key)
                            } else {
                              setActiveStep(step.key)
                            }
                          }}
                          className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition-all duration-150 group ${
                            isSidebarStepActive(step)
                              ? 'bg-primary/10 text-primary'
                              : 'text-muted-foreground hover:bg-muted/50 hover:text-foreground'
                          }`}
                        >
                          {/* Step number */}
                          <div
                            className={`flex-shrink-0 size-7 rounded flex items-center justify-center text-xs font-bold ${
                              isSidebarStepActive(step)
                                ? 'bg-primary text-primary-foreground'
                                : isStepCompleted(step.key)
                                  ? 'bg-emerald-500/20 text-emerald-500'
                                  : 'bg-muted text-muted-foreground'
                            }`}
                          >
                            {isStepCompleted(step.key) && !isSidebarStepActive(step) ? (
                              <Check className="size-3.5" />
                            ) : (
                              idx + 1
                            )}
                          </div>

                          <span className="text-sm font-medium">{step.label}</span>

                          {isStepCompleted(step.key) && !isSidebarStepActive(step) && (
                            <Check className="size-3.5 text-emerald-500 ml-auto" />
                          )}
                        </button>

                        {/* Sub-steps */}
                        {step.subSteps && (
                          <div className="ml-4 border-l border-border/50 pl-3 mt-1 space-y-0.5">
                            {step.subSteps.map((sub) => (
                              <button
                                key={sub.key}
                                onClick={() => setActiveStep(sub.key)}
                                className={`w-full flex items-center gap-2 px-2 py-1.5 rounded text-left text-xs transition-all duration-150 ${
                                  activeStep === sub.key
                                    ? 'bg-primary/10 text-primary font-medium'
                                    : isStepCompleted(sub.key)
                                      ? 'text-emerald-500'
                                      : 'text-muted-foreground hover:text-foreground'
                                }`}
                              >
                                {isStepCompleted(sub.key) && activeStep !== sub.key ? (
                                  <Check className="size-3 flex-shrink-0" />
                                ) : (
                                  <ChevronRight className="size-3 flex-shrink-0" />
                                )}
                                {sub.label}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </ScrollArea>

                {/* Progress */}
                <div className="p-3 border-t border-border/50">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs text-muted-foreground">进度</span>
                    <span className="text-xs font-medium text-primary">{progressPercent}%</span>
                  </div>
                  <Progress value={progressPercent} className="h-1.5" />
                  <p className="text-[10px] text-muted-foreground mt-1.5">
                    {completedCount}/{totalSteps} 步骤完成
                  </p>
                </div>
              </div>
            </motion.aside>
          )}
        </AnimatePresence>

        {/* Main content */}
        <main className="flex-1 flex flex-col overflow-hidden">
          <AnimatePresence mode="wait">
            <motion.div
              key={activeStep}
              variants={panelVariants}
              initial="initial"
              animate="animate"
              exit="exit"
              transition={{ duration: 0.2, ease: 'easeInOut' }}
              className="flex-1 flex flex-col overflow-hidden"
            >
              {renderActivePanel()}
            </motion.div>
          </AnimatePresence>
        </main>
      </div>
    </div>
  )
}

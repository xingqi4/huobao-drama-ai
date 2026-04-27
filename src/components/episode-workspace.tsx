'use client'

import { useEffect, useState, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useAppStore, type EpisodeDetail, type Character, type Scene, type Storyboard } from '@/lib/store'
import { api } from '@/lib/api'
import { useToast } from '@/hooks/use-toast'
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
} from 'lucide-react'

// ── Types ────────────────────────────────────────────────────

type StepKey = 'raw' | 'rewrite' | 'extract' | 'storyboard' | 'production'

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
  const [batchProgress, setBatchProgress] = useState<{
    current: number
    total: number
    message: string
  } | null>(null)

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
        case 'storyboard':
          return storyboards.length > 0
        case 'production':
          return storyboards.some((s) => s.firstFrameUrl)
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

  // ── AI: Rewrite script ─────────────────────────────────────

  const handleRewrite = async () => {
    if (!selectedEpisodeId) return
    setAiLoading(true)
    try {
      await api.ai.rewriteScript(selectedEpisodeId)
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

  // ── AI: Extract ────────────────────────────────────────────

  const handleExtract = async () => {
    if (!selectedEpisodeId || !selectedDramaId) return
    setAiLoading(true)
    setGenerationProgress({ step: 'starting', message: '开始提取...', progress: 0 })
    try {
      await api.ai.extractStream(
        selectedEpisodeId,
        selectedDramaId,
        (data) => {
          setGenerationProgress({ step: data.step, message: data.message, progress: data.progress })
        }
      )
      toast({ title: '角色与场景提取完成' })
      await fetchEpisode()
    } catch (err) {
      toast({ title: '提取失败', description: String(err), variant: 'destructive' })
    } finally {
      setAiLoading(false)
      setGenerationProgress(null)
    }
  }

  // ── AI: Generate storyboard ────────────────────────────────

  const handleGenerateStoryboard = async () => {
    if (!selectedEpisodeId) return
    setAiLoading(true)
    setGenerationProgress({ step: 'starting', message: '开始生成分镜...', progress: 0 })
    try {
      await api.ai.generateStoryboardStream(
        selectedEpisodeId,
        (data) => {
          setGenerationProgress({ step: data.step, message: data.message, progress: data.progress })
        }
      )
      toast({ title: '分镜生成完成' })
      await fetchEpisode()
    } catch (err) {
      toast({ title: '分镜生成失败', description: String(err), variant: 'destructive' })
    } finally {
      setAiLoading(false)
      setGenerationProgress(null)
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
      await api.ai.generateTts(storyboard.id, storyboard.dialogue)
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
    const pending = storyboards.filter((s) => s.firstFrameUrl && !s.videoUrl && (s.videoPrompt || s.imagePrompt))
    if (pending.length === 0) {
      toast({ title: '没有可生成的镜头视频（需要先生成首帧图片）' })
      return
    }
    setBatchProgress({ current: 0, total: pending.length, message: '生成视频中...' })
    let successCount = 0
    for (let i = 0; i < pending.length; i++) {
      const sb = pending[i]
      setGeneratingVideo(sb.id)
      setBatchProgress({ current: i + 1, total: pending.length, message: `生成视频 ${i + 1}/${pending.length}...` })
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

    // Loading state
    if (isRewriting || (aiLoading && activeStep === 'rewrite')) {
      return (
        <div className="flex-1 flex items-center justify-center p-6">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="text-center"
          >
            <Loader2 className="size-10 text-primary animate-spin mx-auto mb-4" />
            <h2 className="text-lg font-semibold mb-1">正在改写剧本...</h2>
            <p className="text-sm text-muted-foreground">AI正在将原始内容转化为剧本格式</p>
          </motion.div>
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

    // Loading state
    if (isExtracting || (aiLoading && activeStep === 'extract')) {
      return (
        <div className="flex-1 flex items-center justify-center p-6">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="text-center max-w-sm w-full"
          >
            <Loader2 className="size-10 text-primary animate-spin mx-auto mb-4" />
            <h2 className="text-lg font-semibold mb-1">正在提取角色与场景...</h2>
            {generationProgress ? (
              <>
                <p className="text-sm text-muted-foreground mb-3">{generationProgress.message}</p>
                <Progress value={generationProgress.progress} className="h-2 mb-1" />
                <p className="text-xs text-muted-foreground">{generationProgress.progress}%</p>
              </>
            ) : (
              <p className="text-sm text-muted-foreground">AI正在从剧本中识别角色和场景信息</p>
            )}
          </motion.div>
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

    // Loading state
    if (isStoryboarding || (aiLoading && activeStep === 'storyboard')) {
      return (
        <div className="flex-1 flex items-center justify-center p-6">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="text-center max-w-sm w-full"
          >
            <Loader2 className="size-10 text-primary animate-spin mx-auto mb-4" />
            <h2 className="text-lg font-semibold mb-1">正在生成分镜...</h2>
            {generationProgress ? (
              <>
                <p className="text-sm text-muted-foreground mb-3">{generationProgress.message}</p>
                <Progress value={generationProgress.progress} className="h-2 mb-1" />
                <p className="text-xs text-muted-foreground">{generationProgress.progress}%</p>
              </>
            ) : (
              <p className="text-sm text-muted-foreground">AI正在将剧本拆解为镜头序列</p>
            )}
          </motion.div>
        </div>
      )
    }

    // Storyboard cards
    return (
      <div className="flex flex-col h-full">
        <div className="flex items-center justify-between px-6 py-3 border-b border-border/50">
          <div className="flex items-center gap-3">
            <span className="text-xs font-mono text-primary/80">04</span>
            <h2 className="text-sm font-semibold">分镜列表</h2>
            <Badge variant="secondary" className="text-[10px]">{storyboards.length} 镜</Badge>
            {episode?.storyboardStatus && statusBadge(episode.storyboardStatus)}
          </div>
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

                  {/* Collapsible prompts */}
                  <div className="ml-12 space-y-1">
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
    const pendingShots = storyboards.filter((s) => !s.firstFrameUrl && s.imagePrompt)
    const completedShots = storyboards.filter((s) => s.firstFrameUrl)
    const pendingVideoShots = storyboards.filter((s) => s.firstFrameUrl && !s.videoUrl && (s.videoPrompt || s.imagePrompt))

    return (
      <div className="flex flex-col h-full">
        <div className="flex items-center justify-between px-6 py-3 border-b border-border/50">
          <div className="flex items-center gap-3">
            <span className="text-xs font-mono text-primary/80">05</span>
            <h2 className="text-sm font-semibold">制作</h2>
            {hasAnyStoryboard && (
              <Badge variant="secondary" className="text-[10px]">
                {completedShots.length}/{storyboards.length}
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-2">
            {batchProgress && (
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Loader2 className="size-3 animate-spin" />
                <span>{batchProgress.message}</span>
                <Progress value={(batchProgress.current / batchProgress.total) * 100} className="h-1.5 w-24" />
                <span>{batchProgress.current}/{batchProgress.total}</span>
              </div>
            )}
            {pendingVideoShots.length > 0 && (
              <Button
                size="sm"
                variant="outline"
                onClick={handleGenerateAllVideos}
                disabled={!!generatingVideo || !!generatingShotImg}
              >
                {generatingVideo ? (
                  <Loader2 className="size-3.5 animate-spin" />
                ) : (
                  <Video className="size-3.5" />
                )}
                生成全部视频
              </Button>
            )}
            {pendingShots.length > 0 && (
              <Button
                size="sm"
                onClick={handleGenerateAllImages}
                disabled={!!generatingShotImg || !!generatingVideo}
                className="amber-glow"
              >
                {generatingShotImg ? (
                  <Loader2 className="size-3.5 animate-spin" />
                ) : (
                  <ImageIcon className="size-3.5" />
                )}
                生成全部图片
              </Button>
            )}
          </div>
        </div>

        {!hasAnyStoryboard ? (
          <div className="flex-1 flex items-center justify-center p-6">
            <div className="text-center max-w-md">
              <div className="mx-auto size-16 rounded-full bg-muted flex items-center justify-center mb-5">
                <Clapperboard className="size-8 text-muted-foreground/50" />
              </div>
              <h2 className="text-lg font-semibold mb-2">制作区</h2>
              <p className="text-sm text-muted-foreground">
                请先在「分镜」步骤中生成分镜后再进行制作
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
            <div className="p-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {storyboards.map((sb) => (
                <Card key={sb.id} className="border-border/50 py-0 gap-0 overflow-hidden">
                  {/* Media area — video or image */}
                  <div className="aspect-video bg-muted/50 relative group">
                    {sb.videoUrl ? (
                      <video
                        src={sb.videoUrl}
                        controls
                        className="w-full h-full object-cover"
                        poster={sb.firstFrameUrl ?? undefined}
                      />
                    ) : sb.firstFrameUrl ? (
                      <img
                        src={sb.firstFrameUrl}
                        alt={`Shot ${sb.shotNumber}`}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="absolute inset-0 flex items-center justify-center">
                        <div className="text-center">
                          <Camera className="size-8 text-muted-foreground/30 mx-auto mb-2" />
                          <Button
                            size="sm"
                            variant="secondary"
                            onClick={() => handleGenerateShotImage(sb)}
                            disabled={generatingShotImg === sb.id || !sb.imagePrompt}
                            className="text-xs"
                          >
                            {generatingShotImg === sb.id ? (
                              <Loader2 className="size-3 animate-spin" />
                            ) : (
                              <ImageIcon className="size-3" />
                            )}
                            生成图片
                          </Button>
                        </div>
                      </div>
                    )}
                    {(generatingShotImg === sb.id || generatingVideo === sb.id) && (
                      <div className="absolute inset-0 bg-background/60 flex items-center justify-center">
                        <div className="text-center">
                          <Loader2 className="size-8 text-primary animate-spin mx-auto mb-2" />
                          <p className="text-xs text-muted-foreground">
                            {generatingVideo === sb.id ? '生成视频中...' : '生成图片中...'}
                          </p>
                        </div>
                      </div>
                    )}
                  </div>
                  {/* Shot info */}
                  <CardContent className="p-3 space-y-2">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs font-bold text-primary">
                        #{String(sb.shotNumber).padStart(2, '0')}
                      </span>
                      <span className="text-xs font-medium truncate">{sb.title}</span>
                      <Badge variant="secondary" className="text-[9px] px-1 py-0 ml-auto">
                        {shotTypeLabel(sb.shotType)}
                      </Badge>
                    </div>
                    {/* Status badges */}
                    <div className="flex items-center gap-2 flex-wrap">
                      {sb.firstFrameUrl ? (
                        <Badge className="status-completed text-[9px] px-1 py-0">图片</Badge>
                      ) : (
                        <Badge variant="outline" className="text-[9px] px-1 py-0">待生成</Badge>
                      )}
                      {sb.videoUrl ? (
                        <Badge className="status-completed text-[9px] px-1 py-0">视频</Badge>
                      ) : null}
                      {sb.ttsAudioUrl ? (
                        <Badge className="status-completed text-[9px] px-1 py-0">配音</Badge>
                      ) : null}
                    </div>
                    {/* Action buttons */}
                    <div className="flex items-center gap-1.5 flex-wrap">
                      {sb.firstFrameUrl && !sb.videoUrl && (sb.videoPrompt || sb.imagePrompt) && (
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() => handleGenerateVideo(sb)}
                          disabled={generatingVideo === sb.id}
                          className="h-6 text-[10px] px-2"
                        >
                          {generatingVideo === sb.id ? (
                            <Loader2 className="size-2.5 animate-spin" />
                          ) : (
                            <Video className="size-2.5" />
                          )}
                          生成视频
                        </Button>
                      )}
                      {sb.dialogue && !sb.ttsAudioUrl && (
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() => handleGenerateTts(sb)}
                          disabled={generatingTts === sb.id}
                          className="h-6 text-[10px] px-2"
                        >
                          {generatingTts === sb.id ? (
                            <Loader2 className="size-2.5 animate-spin" />
                          ) : (
                            <Mic className="size-2.5" />
                          )}
                          生成配音
                        </Button>
                      )}
                      {!sb.firstFrameUrl && sb.imagePrompt && (
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() => handleGenerateShotImage(sb)}
                          disabled={generatingShotImg === sb.id}
                          className="h-6 text-[10px] px-2"
                        >
                          {generatingShotImg === sb.id ? (
                            <Loader2 className="size-2.5 animate-spin" />
                          ) : (
                            <ImageIcon className="size-2.5" />
                          )}
                          生成图片
                        </Button>
                      )}
                    </div>
                    {/* TTS Audio player */}
                    {sb.ttsAudioUrl && (
                      <div className="flex items-center gap-2 pt-1">
                        <Mic className="size-3 text-primary/70 flex-shrink-0" />
                        <audio
                          src={sb.ttsAudioUrl}
                          controls
                          className="h-6 w-full [&::-webkit-media-controls-panel]:bg-muted/50"
                          style={{ minWidth: 0 }}
                        />
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
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

          {/* Status indicators */}
          <div className="hidden sm:flex items-center gap-2 ml-auto">
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
            className="sm:hidden ml-auto size-8"
            onClick={() => setSidebarOpen(!sidebarOpen)}
          >
            {sidebarOpen ? <PanelLeftClose className="size-4" /> : <PanelLeftOpen className="size-4" />}
          </Button>
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

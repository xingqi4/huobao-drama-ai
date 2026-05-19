'use client'

import {
  Loader2,
  Film,
  Clapperboard,
  Check,
  ChevronRight,
  Image as ImageIcon,
  Video,
  RefreshCw,
  Mic,
  Play,
  Download,
  Layers,
  Music,
  Eye,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Progress } from '@/components/ui/progress'
import type { ProductionPanelProps, PipelineStepKey } from './types'

// ── Step-aware configuration ────────────────────────────────────

interface ProductionStepConfig {
  stepNumber: string
  title: string
  subtitle: string
  showTts: boolean
  showVideo: boolean
  showCompose: boolean
}

function getProductionStepConfig(step: PipelineStepKey): ProductionStepConfig {
  switch (step) {
    case 'dubbing':
      return {
        stepNumber: '08',
        title: '配音生成',
        subtitle: '为每个镜头的对白生成TTS配音',
        showTts: true,
        showVideo: false,
        showCompose: false,
      }
    case 'video_generation':
      return {
        stepNumber: '10',
        title: '视频生成',
        subtitle: '为每个镜头生成视频片段',
        showTts: false,
        showVideo: true,
        showCompose: false,
      }
    case 'compose_merge':
      return {
        stepNumber: '11',
        title: '合成拼接',
        subtitle: '合成（字幕+配音叠加）· 合并成片 · 预览 · 导出',
        showTts: false,
        showVideo: false,
        showCompose: true,
      }
    default:
      return {
        stepNumber: '08',
        title: '后期制作',
        subtitle: '配音 · 合成（字幕+配音） · 预览 · 导出',
        showTts: true,
        showVideo: true,
        showCompose: true,
      }
  }
}

export function ProductionPanel({
  storyboards,
  aiLoading,
  generatingShotImg,
  generatingVideo,
  generatingTts,
  generatingAllTts,
  composing,
  composingAll,
  batchProgress,
  previewMode,
  currentPreviewShot,
  exporting,
  previewVideoRef,
  previewAudioRef,
  perms,
  ffmpegAvailable,
  merging,
  mergeStatus,
  activePipelineStep,
  handleGenerateShotImage,
  handleGenerateVideo,
  handleGenerateTts,
  handleGenerateAllVideos,
  handleGenerateAllTts,
  handleComposeShot,
  handleComposeAll,
  handleServerMerge,
  handleStartPreview,
  handlePreviewEnded,
  handleExport,
  setActiveStep,
  setPreviewMode,
  setCurrentPreviewShot,
}: ProductionPanelProps) {
  const config = getProductionStepConfig(activePipelineStep)

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

  // Merge readiness
  const canMerge = mergeStatus?.canMerge ?? (shotsComposed === totalShots && totalShots > 0)
  const canMergePartial = mergeStatus?.canMergePartial ?? (shotsWithVideo > 0)
  const composeMode = ffmpegAvailable ? 'FFmpeg' : 'WebM'

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-3 border-b border-border/50 flex-wrap gap-2">
        <div className="flex items-center gap-3">
          <span className="text-xs font-mono text-primary/80">{config.stepNumber}</span>
          <div>
            <h2 className="text-sm font-semibold">{config.title}</h2>
            <p className="text-[10px] text-muted-foreground">{config.subtitle}</p>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {/* FFmpeg availability indicator */}
          <Badge
            variant="secondary"
            className={`text-[9px] px-1.5 py-0 gap-0.5 ${
              ffmpegAvailable
                ? 'bg-emerald-500/15 text-emerald-600 border-emerald-500/30'
                : 'bg-muted text-muted-foreground border-border'
            }`}
          >
            {ffmpegAvailable ? '服务端合成' : '客户端合成'}
          </Badge>
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
            <h2 className="text-lg font-semibold mb-2">{config.title}</h2>
            <p className="text-sm text-muted-foreground">
              请先在「分镜」步骤中生成分镜后再进行{config.title.toLowerCase()}
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
            {/* Pipeline status bar — filtered by step */}
            <div className={`grid gap-3 ${
              config.showTts && config.showVideo && config.showCompose
                ? 'grid-cols-2 sm:grid-cols-5'
                : config.showCompose
                  ? 'grid-cols-2 sm:grid-cols-3'
                  : 'grid-cols-2'
            }`}>
              {/* Image stat — only show in video_generation */}
              {config.showVideo && (
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
              )}
              {/* Video stat */}
              {config.showVideo && (
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
              )}
              {/* TTS stat */}
              {config.showTts && (
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
              )}
              {/* Compose stat */}
              {config.showCompose && (
                <>
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
                  <Card className="border-border/50 py-0 gap-0">
                    <CardContent className="p-3 text-center">
                      <div className="flex items-center justify-center gap-1.5 mb-1">
                        <Clapperboard className="size-3.5 text-primary/70" />
                        <span className="text-[10px] text-muted-foreground">总进度</span>
                      </div>
                      <div className="text-lg font-bold">{pipelinePercent}<span className="text-xs font-normal text-muted-foreground">%</span></div>
                      <Progress value={pipelinePercent} className="h-1 mt-1.5" />
                    </CardContent>
                  </Card>
                </>
              )}
            </div>

            {/* Merge result banner — only in compose_merge */}
            {config.showCompose && ffmpegAvailable && mergeStatus?.latestMerge?.mergedUrl && (
              <Card className="border-emerald-500/30 py-0 gap-0">
                <CardContent className="p-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="size-7 rounded-full bg-emerald-500/15 flex items-center justify-center">
                        <Film className="size-3.5 text-emerald-600" />
                      </div>
                      <div>
                        <p className="text-xs font-semibold text-emerald-600">成片已合并</p>
                        <p className="text-[10px] text-muted-foreground">
                          {mergeStatus.latestMerge.duration != null
                            ? `时长 ${mergeStatus.latestMerge.duration}秒`
                            : '合并完成'}
                        </p>
                      </div>
                    </div>
                    <video
                      src={mergeStatus.latestMerge.mergedUrl}
                      controls
                      className="h-16 rounded border border-border/50"
                    />
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Toolbar actions — filtered by step */}
            <div className="flex items-center gap-2 flex-wrap">
              {/* Dubbing step: TTS only */}
              {config.showTts && !config.showVideo && (
                <Button
                  size="sm"
                  variant="default"
                  onClick={handleGenerateAllTts}
                  disabled={generatingAllTts || !!generatingTts || pendingTtsShots.length === 0}
                  className="amber-glow"
                >
                  {generatingAllTts || generatingTts ? <Loader2 className="size-3.5 animate-spin" /> : <Music className="size-3.5" />}
                  生成全部配音
                  {pendingTtsShots.length > 0 && (
                    <Badge variant="secondary" className="text-[9px] px-1 py-0 ml-1">{pendingTtsShots.length}</Badge>
                  )}
                </Button>
              )}
              {/* Video step: Video only */}
              {config.showVideo && !config.showTts && pendingVideoShots.length > 0 && (
                <Button
                  size="sm"
                  variant="default"
                  onClick={handleGenerateAllVideos}
                  disabled={!!generatingVideo || !!generatingShotImg}
                  className="amber-glow"
                >
                  {generatingVideo ? <Loader2 className="size-3.5 animate-spin" /> : <Video className="size-3.5" />}
                  生成全部视频
                  <Badge variant="secondary" className="text-[9px] px-1 py-0 ml-1">{pendingVideoShots.length}</Badge>
                </Button>
              )}
              {/* Compose step: compose + merge */}
              {config.showCompose && !config.showTts && !config.showVideo && (
                <>
                  <Button
                    size="sm"
                    variant="default"
                    onClick={handleComposeAll}
                    disabled={composingAll || !!composing || shotsWithVideo === 0}
                    className="amber-glow"
                  >
                    {composingAll || composing ? <Loader2 className="size-3.5 animate-spin" /> : <Layers className="size-3.5" />}
                    一键合成（{composeMode}）
                  </Button>
                  {ffmpegAvailable && (canMerge || canMergePartial) && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={handleServerMerge}
                      disabled={merging || !canMergePartial}
                      className="amber-glow"
                    >
                      {merging ? <Loader2 className="size-3.5 animate-spin" /> : <Download className="size-3.5" />}
                      合并成片
                      {mergeStatus?.latestMerge?.mergedUrl && (
                        <Badge variant="secondary" className="text-[9px] px-1 py-0 ml-1 bg-emerald-500/15 text-emerald-600">
                          已合并
                        </Badge>
                      )}
                    </Button>
                  )}
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
                    className={perms.canExport ? 'amber-glow' : ''}
                    variant={perms.canExport ? 'default' : 'outline'}
                  >
                    {exporting ? <Loader2 className="size-3.5 animate-spin" /> : <Download className="size-3.5" />}
                    {perms.canExport ? '导出成片' : '导出（需专业版）'}
                  </Button>
                </>
              )}
              {/* Full production mode (all) */}
              {config.showTts && config.showVideo && config.showCompose && (
                <>
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
                    一键合成（{composeMode}）
                  </Button>
                  {ffmpegAvailable && (canMerge || canMergePartial) && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={handleServerMerge}
                      disabled={merging || !canMergePartial}
                      className="amber-glow"
                    >
                      {merging ? <Loader2 className="size-3.5 animate-spin" /> : <Download className="size-3.5" />}
                      合并成片
                      {mergeStatus?.latestMerge?.mergedUrl && (
                        <Badge variant="secondary" className="text-[9px] px-1 py-0 ml-1 bg-emerald-500/15 text-emerald-600">
                          已合并
                        </Badge>
                      )}
                    </Button>
                  )}
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
                    className={perms.canExport ? 'amber-glow' : ''}
                    variant={perms.canExport ? 'default' : 'outline'}
                  >
                    {exporting ? <Loader2 className="size-3.5 animate-spin" /> : <Download className="size-3.5" />}
                    {perms.canExport ? '导出成片' : '导出（需专业版）'}
                  </Button>
                </>
              )}
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
                            {/* Pipeline progress with icons — filtered by step */}
                            <div className="flex items-center gap-1.5 text-[10px] mb-2">
                              {config.showVideo && (
                                <>
                                  <span className={`inline-flex items-center gap-0.5 ${hasImage ? 'text-emerald-500 font-medium' : 'text-muted-foreground/40'}`}>
                                    <ImageIcon className="size-2.5" /> 图片
                                  </span>
                                  <ChevronRight className="size-2 text-muted-foreground/30" />
                                  <span className={`inline-flex items-center gap-0.5 ${hasVideo ? 'text-emerald-500 font-medium' : 'text-muted-foreground/40'}`}>
                                    <Video className="size-2.5" /> 视频
                                  </span>
                                </>
                              )}
                              {config.showTts && (
                                <>
                                  {config.showVideo && <ChevronRight className="size-2 text-muted-foreground/30" />}
                                  <span className={`inline-flex items-center gap-0.5 ${hasTts ? 'text-emerald-500 font-medium' : sb.dialogue ? 'text-amber-500' : 'text-muted-foreground/40'}`}>
                                    <Mic className="size-2.5" /> 配音
                                  </span>
                                </>
                              )}
                              {config.showCompose && (
                                <>
                                  <ChevronRight className="size-2 text-muted-foreground/30" />
                                  <span className={`inline-flex items-center gap-0.5 ${isComposed ? 'text-emerald-500 font-medium' : 'text-muted-foreground/40'}`}>
                                    <Layers className="size-2.5" /> 合成
                                  </span>
                                </>
                              )}
                            </div>
                            {/* Subtitle preview */}
                            {sb.dialogue && (
                              <div className="text-[10px] text-muted-foreground italic bg-muted/30 rounded px-2 py-1 mb-2">
                                {sb.dialogueChar && <span className="font-medium not-italic text-foreground/80">{sb.dialogueChar}：</span>}
                                {sb.dialogue}
                              </div>
                            )}
                          </div>

                          {/* Per-shot actions — filtered by step */}
                          <div className="flex items-center gap-1 flex-shrink-0 flex-wrap">
                            {/* Image generation — only in video step */}
                            {config.showVideo && !config.showTts && !hasImage && sb.imagePrompt && (
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
                            {/* Video generation — in video step */}
                            {config.showVideo && !config.showTts && !hasVideo && (sb.videoPrompt || sb.imagePrompt) && (
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
                            {/* TTS generation — in dubbing step */}
                            {config.showTts && !config.showVideo && sb.dialogue && !hasTts && (
                              <Button
                                size="sm"
                                variant="default"
                                className="h-7 text-[10px] px-2 amber-glow"
                                onClick={() => handleGenerateTts(sb)}
                                disabled={generatingTts === sb.id}
                                title="生成配音"
                              >
                                {generatingTts === sb.id ? <Loader2 className="size-3 animate-spin" /> : <Mic className="size-3" />}
                                生成配音
                              </Button>
                            )}
                            {/* Compose — in compose step */}
                            {config.showCompose && !config.showTts && !config.showVideo && hasVideo && !isComposed && (
                              <Button
                                size="sm"
                                variant="secondary"
                                className="h-7 text-[10px] px-2 amber-glow"
                                onClick={() => handleComposeShot(sb)}
                                disabled={composing === sb.id}
                                title={`合成（字幕+配音叠加）${ffmpegAvailable ? ' - FFmpeg' : ' - WebM'}`}
                              >
                                {composing === sb.id ? <Loader2 className="size-3 animate-spin" /> : <Layers className="size-3" />}
                                合成{ffmpegAvailable ? ' ✦' : ''}
                              </Button>
                            )}
                            {/* Full production mode: all per-shot actions */}
                            {config.showTts && config.showVideo && config.showCompose && (
                              <>
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
                                    title={`合成（字幕+配音叠加）${ffmpegAvailable ? ' - FFmpeg' : ' - WebM'}`}
                                  >
                                    {composing === sb.id ? <Loader2 className="size-3 animate-spin" /> : <Layers className="size-3" />}
                                    合成{ffmpegAvailable ? ' ✦' : ''}
                                  </Button>
                                )}
                              </>
                            )}
                          </div>
                        </div>

                        {/* Audio player + composed video preview — filtered by step */}
                        <div className="mt-2 pl-[124px] space-y-2">
                          {(config.showTts || (config.showTts && config.showVideo && config.showCompose)) && sb.ttsAudioUrl && (
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
                          {config.showCompose && sb.composedUrl && (
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

            {/* Sequence Preview — only in compose_merge */}
            {config.showCompose && previewMode && currentPreviewStoryboard && (
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

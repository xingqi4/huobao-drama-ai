'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import {
  Loader2,
  Sparkles,
  Film,
  Check,
  Clock,
  Camera,
  Image as ImageIcon,
  Video,
  RefreshCw,
  Mic,
  Upload,
  Wand2,
  ChevronDown,
  Copy,
  Edit3,
  Save,
  X,
  Music,
  Volume2,
  Layers,
  ImagePlus,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Progress } from '@/components/ui/progress'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Separator } from '@/components/ui/separator'
import {
  Collapsible,
  CollapsibleTrigger,
  CollapsibleContent,
} from '@/components/ui/collapsible'
import { AgentExecutionPanel } from '@/components/agent-execution-panel'
import { statusBadge, shotTypeLabel, cameraAngleLabel, cameraMovementLabel } from './helpers'
import type { StoryboardPanelProps, Storyboard } from './types'

// ── Inline Editable Field ──────────────────────────────────────

function InlineField({
  label,
  value,
  onSave,
  copiedField,
  fieldId,
  onCopy,
  multiline = false,
  placeholder = '',
}: {
  label: string
  value: string | null | undefined
  onSave: (val: string) => void
  copiedField: string | null
  fieldId: string
  onCopy: (text: string, id: string) => void
  multiline?: boolean
  placeholder?: string
}) {
  const [editing, setEditing] = useState(false)
  const [editValue, setEditValue] = useState(value ?? '')

  const handleSave = () => {
    onSave(editValue)
    setEditing(false)
  }

  const handleCancel = () => {
    setEditValue(value ?? '')
    setEditing(false)
  }

  if (editing) {
    return (
      <div className="space-y-1.5">
        <label className="text-[10px] font-medium text-muted-foreground">{label}</label>
        {multiline ? (
          <Textarea
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            className="text-xs min-h-[60px] resize-y"
            placeholder={placeholder}
            autoFocus
          />
        ) : (
          <Input
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            className="text-xs h-7"
            placeholder={placeholder}
            autoFocus
          />
        )}
        <div className="flex items-center gap-1">
          <Button size="sm" variant="secondary" className="h-6 text-[10px] px-2 gap-1" onClick={handleSave}>
            <Save className="size-2.5" /> 保存
          </Button>
          <Button size="sm" variant="ghost" className="h-6 text-[10px] px-2 gap-1" onClick={handleCancel}>
            <X className="size-2.5" /> 取消
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="group">
      <div className="flex items-center gap-1.5 mb-0.5">
        <label className="text-[10px] font-medium text-muted-foreground">{label}</label>
        <button
          onClick={() => setEditing(true)}
          className="opacity-0 group-hover:opacity-100 transition-opacity p-0.5 rounded hover:bg-muted/50"
          title="编辑"
        >
          <Edit3 className="size-2.5 text-muted-foreground" />
        </button>
        {value && (
          <button
            onClick={() => onCopy(value, fieldId)}
            className="opacity-0 group-hover:opacity-100 transition-opacity p-0.5 rounded hover:bg-muted/50"
            title="复制"
          >
            {copiedField === fieldId ? (
              <Check className="size-2.5 text-emerald-500" />
            ) : (
              <Copy className="size-2.5 text-muted-foreground" />
            )}
          </button>
        )}
      </div>
      <p className={`text-xs ${value ? 'text-foreground' : 'text-muted-foreground italic'}`}>
        {value || placeholder || '未设置'}
      </p>
    </div>
  )
}

// ── Section wrapper ──────────────────────────────────────────────

function DetailSection({
  title,
  icon,
  children,
  defaultOpen = true,
}: {
  title: string
  icon: React.ReactNode
  children: React.ReactNode
  defaultOpen?: boolean
}) {
  return (
    <Collapsible defaultOpen={defaultOpen}>
      <CollapsibleTrigger className="flex items-center gap-2 w-full py-2 hover:text-foreground transition-colors">
        <ChevronDown className="size-3 text-muted-foreground" />
        {icon}
        <span className="text-xs font-semibold">{title}</span>
        <Separator className="flex-1" />
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className="space-y-3 pl-1">
          {children}
        </div>
      </CollapsibleContent>
    </Collapsible>
  )
}

// ── Main StoryboardPanel ──────────────────────────────────────

export function StoryboardPanel({
  storyboards,
  aiLoading,
  isStoryboarding,
  episode,
  agentExec,
  generatingShotImg,
  generatingVideo,
  generatingTts,
  batchProgress,
  uploadingField,
  copiedField,
  handleGenerateStoryboard,
  handleEnhanceShotPrompt,
  handleGenerateAllImages,
  handleGenerateAllVideos,
  handleGenerateShotImage,
  handleGenerateVideo,
  handleGenerateTts,
  handleUpload,
  handleCopy,
  handleUpdateStoryboard,
}: StoryboardPanelProps) {
  const [selectedShotId, setSelectedShotId] = useState<string | null>(
    storyboards.length > 0 ? storyboards[0].id : null
  )
  const selectedShot = storyboards.find((s) => s.id === selectedShotId)

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
            disabled={aiLoading}
            className="amber-glow"
          >
            <Sparkles className="size-4" />
            开始生成分镜
          </Button>
        </motion.div>
      </div>
    )
  }

  // Loading state
  if (isStoryboarding || aiLoading) {
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
  const pendingVideoShots = storyboards.filter((s) => !s.videoUrl && (s.videoPrompt || s.imagePrompt))
  const t2vShots = pendingVideoShots.filter((s) => !s.firstFrameUrl)
  const i2vShots = pendingVideoShots.filter((s) => s.firstFrameUrl)

  return (
    <div className="flex flex-col h-full">
      {/* Toolbar */}
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

      {/* Split layout: storyboard list + detail panel */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left: Shot list */}
        <div className="w-full md:w-2/5 lg:w-1/3 border-r border-border/50 flex flex-col">
          <ScrollArea className="flex-1">
            <div className="p-3 space-y-1.5">
              {storyboards.map((sb) => (
                <button
                  key={sb.id}
                  onClick={() => setSelectedShotId(sb.id)}
                  className={`w-full text-left rounded-lg border transition-all duration-150 p-2.5 ${
                    selectedShotId === sb.id
                      ? 'border-primary/50 bg-primary/5'
                      : 'border-border/30 hover:border-border/60 hover:bg-muted/30'
                  }`}
                >
                  <div className="flex items-start gap-2">
                    {/* Shot number */}
                    <div className={`flex-shrink-0 size-7 rounded flex items-center justify-center text-xs font-bold ${
                      selectedShotId === sb.id
                        ? 'bg-primary text-primary-foreground'
                        : sb.firstFrameUrl
                          ? 'bg-emerald-500/20 text-emerald-500'
                          : 'bg-muted text-muted-foreground'
                    }`}>
                      {sb.firstFrameUrl && selectedShotId !== sb.id ? (
                        <Check className="size-3.5" />
                      ) : (
                        String(sb.shotNumber).padStart(2, '0')
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="text-xs font-semibold truncate">{sb.title}</span>
                        <Badge variant="secondary" className="text-[9px] px-1 py-0">
                          {shotTypeLabel(sb.shotType)}
                        </Badge>
                      </div>
                      <p className="text-[10px] text-muted-foreground mt-0.5 line-clamp-1">{sb.action}</p>
                      {/* Mini status */}
                      <div className="flex items-center gap-1 mt-1">
                        {sb.firstFrameUrl && <Check className="size-2.5 text-emerald-500" />}
                        {sb.videoUrl && <Video className="size-2.5 text-emerald-500" />}
                        {sb.ttsAudioUrl && <Mic className="size-2.5 text-emerald-500" />}
                        {sb.dialogue && (
                          <span className="text-[9px] text-muted-foreground truncate ml-1">
                            💬 {sb.dialogue.slice(0, 20)}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </ScrollArea>
        </div>

        {/* Right: Detail panel */}
        <div className="hidden md:flex md:w-3/5 lg:w-2/3 flex-col">
          {selectedShot ? (
            <ScrollArea className="flex-1">
              <div className="p-5 space-y-4">
                {/* Shot header */}
                <div className="flex items-center gap-3 mb-4">
                  <div className="size-10 rounded-lg bg-primary/10 flex items-center justify-center">
                    <span className="text-sm font-bold text-primary">
                      {String(selectedShot.shotNumber).padStart(2, '0')}
                    </span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="text-base font-semibold">{selectedShot.title}</h3>
                    <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                      <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                        {shotTypeLabel(selectedShot.shotType)}
                      </Badge>
                      {selectedShot.cameraAngle && (
                        <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                          {cameraAngleLabel(selectedShot.cameraAngle)}
                        </Badge>
                      )}
                      {selectedShot.cameraMovement && (
                        <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                          {cameraMovementLabel(selectedShot.cameraMovement)}
                        </Badge>
                      )}
                      <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                        <Clock className="size-2.5" />
                        {selectedShot.duration}s
                      </span>
                    </div>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleEnhanceShotPrompt(selectedShot)}
                    disabled={aiLoading}
                    className="gap-1 text-xs"
                  >
                    <Wand2 className="size-3" />
                    AI增强
                  </Button>
                </div>

                {/* Media preview */}
                {(selectedShot.videoUrl || selectedShot.firstFrameUrl) && (
                  <div className="relative rounded-lg overflow-hidden border border-border/50 max-w-lg">
                    {selectedShot.videoUrl ? (
                      <video
                        src={selectedShot.videoUrl}
                        controls
                        className="w-full aspect-video object-cover"
                        poster={selectedShot.firstFrameUrl ?? undefined}
                      />
                    ) : (
                      <img
                        src={selectedShot.firstFrameUrl!}
                        alt={`镜头 ${selectedShot.shotNumber}`}
                        className="w-full aspect-video object-cover"
                      />
                    )}
                    {(generatingShotImg === selectedShot.id || generatingVideo === selectedShot.id) && (
                      <div className="absolute inset-0 bg-background/60 flex items-center justify-center">
                        <Loader2 className="size-6 text-primary animate-spin" />
                      </div>
                    )}
                  </div>
                )}

                {/* Section 1: Shot Structure */}
                <DetailSection title="镜头结构" icon={<Film className="size-3 text-primary" />}>
                  <div className="grid grid-cols-2 gap-3">
                    <InlineField
                      label="标题"
                      value={selectedShot.title}
                      onSave={(v) => handleUpdateStoryboard(selectedShot.id, { title: v })}
                      copiedField={copiedField}
                      fieldId={`sb-title-${selectedShot.id}`}
                      onCopy={handleCopy}
                      placeholder="镜头标题"
                    />
                    <InlineField
                      label="景别"
                      value={shotTypeLabel(selectedShot.shotType)}
                      onSave={(v) => handleUpdateStoryboard(selectedShot.id, { shotType: v })}
                      copiedField={copiedField}
                      fieldId={`sb-shottype-${selectedShot.id}`}
                      onCopy={handleCopy}
                      placeholder="medium"
                    />
                    <InlineField
                      label="角度"
                      value={cameraAngleLabel(selectedShot.cameraAngle)}
                      onSave={(v) => handleUpdateStoryboard(selectedShot.id, { cameraAngle: v })}
                      copiedField={copiedField}
                      fieldId={`sb-angle-${selectedShot.id}`}
                      onCopy={handleCopy}
                      placeholder="eye-level"
                    />
                    <InlineField
                      label="运镜"
                      value={cameraMovementLabel(selectedShot.cameraMovement)}
                      onSave={(v) => handleUpdateStoryboard(selectedShot.id, { cameraMovement: v })}
                      copiedField={copiedField}
                      fieldId={`sb-movement-${selectedShot.id}`}
                      onCopy={handleCopy}
                      placeholder="static"
                    />
                    <InlineField
                      label="时长 (秒)"
                      value={String(selectedShot.duration)}
                      onSave={(v) => handleUpdateStoryboard(selectedShot.id, { duration: parseFloat(v) || 3 })}
                      copiedField={copiedField}
                      fieldId={`sb-duration-${selectedShot.id}`}
                      onCopy={handleCopy}
                      placeholder="3"
                    />
                  </div>
                </DetailSection>

                {/* Section 2: Visual Semantics */}
                <DetailSection title="视觉语义" icon={<Camera className="size-3 text-primary" />}>
                  <div className="space-y-3">
                    <InlineField
                      label="动作描述"
                      value={selectedShot.action}
                      onSave={(v) => handleUpdateStoryboard(selectedShot.id, { action: v })}
                      copiedField={copiedField}
                      fieldId={`sb-action-${selectedShot.id}`}
                      onCopy={handleCopy}
                      multiline
                      placeholder="描述画面中的动作..."
                    />
                    <InlineField
                      label="描述"
                      value={selectedShot.description}
                      onSave={(v) => handleUpdateStoryboard(selectedShot.id, { description: v })}
                      copiedField={copiedField}
                      fieldId={`sb-desc-${selectedShot.id}`}
                      onCopy={handleCopy}
                      multiline
                      placeholder="详细的视觉描述..."
                    />
                    <InlineField
                      label="氛围"
                      value={selectedShot.atmosphere}
                      onSave={(v) => handleUpdateStoryboard(selectedShot.id, { atmosphere: v })}
                      copiedField={copiedField}
                      fieldId={`sb-atmo-${selectedShot.id}`}
                      onCopy={handleCopy}
                      placeholder="紧张、温馨、悬疑..."
                    />
                    {selectedShot.dialogue && (
                      <InlineField
                        label={`对白${selectedShot.dialogueChar ? ` (${selectedShot.dialogueChar})` : ''}`}
                        value={selectedShot.dialogue}
                        onSave={(v) => handleUpdateStoryboard(selectedShot.id, { dialogue: v })}
                        copiedField={copiedField}
                        fieldId={`sb-dialogue-${selectedShot.id}`}
                        onCopy={handleCopy}
                        multiline
                        placeholder="对白内容..."
                      />
                    )}
                  </div>
                </DetailSection>

                {/* Section 3: Generation Prompts */}
                <DetailSection title="生成提示词" icon={<Sparkles className="size-3 text-primary" />} defaultOpen={true}>
                  <div className="space-y-3">
                    <InlineField
                      label="图片提示词 (Image Prompt)"
                      value={selectedShot.imagePrompt}
                      onSave={(v) => handleUpdateStoryboard(selectedShot.id, { imagePrompt: v })}
                      copiedField={copiedField}
                      fieldId={`sb-imgprompt-${selectedShot.id}`}
                      onCopy={handleCopy}
                      multiline
                      placeholder="用于首帧图片生成的英文提示词..."
                    />
                    <InlineField
                      label="视频提示词 (Video Prompt)"
                      value={selectedShot.videoPrompt}
                      onSave={(v) => handleUpdateStoryboard(selectedShot.id, { videoPrompt: v })}
                      copiedField={copiedField}
                      fieldId={`sb-vidprompt-${selectedShot.id}`}
                      onCopy={handleCopy}
                      multiline
                      placeholder="描述镜头运动和角色动作变化..."
                    />
                    <InlineField
                      label="背景音乐提示 (BGM Prompt)"
                      value={selectedShot.bgmPrompt}
                      onSave={(v) => handleUpdateStoryboard(selectedShot.id, { bgmPrompt: v })}
                      copiedField={copiedField}
                      fieldId={`sb-bgm-${selectedShot.id}`}
                      onCopy={handleCopy}
                      placeholder="描述场景的背景音乐风格..."
                    />
                    <InlineField
                      label="音效描述 (Sound Effect)"
                      value={selectedShot.soundEffect}
                      onSave={(v) => handleUpdateStoryboard(selectedShot.id, { soundEffect: v })}
                      copiedField={copiedField}
                      fieldId={`sb-sfx-${selectedShot.id}`}
                      onCopy={handleCopy}
                      placeholder="描述场景中的音效..."
                    />
                  </div>
                </DetailSection>

                {/* Section 4: Frame Images */}
                <DetailSection title="帧图片" icon={<Layers className="size-3 text-primary" />} defaultOpen={true}>
                  <div className="grid grid-cols-2 gap-4">
                    {/* First Frame */}
                    <div className="space-y-2">
                      <label className="text-[10px] font-medium text-muted-foreground">首帧 (First Frame)</label>
                      {selectedShot.firstFrameUrl ? (
                        <div className="relative rounded-lg overflow-hidden border border-border/50">
                          <img
                            src={selectedShot.firstFrameUrl}
                            alt="首帧"
                            className="w-full aspect-video object-cover"
                          />
                        </div>
                      ) : (
                        <div className="aspect-video rounded-lg bg-muted/50 border border-dashed border-border/50 flex items-center justify-center">
                          <div className="text-center">
                            <Camera className="size-5 text-muted-foreground/30 mx-auto mb-1" />
                            <p className="text-[10px] text-muted-foreground/50">暂无首帧</p>
                          </div>
                        </div>
                      )}
                      <div className="flex items-center gap-1">
                        {selectedShot.imagePrompt && !selectedShot.firstFrameUrl && (
                          <Button
                            size="sm"
                            variant="secondary"
                            onClick={() => handleGenerateShotImage(selectedShot)}
                            disabled={generatingShotImg === selectedShot.id}
                            className="h-6 text-[10px] px-2 gap-1"
                          >
                            {generatingShotImg === selectedShot.id ? (
                              <Loader2 className="size-2.5 animate-spin" />
                            ) : (
                              <ImagePlus className="size-2.5" />
                            )}
                            生成
                          </Button>
                        )}
                        {!selectedShot.firstFrameUrl && (
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-6 text-[10px] px-2 gap-1 text-muted-foreground"
                            disabled={uploadingField === `sb-img-${selectedShot.id}`}
                            onClick={() => {
                              const input = document.getElementById(`upload-sb-img-${selectedShot.id}`) as HTMLInputElement
                              input?.click()
                            }}
                          >
                            {uploadingField === `sb-img-${selectedShot.id}` ? (
                              <Loader2 className="size-2.5 animate-spin" />
                            ) : (
                              <Upload className="size-2.5" />
                            )}
                            上传
                          </Button>
                        )}
                      </div>
                    </div>

                    {/* Last Frame */}
                    <div className="space-y-2">
                      <label className="text-[10px] font-medium text-muted-foreground">末帧 (Last Frame)</label>
                      {selectedShot.lastFrameUrl ? (
                        <div className="relative rounded-lg overflow-hidden border border-border/50">
                          <img
                            src={selectedShot.lastFrameUrl}
                            alt="末帧"
                            className="w-full aspect-video object-cover"
                          />
                        </div>
                      ) : (
                        <div className="aspect-video rounded-lg bg-muted/50 border border-dashed border-border/50 flex items-center justify-center">
                          <div className="text-center">
                            <ImageIcon className="size-5 text-muted-foreground/30 mx-auto mb-1" />
                            <p className="text-[10px] text-muted-foreground/50">暂无末帧</p>
                          </div>
                        </div>
                      )}
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-6 text-[10px] px-2 gap-1 text-muted-foreground"
                        disabled={uploadingField === `sb-lastframe-${selectedShot.id}`}
                        onClick={() => {
                          const input = document.getElementById(`upload-sb-lastframe-${selectedShot.id}`) as HTMLInputElement
                          input?.click()
                        }}
                      >
                        {uploadingField === `sb-lastframe-${selectedShot.id}` ? (
                          <Loader2 className="size-2.5 animate-spin" />
                        ) : (
                          <Upload className="size-2.5" />
                        )}
                        上传
                      </Button>
                    </div>
                  </div>

                  {/* TTS Audio */}
                  {selectedShot.ttsAudioUrl && (
                    <div className="mt-3 flex items-center gap-2">
                      <Volume2 className="size-3 text-primary/70 flex-shrink-0" />
                      <audio
                        src={selectedShot.ttsAudioUrl}
                        controls
                        className="h-6 flex-1 [&::-webkit-media-controls-panel]:bg-muted/50"
                        style={{ minWidth: 0 }}
                      />
                    </div>
                  )}

                  {/* Action buttons */}
                  <div className="mt-3 flex items-center gap-1.5 flex-wrap">
                    {!selectedShot.videoUrl && (selectedShot.videoPrompt || selectedShot.imagePrompt) && (
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => handleGenerateVideo(selectedShot)}
                        disabled={generatingVideo === selectedShot.id}
                        className="h-7 text-[11px] px-2.5 amber-glow"
                      >
                        {generatingVideo === selectedShot.id ? (
                          <Loader2 className="size-3 animate-spin" />
                        ) : (
                          <Video className="size-3" />
                        )}
                        {selectedShot.firstFrameUrl ? '图生视频' : '文生视频'}
                      </Button>
                    )}
                    {selectedShot.dialogue && !selectedShot.ttsAudioUrl && (
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => handleGenerateTts(selectedShot)}
                        disabled={generatingTts === selectedShot.id}
                        className="h-7 text-[11px] px-2.5"
                      >
                        {generatingTts === selectedShot.id ? (
                          <Loader2 className="size-3 animate-spin" />
                        ) : (
                          <Mic className="size-3" />
                        )}
                        生成配音
                      </Button>
                    )}
                  </div>
                </DetailSection>

                {/* Hidden file inputs */}
                <input
                  id={`upload-sb-img-${selectedShot.id}`}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0]
                    if (file) handleUpload(file, { storyboardId: selectedShot.id, fieldType: 'firstFrameUrl' }, `sb-img-${selectedShot.id}`)
                    e.target.value = ''
                  }}
                />
                <input
                  id={`upload-sb-lastframe-${selectedShot.id}`}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0]
                    if (file) handleUpload(file, { storyboardId: selectedShot.id, fieldType: 'lastFrameUrl' }, `sb-lastframe-${selectedShot.id}`)
                    e.target.value = ''
                  }}
                />
                <input
                  id={`upload-sb-vid-${selectedShot.id}`}
                  type="file"
                  accept="video/*"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0]
                    if (file) handleUpload(file, { storyboardId: selectedShot.id, fieldType: 'videoUrl' }, `sb-vid-${selectedShot.id}`)
                    e.target.value = ''
                  }}
                />
              </div>
            </ScrollArea>
          ) : (
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center">
                <Film className="size-8 text-muted-foreground/30 mx-auto mb-2" />
                <p className="text-xs text-muted-foreground">选择一个镜头查看详情</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

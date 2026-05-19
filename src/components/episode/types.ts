import type { EpisodeDetail, Character, Scene, Storyboard } from '@/lib/store'
import type { UserPermissions } from '@/hooks/use-permissions'

// ── Step types (11-step pipeline) ──────────────────────────────

export type PipelineStepKey =
  | 'raw_content'
  | 'script_rewrite'
  | 'character_extract'
  | 'voice_assign'
  | 'storyboard'
  | 'character_images'
  | 'scene_images'
  | 'dubbing'
  | 'shot_frames'
  | 'video_generation'
  | 'compose_merge'

// Legacy step key (used in some sub-panels for backward compat)
export type StepKey = 'raw' | 'rewrite' | 'extract' | 'voice' | 'storyboard' | 'production'

export interface StepDef {
  key: StepKey
  label: string
  icon: React.ReactNode
  subSteps?: { key: StepKey; label: string }[]
}

// 11-step pipeline step definition
export interface PipelineStepDef {
  key: PipelineStepKey
  label: string
  icon: React.ReactNode
  stepNumber: number
}

// Pipeline step status from API
export interface PipelineStepStatus {
  status: 'pending' | 'active' | 'completed'
  completed: number
  total: number
}

export interface PipelineStatus {
  pipeline: Record<PipelineStepKey, PipelineStepStatus>
  steps: PipelineStepKey[]
  completedSteps: number
  totalSteps: number
  progressPercent: number
}

// ── Batch progress ────────────────────────────────────────────

export interface BatchProgress {
  current: number
  total: number
  message: string
}

// ── Generation progress ───────────────────────────────────────

export interface GenerationProgress {
  step: string
  message: string
  progress: number
}

// ── Upload options ────────────────────────────────────────────

export interface UploadOptions {
  storyboardId?: string
  characterId?: string
  sceneId?: string
  fieldType: string
}

// ── Agent execution (subset exposed to sub-panels) ────────────

export interface AgentExecState {
  isRunning: (agentType: string) => boolean
  logs: Record<string, unknown[]>
  resultTexts: Record<string, string>
  durations: Record<string, number>
  errors: Record<string, string | null>
}

// ── Voice types ───────────────────────────────────────────────

export interface VoiceInfo {
  id: string
  name: string
  provider: string
  language?: string
  description?: string
  gender?: string
}

// ── Panel props ───────────────────────────────────────────────

export interface ScriptPanelProps {
  rawContent: string
  setRawContent: (v: string) => void
  scriptContent: string
  setScriptContent: (v: string) => void
  saving: boolean
  aiLoading: boolean
  isRewriting: boolean
  episode: EpisodeDetail | null
  agentExec: AgentExecState
  activeStep: StepKey
  handleSaveRaw: () => Promise<void>
  handleSaveScript: () => Promise<void>
  handleRewrite: () => Promise<void>
  handleSkipRewrite: () => Promise<void>
}

export interface ExtractPanelProps {
  characters: Character[]
  scenes: Scene[]
  aiLoading: boolean
  isExtracting: boolean
  episode: EpisodeDetail | null
  agentExec: AgentExecState
  generatingCharImg: string | null
  generatingSceneImg: string | null
  batchProgress: BatchProgress | null
  uploadingField: string | null
  handleExtract: () => Promise<void>
  handleGenerateAllExtractImages: () => Promise<void>
  handleGenerateCharSheet: (charId: string) => Promise<void>
  handleGenerateCharImage: (charId: string) => Promise<void>
  handleGenerateSceneImage: (sceneId: string) => Promise<void>
  handleUpload: (file: File, options: UploadOptions, fieldKey: string) => Promise<void>
}

export interface VoicePanelProps {
  characters: Character[]
  aiLoading: boolean
  agentExec: AgentExecState
  activeStep: StepKey
  handleVoiceAssign: () => Promise<void>
  // Enhanced voice features
  voices: VoiceInfo[]
  activeTtsProvider: string | null
  voiceSamples: Record<string, string> // characterId -> audioUrl
  generatingSample: string | null // characterId being generated
  handleAssignVoice: (characterId: string, voiceId: string) => Promise<void>
  handleGenerateVoiceSample: (characterId: string, voiceId: string) => Promise<void>
  handleBatchGenerateSamples: () => Promise<void>
}

// ── Grid generation types ─────────────────────────────────────

export type GridMode = 'first_frame' | 'first_last' | 'multi_ref'

export interface GridConfig {
  mode: GridMode
  rows: number
  cols: number
}

export interface GridGenerationState {
  isGeneratingGrid: boolean
  isSplittingGrid: boolean
  gridConfig: GridConfig
}

export interface StoryboardPanelProps {
  storyboards: Storyboard[]
  aiLoading: boolean
  isStoryboarding: boolean
  episode: EpisodeDetail | null
  agentExec: AgentExecState
  generatingShotImg: string | null
  generatingVideo: string | null
  generatingTts: string | null
  batchProgress: BatchProgress | null
  uploadingField: string | null
  copiedField: string | null
  gridState: GridGenerationState
  handleGenerateStoryboard: () => Promise<void>
  handleEnhanceShotPrompt: (storyboard: Storyboard) => Promise<void>
  handleGenerateAllImages: () => Promise<void>
  handleGenerateAllVideos: () => Promise<void>
  handleGenerateShotImage: (storyboard: Storyboard) => Promise<void>
  handleGenerateVideo: (storyboard: Storyboard) => Promise<void>
  handleGenerateTts: (storyboard: Storyboard) => Promise<void>
  handleUpload: (file: File, options: UploadOptions, fieldKey: string) => Promise<void>
  handleCopy: (text: string, fieldId: string) => Promise<void>
  handleUpdateStoryboard: (id: string, data: Partial<Storyboard>) => Promise<void>
  handleGridGenerate: (config: GridConfig) => Promise<void>
}

// ── Merge status ──────────────────────────────────────────────

export interface MergeStatus {
  canMerge: boolean
  canMergePartial: boolean
  totalShots: number
  composedShots: number
  ffmpegAvailable: boolean
  latestMerge: {
    status: string
    mergedUrl: string | null
    duration: number | null
  } | null
}

export interface ProductionPanelProps {
  storyboards: Storyboard[]
  characters: Character[]
  aiLoading: boolean
  agentExec: AgentExecState
  generatingShotImg: string | null
  generatingVideo: string | null
  generatingTts: string | null
  generatingAllTts: boolean
  composing: string | null
  composingAll: boolean
  batchProgress: BatchProgress | null
  previewMode: boolean
  currentPreviewShot: number
  exporting: boolean
  previewVideoRef: React.RefObject<HTMLVideoElement | null>
  previewAudioRef: React.RefObject<HTMLAudioElement | null>
  perms: UserPermissions
  ffmpegAvailable: boolean
  merging: boolean
  mergeStatus: MergeStatus | null
  handleGenerateShotImage: (storyboard: Storyboard) => Promise<void>
  handleGenerateVideo: (storyboard: Storyboard) => Promise<void>
  handleGenerateTts: (storyboard: Storyboard) => Promise<void>
  handleGenerateAllVideos: () => Promise<void>
  handleGenerateAllTts: () => Promise<void>
  handleComposeShot: (storyboard: Storyboard) => Promise<void>
  handleComposeAll: () => Promise<void>
  handleServerMerge: () => Promise<void>
  handleStartPreview: () => void
  handlePreviewEnded: () => void
  handleExport: () => Promise<void>
  setActiveStep: (step: StepKey) => void
  setPreviewMode: (v: boolean) => void
  setCurrentPreviewShot: (v: number | ((prev: number) => number)) => void
}

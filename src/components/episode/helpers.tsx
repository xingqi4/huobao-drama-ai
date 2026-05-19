import {
  FileText,
  Users,
  Mic,
  Film,
  Clapperboard,
  Image,
  Video,
  Music,
  Scissors,
  Layers,
  Combine,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import type { StepDef, PipelineStepDef, PipelineStepKey } from './types'

// ── Legacy step definitions (for sidebar backward compat) ────

export const STEPS: StepDef[] = [
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

// ── 11-step pipeline definitions ──────────────────────────────

export const PIPELINE_STEPS: PipelineStepDef[] = [
  { key: 'raw_content', label: '原始内容', icon: <FileText className="size-3.5" />, stepNumber: 1 },
  { key: 'script_rewrite', label: '剧本改写', icon: <FileText className="size-3.5" />, stepNumber: 2 },
  { key: 'character_extract', label: '角色提取', icon: <Users className="size-3.5" />, stepNumber: 3 },
  { key: 'voice_assign', label: '音色分配', icon: <Mic className="size-3.5" />, stepNumber: 4 },
  { key: 'storyboard', label: '分镜拆解', icon: <Film className="size-3.5" />, stepNumber: 5 },
  { key: 'character_images', label: '角色图片', icon: <Image className="size-3.5" />, stepNumber: 6 },
  { key: 'scene_images', label: '场景图片', icon: <Layers className="size-3.5" />, stepNumber: 7 },
  { key: 'dubbing', label: '配音生成', icon: <Music className="size-3.5" />, stepNumber: 8 },
  { key: 'shot_frames', label: '镜头帧图', icon: <Scissors className="size-3.5" />, stepNumber: 9 },
  { key: 'video_generation', label: '视频生成', icon: <Video className="size-3.5" />, stepNumber: 10 },
  { key: 'compose_merge', label: '合成拼接', icon: <Combine className="size-3.5" />, stepNumber: 11 },
]

// Map pipeline step keys to legacy step keys for panel navigation
export const PIPELINE_TO_STEP_MAP: Record<PipelineStepKey, string> = {
  raw_content: 'raw',
  script_rewrite: 'rewrite',
  character_extract: 'extract',
  voice_assign: 'voice',
  storyboard: 'storyboard',
  character_images: 'extract',
  scene_images: 'extract',
  dubbing: 'production',
  shot_frames: 'storyboard',
  video_generation: 'production',
  compose_merge: 'production',
}

// ── Helper: status badge ─────────────────────────────────────

export function statusBadge(status: string) {
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

// ── Helper: shot type label ──────────────────────────────────

export function shotTypeLabel(type: string): string {
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

// ── Helper: camera angle label ────────────────────────────────

export function cameraAngleLabel(angle: string): string {
  const map: Record<string, string> = {
    'eye-level': '平视',
    'high-angle': '俯拍',
    'low-angle': '仰拍',
    'dutch-angle': '倾斜',
    'birds-eye': '鸟瞰',
    'worms-eye': '虫视',
  }
  return map[angle] ?? angle
}

// ── Helper: camera movement label ─────────────────────────────

export function cameraMovementLabel(movement: string): string {
  const map: Record<string, string> = {
    'static': '固定',
    'pan-left': '左摇',
    'pan-right': '右摇',
    'tilt-up': '上摇',
    'tilt-down': '下摇',
    'zoom-in': '推',
    'zoom-out': '拉',
    'dolly-in': '前推',
    'dolly-out': '后拉',
    'tracking': '跟拍',
    'crane-up': '摇臂上升',
    'handheld': '手持',
  }
  return map[movement] ?? movement
}

// ── Panel transition variants ────────────────────────────────

export const panelVariants = {
  initial: { opacity: 0, x: 16 },
  animate: { opacity: 1, x: 0 },
  exit: { opacity: 0, x: -16 },
}

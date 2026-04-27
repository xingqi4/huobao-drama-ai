import { create } from 'zustand'

// ============================================================
// Type Definitions — aligned with Prisma schema
// ============================================================

export interface Drama {
  id: string
  title: string
  description: string
  genre: string
  style: string
  coverImage: string | null
  totalEpisodes: number
  status: string
  createdAt: string
  updatedAt: string
  _count?: { episodes: number; characters: number; scenes: number }
}

export interface DramaDetail extends Drama {
  episodes: Episode[]
  characters: Character[]
  scenes: Scene[]
}

export interface Episode {
  id: string
  dramaId: string
  episodeNumber: number
  title: string
  rawContent: string | null
  scriptContent: string | null
  scriptStatus: string
  extractStatus: string
  storyboardStatus: string
  status: string
  videoUrl: string | null
  duration: number
  createdAt: string
  updatedAt: string
  _count?: { storyboards: number }
}

export interface EpisodeDetail extends Episode {
  storyboards: Storyboard[]
}

export interface Character {
  id: string
  dramaId: string
  name: string
  role: string
  gender: string
  age: string
  appearance: string
  personality: string
  voiceStyle: string
  voiceId: string | null
  imagePrompt: string | null
  imageUrl: string | null
  createdAt: string
  updatedAt: string
}

export interface Scene {
  id: string
  dramaId: string
  location: string
  timeOfDay: string
  description: string
  prompt: string
  imageUrl: string | null
  createdAt: string
  updatedAt: string
}

export interface Storyboard {
  id: string
  episodeId: string
  shotNumber: number
  title: string
  shotType: string
  cameraAngle: string
  cameraMovement: string
  action: string
  dialogue: string | null
  dialogueChar: string | null
  duration: number
  imagePrompt: string | null
  videoPrompt: string | null
  atmosphere: string | null
  firstFrameUrl: string | null
  videoUrl: string | null
  ttsAudioUrl: string | null
  composedUrl: string | null
  status: string
  createdAt: string
  updatedAt: string
}

// ============================================================
// View type for client-side navigation
// ============================================================

export type AppView = 'projects' | 'project-detail' | 'episode-workspace' | 'settings'

// ============================================================
// Store interface
// ============================================================

interface AppStore {
  // Navigation
  view: AppView
  selectedDramaId: string | null
  selectedEpisodeId: string | null

  // Navigation actions
  navigateToProjects: () => void
  navigateToProject: (dramaId: string) => void
  navigateToEpisode: (dramaId: string, episodeId: string) => void
  navigateToSettings: () => void

  // Drama data cache
  dramas: Drama[]
  setDramas: (dramas: Drama[]) => void
  currentDrama: DramaDetail | null
  setCurrentDrama: (drama: DramaDetail | null) => void
  currentEpisode: EpisodeDetail | null
  setCurrentEpisode: (episode: EpisodeDetail | null) => void

  // Loading states
  loading: boolean
  setLoading: (loading: boolean) => void
  aiLoading: boolean
  setAiLoading: (loading: boolean) => void
}

// ============================================================
// Zustand store
// ============================================================

export const useAppStore = create<AppStore>((set) => ({
  // Navigation state
  view: 'projects',
  selectedDramaId: null,
  selectedEpisodeId: null,

  // Navigation actions
  navigateToProjects: () =>
    set({
      view: 'projects',
      selectedDramaId: null,
      selectedEpisodeId: null,
      currentDrama: null,
      currentEpisode: null,
    }),

  navigateToProject: (dramaId: string) =>
    set({
      view: 'project-detail',
      selectedDramaId: dramaId,
      selectedEpisodeId: null,
      currentEpisode: null,
    }),

  navigateToEpisode: (dramaId: string, episodeId: string) =>
    set({
      view: 'episode-workspace',
      selectedDramaId: dramaId,
      selectedEpisodeId: episodeId,
    }),

  navigateToSettings: () =>
    set({
      view: 'settings',
      selectedDramaId: null,
      selectedEpisodeId: null,
    }),

  // Drama data cache
  dramas: [],
  setDramas: (dramas: Drama[]) => set({ dramas }),
  currentDrama: null,
  setCurrentDrama: (drama: DramaDetail | null) => set({ currentDrama: drama }),
  currentEpisode: null,
  setCurrentEpisode: (episode: EpisodeDetail | null) =>
    set({ currentEpisode: episode }),

  // Loading states
  loading: false,
  setLoading: (loading: boolean) => set({ loading }),
  aiLoading: false,
  setAiLoading: (aiLoading: boolean) => set({ aiLoading }),
}))

'use client'

import { useState, useRef } from 'react'
import { motion } from 'framer-motion'
import {
  Sparkles,
  Mic,
  UserCircle,
  Play,
  Pause,
  Volume2,
  Loader2,
  Search,
  RefreshCw,
  Headphones,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Separator } from '@/components/ui/separator'
import { AgentExecutionPanel } from '@/components/agent-execution-panel'
import type { VoicePanelProps, VoiceInfo } from './types'

export function VoicePanel({
  characters,
  aiLoading,
  agentExec,
  activeStep,
  handleVoiceAssign,
  voices,
  activeTtsProvider,
  voiceSamples,
  generatingSample,
  handleAssignVoice,
  handleGenerateVoiceSample,
  handleBatchGenerateSamples,
}: VoicePanelProps) {
  const [searchQuery, setSearchQuery] = useState('')
  const [filterProvider, setFilterProvider] = useState<string>('all')
  const [filterLanguage, setFilterLanguage] = useState<string>('all')
  const [playingSample, setPlayingSample] = useState<string | null>(null)
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const hasVoices = characters.some((c) => c.voiceId)

  // Filter voices
  const filteredVoices = voices.filter((v) => {
    if (filterProvider !== 'all' && v.provider !== filterProvider) return false
    if (filterLanguage !== 'all' && v.language !== filterLanguage) return false
    if (searchQuery) {
      const q = searchQuery.toLowerCase()
      return (
        v.name.toLowerCase().includes(q) ||
        v.id.toLowerCase().includes(q) ||
        (v.description && v.description.toLowerCase().includes(q))
      )
    }
    return true
  })

  // Group voices by provider
  const voicesByProvider = filteredVoices.reduce<Record<string, VoiceInfo[]>>(
    (acc, v) => {
      const key = v.provider
      if (!acc[key]) acc[key] = []
      acc[key].push(v)
      return acc
    },
    {}
  )

  // Get unique providers and languages for filters
  const providers = [...new Set(voices.map((v) => v.provider))]
  const languages = [...new Set(voices.map((v) => v.language).filter(Boolean))]

  // Play/pause voice sample
  const handlePlaySample = (characterId: string) => {
    const audioUrl = voiceSamples[characterId]
    if (!audioUrl) return

    if (playingSample === characterId) {
      // Stop playing
      if (audioRef.current) {
        audioRef.current.pause()
        audioRef.current = null
      }
      setPlayingSample(null)
      return
    }

    // Stop previous audio
    if (audioRef.current) {
      audioRef.current.pause()
    }

    const audio = new Audio(audioUrl)
    audio.onended = () => {
      setPlayingSample(null)
      audioRef.current = null
    }
    audio.onerror = () => {
      setPlayingSample(null)
      audioRef.current = null
    }
    audioRef.current = audio
    audio.play().catch(() => {
      setPlayingSample(null)
    })
    setPlayingSample(characterId)
  }

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
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-3 border-b border-border/50 flex-wrap gap-2">
        <div className="flex items-center gap-3">
          <span className="text-xs font-mono text-primary/80">04</span>
          <h2 className="text-sm font-semibold">音色分配</h2>
          {hasVoices && <Badge className="status-completed text-[10px] px-1.5 py-0">已分配</Badge>}
          {activeTtsProvider && (
            <Badge variant="outline" className="text-[10px] px-1.5 py-0">
              {activeTtsProvider}
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={handleBatchGenerateSamples}
            disabled={characters.filter((c) => c.voiceId).length === 0}
          >
            <Headphones className="size-3.5" />
            批量试听
          </Button>
          <Button
            size="sm"
            onClick={handleVoiceAssign}
            disabled={aiLoading || characters.length === 0}
            className="amber-glow"
          >
            <Sparkles className="size-3.5" />
            AI自动分配
          </Button>
        </div>
      </div>

      {/* Main content: split layout */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left: Character list */}
        <div className="w-full lg:w-1/2 border-r border-border/50 flex flex-col">
          <div className="px-4 py-2 border-b border-border/50">
            <h3 className="text-xs font-semibold text-muted-foreground">角色列表</h3>
          </div>
          <ScrollArea className="flex-1">
            <div className="p-4 space-y-3">
              {characters.map((char) => (
                <Card key={char.id} className="border-border/50">
                  <CardContent className="p-3">
                    <div className="flex items-start gap-3">
                      {/* Character avatar */}
                      <div className="size-10 rounded-full bg-muted flex items-center justify-center overflow-hidden shrink-0">
                        {char.imageUrl ? (
                          <img src={char.imageUrl} alt={char.name} className="size-full object-cover" />
                        ) : (
                          <UserCircle className="size-6 text-muted-foreground" />
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
                        {char.voiceStyle && (
                          <p className="text-[10px] text-muted-foreground mb-2">音色风格: {char.voiceStyle}</p>
                        )}

                        {/* Voice assignment controls */}
                        <div className="space-y-2">
                          <div className="flex items-center gap-2">
                            <Select
                              value={char.voiceId || ''}
                              onValueChange={(voiceId) => handleAssignVoice(char.id, voiceId)}
                            >
                              <SelectTrigger className="h-7 text-xs flex-1">
                                <SelectValue placeholder="选择音色..." />
                              </SelectTrigger>
                              <SelectContent>
                                {voices
                                  .filter((v) => {
                                    // Suggest voices matching character gender
                                    if (char.gender === 'male') return v.gender === 'male' || v.gender === 'neutral'
                                    if (char.gender === 'female') return v.gender === 'female' || v.gender === 'neutral'
                                    return true
                                  })
                                  .map((v) => (
                                    <SelectItem key={v.id} value={v.id}>
                                      {v.name} ({v.provider})
                                    </SelectItem>
                                  ))}
                              </SelectContent>
                            </Select>

                            {/* Preview button */}
                            {char.voiceId && (
                              <Button
                                size="sm"
                                variant="secondary"
                                className="h-7 px-2 text-[11px] gap-1 shrink-0"
                                onClick={() => handleGenerateVoiceSample(char.id, char.voiceId!)}
                                disabled={generatingSample === char.id}
                              >
                                {generatingSample === char.id ? (
                                  <Loader2 className="size-3 animate-spin" />
                                ) : (
                                  <Volume2 className="size-3" />
                                )}
                                试听
                              </Button>
                            )}
                          </div>

                          {/* Audio player */}
                          {voiceSamples[char.id] && (
                            <div className="flex items-center gap-2">
                              <Button
                                size="sm"
                                variant="ghost"
                                className="size-6 p-0 shrink-0"
                                onClick={() => handlePlaySample(char.id)}
                              >
                                {playingSample === char.id ? (
                                  <Pause className="size-3 text-primary" />
                                ) : (
                                  <Play className="size-3" />
                                )}
                              </Button>
                              <div className="flex-1 h-1 bg-muted rounded-full overflow-hidden">
                                <div
                                  className="h-full bg-primary rounded-full transition-all"
                                  style={{
                                    width: playingSample === char.id ? '100%' : '0%',
                                    transition: playingSample === char.id ? 'width 3s linear' : 'none',
                                  }}
                                />
                              </div>
                              <Mic className="size-3 text-primary/50 shrink-0" />
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </ScrollArea>
        </div>

        {/* Right: Voice library browser */}
        <div className="hidden lg:flex lg:w-1/2 flex-col">
          <div className="px-4 py-2 border-b border-border/50 space-y-2">
            <h3 className="text-xs font-semibold text-muted-foreground">音色库</h3>
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-2 top-1/2 -translate-y-1/2 size-3 text-muted-foreground" />
                <Input
                  placeholder="搜索音色..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="h-7 text-xs pl-7"
                />
              </div>
              <Select value={filterProvider} onValueChange={setFilterProvider}>
                <SelectTrigger className="h-7 text-xs w-28">
                  <SelectValue placeholder="供应商" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">全部供应商</SelectItem>
                  {providers.map((p) => (
                    <SelectItem key={p} value={p}>{p}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={filterLanguage} onValueChange={setFilterLanguage}>
                <SelectTrigger className="h-7 text-xs w-20">
                  <SelectValue placeholder="语言" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">全部</SelectItem>
                  {languages.map((l) => (
                    <SelectItem key={l} value={l!}>{l === 'zh' ? '中文' : l === 'en' ? '英文' : l}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <ScrollArea className="flex-1">
            <div className="p-4 space-y-4">
              {Object.entries(voicesByProvider).map(([provider, providerVoices]) => (
                <div key={provider}>
                  <div className="flex items-center gap-2 mb-2">
                    <Badge variant="secondary" className="text-[10px] px-1.5 py-0">{provider}</Badge>
                    <Separator className="flex-1" />
                  </div>
                  <div className="grid grid-cols-1 gap-1.5">
                    {providerVoices.map((voice) => (
                      <div
                        key={voice.id}
                        className="flex items-center gap-2 px-2.5 py-1.5 rounded-md bg-muted/30 hover:bg-muted/50 transition-colors cursor-pointer"
                        onClick={() => {
                          // If there's a character without a voice, assign to first unassigned
                          const unassigned = characters.find((c) => !c.voiceId)
                          if (unassigned) {
                            handleAssignVoice(unassigned.id, voice.id)
                          }
                        }}
                      >
                        <Mic className="size-3 text-muted-foreground flex-shrink-0" />
                        <div className="flex-1 min-w-0">
                          <span className="text-xs font-medium">{voice.name}</span>
                          {voice.description && (
                            <p className="text-[10px] text-muted-foreground truncate">{voice.description}</p>
                          )}
                        </div>
                        {voice.gender && (
                          <Badge variant="outline" className="text-[9px] px-1 py-0">
                            {voice.gender === 'male' ? '男' : voice.gender === 'female' ? '女' : '中性'}
                          </Badge>
                        )}
                        {voice.language && (
                          <Badge variant="outline" className="text-[9px] px-1 py-0">
                            {voice.language === 'zh' ? '中' : voice.language === 'en' ? '英' : voice.language}
                          </Badge>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              ))}

              {filteredVoices.length === 0 && (
                <div className="text-center py-8 text-muted-foreground text-xs">
                  没有匹配的音色
                </div>
              )}
            </div>
          </ScrollArea>
        </div>
      </div>
    </div>
  )
}

'use client'

import { useState, useEffect, useMemo } from 'react'
import { api, type AiCategory, type ProviderPreset, type ModelOption } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Sparkles, ImageIcon, Film, ChevronDown, Check, Volume2, Search } from 'lucide-react'

interface ModelSelectorProps {
  category: AiCategory
  value: string
  onChange: (model: string) => void
}

const CATEGORY_CONFIG: Record<AiCategory, { icon: React.ReactNode; label: string; color: string }> = {
  llm: { icon: <Sparkles className="size-3.5" />, label: 'LLM', color: 'text-amber-600' },
  image: { icon: <ImageIcon className="size-3.5" />, label: '图片', color: 'text-emerald-600' },
  video: { icon: <Film className="size-3.5" />, label: '视频', color: 'text-violet-600' },
  tts: { icon: <Volume2 className="size-3.5" />, label: 'TTS', color: 'text-sky-600' },
}

const TAG_STYLES: Record<string, string> = {
  '推荐': 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400',
  '最新': 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400',
  '快速': 'bg-sky-100 text-sky-800 dark:bg-sky-900/30 dark:text-sky-400',
  '推理': 'bg-violet-100 text-violet-800 dark:bg-violet-900/30 dark:text-violet-400',
  '经济': 'bg-zinc-100 text-zinc-700 dark:bg-zinc-800/50 dark:text-zinc-400',
  '高清': 'bg-rose-100 text-rose-800 dark:bg-rose-900/30 dark:text-rose-400',
  '免费': 'bg-teal-100 text-teal-800 dark:bg-teal-900/30 dark:text-teal-400',
}

interface GroupedModels {
  provider: string
  providerName: string
  models: (ModelOption & { providerName: string })[]
}

export function ModelSelector({ category, value, onChange }: ModelSelectorProps) {
  const [presets, setPresets] = useState<ProviderPreset[]>([])
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')

  const catConfig = CATEGORY_CONFIG[category]

  useEffect(() => {
    api.settings.get().then((data) => {
      setPresets(data.presets[category] || [])
    }).catch(() => {})
  }, [category])

  // Group models by provider
  const grouped = useMemo<GroupedModels[]>(() => {
    const groups: GroupedModels[] = []
    for (const preset of presets) {
      if (preset.availableModels && preset.availableModels.length > 0) {
        const models = preset.availableModels.map(m => ({
          ...m,
          providerName: preset.name,
        }))
        groups.push({
          provider: preset.provider,
          providerName: preset.name,
          models,
        })
      }
    }
    return groups
  }, [presets])

  // Flat list for name lookup
  const allModels = useMemo(() => {
    const flat: (ModelOption & { providerName: string })[] = []
    for (const g of grouped) {
      flat.push(...g.models)
    }
    return flat
  }, [grouped])

  // Filter by search
  const filtered = useMemo(() => {
    if (!search.trim()) return grouped
    const q = search.toLowerCase()
    return grouped
      .map(g => ({
        ...g,
        models: g.models.filter(m =>
          m.name.toLowerCase().includes(q) ||
          m.id.toLowerCase().includes(q) ||
          m.tags?.some(t => t.toLowerCase().includes(q))
        ),
      }))
      .filter(g => g.models.length > 0)
  }, [grouped, search])

  // Find the display name for current model
  const currentModel = allModels.find(m => m.id === value)
  const displayName = currentModel?.name || value || '未选择'

  // Find which provider the current model belongs to
  const currentProvider = currentModel?.providerName || ''

  return (
    <Popover open={open} onOpenChange={(v) => { setOpen(v); if (!v) setSearch('') }}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="h-8 px-3 gap-1.5 text-xs font-medium hover:bg-muted/80"
        >
          <span className={catConfig.color}>{catConfig.icon}</span>
          <span className="max-w-[120px] sm:max-w-[160px] truncate">{displayName}</span>
          {currentProvider && (
            <span className="hidden sm:inline text-[10px] text-muted-foreground/70 truncate max-w-[80px]">
              {currentProvider}
            </span>
          )}
          <ChevronDown className="size-3 opacity-40 ml-0.5" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0" align="end" sideOffset={4}>
        {/* Search bar */}
        <div className="p-2 border-b border-border/50">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground/60" />
            <Input
              className="h-8 pl-8 text-xs bg-muted/40 border-border/50 focus-visible:ring-primary/20"
              placeholder="搜索模型名称、ID或标签..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              autoFocus
            />
          </div>
        </div>

        {/* Model list grouped by provider */}
        <ScrollArea className="max-h-[360px]">
          {filtered.length === 0 && (
            <p className="text-xs text-muted-foreground p-4 text-center">
              {search ? '没有匹配的模型' : '暂无可用模型，请先在设置中配置'}
            </p>
          )}
          {filtered.map((group) => (
            <div key={group.provider}>
              {/* Provider header */}
              <div className="px-3 py-1.5 text-[11px] font-semibold text-muted-foreground/80 uppercase tracking-wider bg-muted/30 border-b border-border/30">
                {group.providerName}
              </div>
              {/* Model items */}
              {group.models.map((m) => {
                const isSelected = value === m.id
                return (
                  <button
                    key={m.id}
                    onClick={() => { onChange(m.id); setOpen(false) }}
                    className={`w-full flex items-start gap-2.5 px-3 py-2 text-left hover:bg-muted/60 transition-colors ${
                      isSelected ? 'bg-primary/5' : ''
                    }`}
                  >
                    {/* Check indicator */}
                    <div className="pt-0.5 flex-shrink-0 w-4">
                      {isSelected && <Check className="size-3.5 text-primary" />}
                    </div>
                    {/* Model info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className={`text-sm font-medium truncate ${isSelected ? 'text-primary' : ''}`}>
                          {m.name}
                        </span>
                        {m.tags?.map((tag) => (
                          <Badge
                            key={tag}
                            variant="secondary"
                            className={`text-[9px] px-1 py-0 h-4 font-medium ${TAG_STYLES[tag] || ''}`}
                          >
                            {tag}
                          </Badge>
                        ))}
                      </div>
                      <div className="text-[11px] text-muted-foreground/60 mt-0.5 truncate font-mono">
                        {m.id}
                      </div>
                    </div>
                  </button>
                )
              })}
            </div>
          ))}
        </ScrollArea>
      </PopoverContent>
    </Popover>
  )
}

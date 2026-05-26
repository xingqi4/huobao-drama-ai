'use client'

import { SessionProvider, useSession } from 'next-auth/react'
import { useAppStore } from '@/lib/store'
import { AuthView } from '@/components/auth-view'
import { ProjectListView } from '@/components/project-list'
import { ProjectDetailView } from '@/components/project-detail'
import { EpisodeWorkspace } from '@/components/episode-workspace'
import { SettingsView } from '@/components/settings-view'
import { AssetLibraryView } from '@/components/asset-library-view'
import { ScriptWorkbench } from '@/components/script-workbench'
import { AssetWorkbench } from '@/components/asset-workbench'
import { Loader2 } from 'lucide-react'

// ViewRouter: 简单条件渲染，不用 AnimatePresence
// AnimatePresence mode="wait" 是页面刷新的元凶之一
// 它会在 key 变化时先把旧组件卸载(退出动画)，再挂载新组件
// 任何导致 view 短暂变化的操作都会销毁 ScriptWorkbench 的全部 state
function ViewRouter() {
  const view = useAppStore((s) => s.view)

  switch (view) {
    case 'projects':
      return <ProjectListView />
    case 'project-detail':
      return <ProjectDetailView />
    case 'script-workbench':
      return <ScriptWorkbench />
    case 'asset-workbench':
      return <AssetWorkbench />
    case 'episode-workspace':
      return <EpisodeWorkspace />
    case 'settings':
      return <SettingsView />
    case 'asset-library':
      return <AssetLibraryView />
    default:
      return <ProjectListView />
  }
}

function AuthGuard() {
  const { data: session, status } = useSession()

  // 只在初始加载（没有session数据时）显示loading
  // SessionProvider 每5秒refetch，status会短暂变为'loading'
  // 如果此时判断 status==='loading' 就显示loading页面，
  // 会导致整个app卸载再重挂载，所有组件state丢失
  if (status === 'loading' && !session) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="size-8 animate-spin text-primary" />
          <span className="text-sm text-muted-foreground">加载中...</span>
        </div>
      </div>
    )
  }

  if (!session) {
    return <AuthView />
  }

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <ViewRouter />
      <footer className="mt-auto border-t border-border/50 py-4 text-center text-xs text-muted-foreground">
        <span className="opacity-70">AI短剧创作平台 &copy; {new Date().getFullYear()}</span>
      </footer>
    </div>
  )
}

// refetchInterval 从 5 秒改为 300 秒（5分钟）
// 原来的 5 秒太频繁，每5秒触发一次 session refetch，
// 导致 AuthGuard 重渲染，进而导致 ViewRouter 和
// ScriptWorkbench 重渲染，是页面内容"刷新"的元凶
export default function Home() {
  return (
    <SessionProvider refetchInterval={300} refetchOnWindowFocus={false}>
      <AuthGuard />
    </SessionProvider>
  )
}

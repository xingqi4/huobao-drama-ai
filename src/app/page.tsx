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

// ════════════════════════════════════════════════════════════
// ViewRouter — 关键修复：
// 1. 不用 AnimatePresence（它导致组件卸载重挂载，丢失所有state）
// 2. 用 switch/case 确保同时只渲染一个组件
// 3. 工作台类视图（script-workbench/asset-workbench/episode-workspace）
//    不需要 footer，直接占满整个视口
// ════════════════════════════════════════════════════════════

// 判断是否为全屏工作台视图（不需要footer）
function isFullscreenView(view: string): boolean {
  return view === 'script-workbench' || view === 'asset-workbench' || view === 'episode-workspace'
}

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
  const view = useAppStore((s) => s.view)

  // 关键修复：只在 初始加载 且 没有session数据 时显示loading
  // 绝对不能在 session refetch 期间显示 loading，
  // 否则整个 ViewRouter 会被卸载，所有组件 state 丢失，
  // 重新挂载时就会出现"两个页面重叠"的bug
  if (status === 'loading' && !session) {
    return (
      <div className="h-screen flex items-center justify-center bg-background">
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

  // 全屏工作台视图：不用 min-h-screen + footer，直接 h-screen 占满视口
  // 这样工作台组件的 h-full 才能正确计算高度，不会出现重叠
  if (isFullscreenView(view)) {
    return (
      <div className="h-screen overflow-hidden bg-background">
        <ViewRouter />
      </div>
    )
  }

  // 普通视图：带 footer 的滚动布局
  return (
    <div className="min-h-screen flex flex-col bg-background">
      <ViewRouter />
      <footer className="mt-auto border-t border-border/50 py-4 text-center text-xs text-muted-foreground">
        <span className="opacity-70">AI短剧创作平台 &copy; {new Date().getFullYear()}</span>
      </footer>
    </div>
  )
}

// refetchInterval=0 表示不自动 refetch（只在需要时手动刷新）
// 之前的 5 秒/300 秒 refetch 都可能导致 session 状态短暂变化，
// 触发 AuthGuard 重渲染，是"页面刷新/重叠"的元凶之一
export default function Home() {
  return (
    <SessionProvider refetchInterval={0} refetchOnWindowFocus={false}>
      <AuthGuard />
    </SessionProvider>
  )
}

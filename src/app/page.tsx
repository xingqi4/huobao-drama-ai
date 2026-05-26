'use client'

import { useRef, useEffect } from 'react'
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
// ViewRouter — 纯 switch/case，同时只渲染一个组件
// ════════════════════════════════════════════════════════════

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

// ════════════════════════════════════════════════════════════
// AuthGuard — 核心修复：彻底解决"两个页面重叠"
//
// 根因：next-auth 的 useSession() 在某些情况下会短暂地把
// status 重置为 'loading' 且 session 为 null（例如浏览器
// tab 切换、网络波动等）。这导致 AuthGuard 卸载整个
// ViewRouter 并显示 loading 旋转图标，session 恢复后
// ViewRouter 重新挂载，所有组件 state 丢失，从头加载。
// 新旧两个渲染状态在浏览器中同时可见 → "两个页面重叠"。
//
// 修复方案：
//   用 hasEverHadSession ref 记住"是否曾经拿到过 session"。
//   一旦拿到过 session，就绝不再显示 loading 旋转图标，
//   也绝不卸载 ViewRouter。即使 session 短暂丢失，
//   也保持当前视图不变，只在 session 确实不存在时
//   （用户主动登出）才切换到 AuthView。
// ════════════════════════════════════════════════════════════

function AuthGuard() {
  const { data: session, status } = useSession()
  const view = useAppStore((s) => s.view)

  // 核心：一旦 session 曾经存在过，就记住这个事实
  // 这样即使 session 短暂变为 null（refetch 过程中），
  // 也不会卸载 ViewRouter
  const hasEverHadSession = useRef(false)

  useEffect(() => {
    if (session) {
      hasEverHadSession.current = true
    }
  }, [session])

  // 首次加载（从未拿到过 session）：显示 loading
  // 这只在应用启动时的初始 session 获取期间显示
  if (status === 'loading' && !hasEverHadSession.current) {
    return (
      <div className="h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="size-8 animate-spin text-primary" />
          <span className="text-sm text-muted-foreground">加载中...</span>
        </div>
      </div>
    )
  }

  // 没有 session 且之前也没有拿到过 → 显示登录页
  if (!session && !hasEverHadSession.current) {
    return <AuthView />
  }

  // 有 session，或者曾经有过 session（即使当前短暂丢失）
  // → 保持显示当前视图，绝不卸载 ViewRouter

  // 全屏工作台视图：h-screen 占满视口
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

// SessionProvider:
//   refetchInterval=0: 不自动 refetch（防止 session 状态频繁变化）
//   refetchOnWindowFocus=false: 窗口聚焦时不 refetch（防止 tab 切换触发 session 变化）
export default function Home() {
  return (
    <SessionProvider refetchInterval={0} refetchOnWindowFocus={false}>
      <AuthGuard />
    </SessionProvider>
  )
}

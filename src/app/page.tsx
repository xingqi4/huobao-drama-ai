'use client'

import { AnimatePresence, motion } from 'framer-motion'
import { useAppStore } from '@/lib/store'
import { ProjectListView } from '@/components/project-list'
import { ProjectDetailView } from '@/components/project-detail'
import { EpisodeWorkspace } from '@/components/episode-workspace'
import { SettingsView } from '@/components/settings-view'

const pageVariants = {
  initial: { opacity: 0, y: 12 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -12 },
}

const pageTransition = {
  duration: 0.25,
  ease: 'easeInOut' as const,
}

function ViewRouter() {
  const view = useAppStore((s) => s.view)

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={view}
        variants={pageVariants}
        initial="initial"
        animate="animate"
        exit="exit"
        transition={pageTransition}
        className="flex-1 flex flex-col"
      >
        {view === 'projects' && <ProjectListView />}
        {view === 'project-detail' && <ProjectDetailView />}
        {view === 'episode-workspace' && <EpisodeWorkspace />}
        {view === 'settings' && <SettingsView />}
      </motion.div>
    </AnimatePresence>
  )
}

export default function Home() {
  return (
    <div className="min-h-screen flex flex-col bg-background">
      <ViewRouter />
      <footer className="mt-auto border-t border-border/50 py-4 text-center text-xs text-muted-foreground">
        <span className="opacity-70">AI短剧创作平台 &copy; {new Date().getFullYear()}</span>
      </footer>
    </div>
  )
}

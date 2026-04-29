# Task 6-7: Frontend Views Builder

## Agent: Frontend Views Builder

## Status: COMPLETED

## Files Modified/Created:

### 1. `/src/app/page.tsx` — Main page with view routing
- Replaced placeholder with client component that uses Zustand store's `view` state
- AnimatePresence + motion.div for smooth view transitions
- Three views: projects → ProjectListView, project-detail → ProjectDetailView, episode-workspace → placeholder
- min-h-screen flex layout with sticky footer

### 2. `/src/components/project-list.tsx` — Project list view (NEW)
- Full-featured project card grid with cinema-inspired design
- Responsive grid (1→2→3→4 cols)
- Project cards with film strip sprockets, genre/style badges, meta counts, progress bar, relative time
- Create dialog with title/genre/style fields
- Delete confirmation dialog with AlertDialog
- Loading skeletons and empty state
- Amber glow hover effects on cards

### 3. `/src/components/project-detail.tsx` — Project detail view (NEW)
- Drama project detail with episode management
- Header with back button, title, tags, counts
- Episode cards with number badges, status dots, storyboard count, duration
- Add episode dialog
- Loading/empty states
- Episode hover effects with ChevronRight

## Key Decisions:
- Used CSS class `amber-glow` from the theme for primary buttons
- Used `shimmer` class for loading skeleton backgrounds
- Film strip sprockets implemented as React component (not CSS pseudo-elements) for flexibility
- Relative time function handles Chinese locale (刚刚, X分钟前, X小时前, X天前)
- Style labels mapped to Chinese (realistic→写实, anime→动漫, etc.)
- Script status uses colored dots (emerald/amber/red/zinc) instead of badges for compact display

## Dependencies on Previous Tasks:
- Task 5: Zustand store types and navigation actions
- Task 5: API client endpoints
- Task 5: CSS theme classes (amber-glow, shimmer, etc.)
- Task 4: API routes (dramas, episodes)

## Lint & TypeScript:
- ESLint passes cleanly
- TypeScript type checking passes for all new files
- Dev server compiles and serves page correctly (HTTP 200)

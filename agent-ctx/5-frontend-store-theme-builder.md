# Task 5: Frontend Store & Theme Builder

## Agent: Frontend Store & Theme Builder

### Status: COMPLETED

### What was done:

#### 1. Zustand Store (`/home/z/my-project/src/lib/store.ts`)
Created a complete Zustand store with:

- **Type Definitions**: All types aligned with Prisma schema:
  - `Drama`, `DramaDetail`, `Episode`, `EpisodeDetail`
  - `Character`, `Scene`, `Storyboard`
  - `AppView` type for client-side navigation

- **Navigation State**: 
  - `view`: tracks current view ('projects' | 'project-detail' | 'episode-workspace')
  - `selectedDramaId` / `selectedEpisodeId`: track selected entities
  - Navigation actions that properly clear related state (e.g., navigating to projects clears drama/episode cache)

- **Data Cache**:
  - `dramas` / `setDramas`: list cache for project list view
  - `currentDrama` / `setCurrentDrama`: detailed drama with episodes, characters, scenes
  - `currentEpisode` / `setCurrentEpisode`: detailed episode with storyboards

- **Loading States**:
  - `loading` / `setLoading`: general API loading
  - `aiLoading` / `setAiLoading`: AI-specific operations (longer running)

#### 2. API Client (`/home/z/my-project/src/lib/api.ts`)
Created a fully typed API client with:

- **Helper**: `request<T>()` wrapper with proper error handling
- **Dramas**: list, get, create, update, delete
- **Episodes**: list (by drama), get, create, update, delete
- **Characters**: list (by drama), create
- **Scenes**: list (by drama), create
- **Storyboards**: list (by episode), create, update
- **AI Endpoints**: rewriteScript, extract, generateStoryboard, generateImage, generateCharacterImage
- All methods use typed return values from store type definitions
- List endpoints unwrap nested response objects (e.g., `{ dramas }` → `Drama[]`)

#### 3. Dark Cinema Theme (`/home/z/my-project/src/app/globals.css`)
Updated globals.css with a comprehensive dark cinema-inspired theme:

- **Color Scheme** (both light and dark modes):
  - Warm-tinted backgrounds with amber/gold primary accent
  - Dark mode: near-black backgrounds with warm tint, amber/gold (#D4A04A-equivalent) primary
  - Copper/amber secondary accents
  - Warm white text colors
  - Subtle warm gray borders
  - Cinema-themed chart palette

- **Custom Scrollbar**: Dark warm-toned scrollbar for both WebKit and Firefox

- **Amber Glow Effects**: `.amber-glow` and `.amber-glow-strong` for primary buttons and active states

- **Film Strip Decorations**: 
  - `.film-strip-top` / `.film-strip-bottom`: Simple film strip lines
  - `.film-strip-sprockets`: Full sprocket hole decoration for hero cards

- **Pattern Backgrounds**:
  - `.dot-pattern-bg`: Subtle dot grid
  - `.grid-pattern-bg`: Subtle line grid

- **Cinema Utilities**:
  - `.clapper-border`: Left amber border accent
  - `.warm-overlay`: Warm gradient overlay for images
  - `.fade-bottom`: Fade mask for overflowing text

- **Status Badges**: Pre-built status classes (pending/processing/completed/failed) with matching colors

- **Animations**:
  - `.amber-pulse`: Pulsing amber glow for processing states
  - `.shimmer`: Loading skeleton animation

### Testing:
- Lint passes cleanly with no errors
- Dev server compiling successfully
- All TypeScript types properly defined and exported

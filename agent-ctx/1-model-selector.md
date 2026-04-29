# Task 1: Model Selector in Workspace Header

## Summary
Added a compact model selector dropdown in the episode workspace header bar, allowing users to pick which AI model to use for LLM, image, and video generation without going to settings.

## Changes Made

### 1. New Component: `/home/z/my-project/src/components/model-selector.tsx`
- Compact Popover-based dropdown showing current model name with category icon
- Fetches available models from settings API presets
- Supports all 4 AI categories: llm, image, video, tts
- Tiny footprint (h-6, px-2, text-[10px]) to fit in header bar
- Shows model name truncated, with check mark for selected model

### 2. Updated: `/home/z/my-project/src/components/episode-workspace.tsx`
- Added `ModelSelector` import
- Replaced `activeModels` state (display-only badges) with `workspaceModels` state (interactive selection)
- `workspaceModels` initialized from active provider config via `api.ai.getActiveModels()`
- Replaced 3 static model badges (llm, image, video) with 3 interactive `ModelSelector` components
- Updated all 5 `agentExec.startAgent()` calls to pass `{ model: workspaceModels.llm || undefined }`:
  - script_rewriter
  - extractor
  - voice_assigner
  - storyboard_breaker
  - grid_prompt_generator

### 3. Updated: `/home/z/my-project/src/components/agent-execution-panel.tsx`
- Added `options?: { model?: string }` parameter to `startAgent` function
- Passes `model: options?.model` in the JSON body of the SSE stream request

### 4. Updated: `/home/z/my-project/src/app/api/agent/[type]/stream/route.ts`
- Added `model` to the parsed request body type
- Destructures `model` from request body
- Passes `{ modelOverride: model }` to `executeAgent`

### 5. Updated: `/home/z/my-project/src/lib/agents/factory.ts`
- Added `options?: { modelOverride?: string }` parameter to `executeAgent`
- Model priority: workspace override > DB config > provider default
- Changed: `const model = options?.modelOverride || dbConfig?.model || undefined`

### Image/Video/TTS Model Passthrough
- The image, video, and TTS API routes currently use the active provider from DB settings
- They don't accept model overrides yet - the workspace selectors for image/video/tts are in the UI for future integration
- As specified in the task, focus was on LLM agent model selection (most impactful)

## Verification
- `bun run lint` passes with no errors
- Dev server compiles successfully

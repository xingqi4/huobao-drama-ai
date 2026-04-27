---
Task ID: 1
Agent: Main Agent
Task: Implement Seedance 2.0 video model, extract module save/image gen, and progress indicators

Work Log:
- Explored full project structure and read key files (ai-config.ts, episode-workspace.tsx, api.ts, store.ts, route files)
- Added Seedance 2.0 provider preset to PROVIDER_PRESETS.video in ai-config.ts
- Added _generateVideoSeedance() method with SiliconFlow API submit/poll pattern, image_url support for first frame
- Updated generateVideo() dispatch to include 'seedance' provider branch
- Created /api/ai/generate-scene-image/route.ts for scene image generation
- Created /api/ai/extract-stream/route.ts with SSE progress streaming (validating → analyzing → extracting → saving-characters → saving-scenes → completed)
- Created /api/ai/generate-storyboard-stream/route.ts with SSE progress streaming (validating → analyzing → generating → clearing → saving per shot → completed)
- Updated frontend api.ts with generateSceneImage(), extractStream(), generateStoryboardStream() methods
- Updated episode-workspace.tsx with:
  - New state: generatingSceneImg, generationProgress, batchProgress
  - handleGenerateSceneImage() for individual scene image generation
  - handleGenerateAllExtractImages() for batch character + scene image generation
  - Updated handleExtract() to use extractStream() with SSE progress
  - Updated handleGenerateStoryboard() to use generateStoryboardStream() with SSE progress
  - Updated handleGenerateAllImages() and handleGenerateAllVideos() with batch progress tracking
  - Extract panel: progress bar during extraction, scene image gen/upload buttons, one-click batch gen button
  - Storyboard panel: progress bar during generation
  - Production panel: batch progress bar during batch image/video generation
- Ran lint check - passes cleanly
- Dev server running successfully

Stage Summary:
- Seedance 2.0 fully integrated as video provider (backend + auto-appears in settings)
- Extract module now supports scene image generation, upload, and one-click batch generation
- All three modules (extract, storyboard, production) now show intermediate progress with Progress bar + step descriptions
- 4 new files created, 3 existing files modified

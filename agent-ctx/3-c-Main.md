# Task 3-c: 实现参考图注入机制

## Summary
Implemented the core reference image injection mechanism that ensures AI-generated storyboard frames maintain character and scene consistency by collecting and injecting reference images from the database.

## Files Created
- `/src/lib/reference-collector.ts` — Central utility with 4 exports:
  - `collectStoryboardReferences()` — Collects character + scene refs from episode→drama chain
  - `buildEnhancedPrompt()` — Injects text descriptions for non-reference-image providers
  - `collectCharacterReferences()` — Collects primary appearance as reference
  - `collectSceneReferences()` — Collects selected scene images as reference

## Files Modified
- `/src/lib/ai-config.ts` — Added `referenceImages?: string[]` param to:
  - `generateCharacterPortrait()`
  - `generateStoryboardFrame()`
  - `generateSceneImage()`
- `/src/app/api/ai/generate-image/route.ts` — Accepts episodeId/dialogueChar/sceneLocation, uses collectors
- `/src/app/api/ai/generate-character-image/route.ts` — Auto-injects character primary appearance ref
- `/src/app/api/ai/generate-scene-image/route.ts` — Auto-injects scene selected image ref
- `/src/app/api/characters/[id]/appearances/route.ts` — Auto-collects refs for sub-appearance generation
- `/src/app/api/scenes/[id]/images/route.ts` — Auto-collects refs for new scene image generation

## Key Design Decisions
1. **Dual strategy**: Reference images are passed to adapters that support them (MiniMax), while text descriptions are injected into the prompt for providers that don't support reference images natively.
2. **URL filtering**: Only `data:` and `http` URLs are accepted as valid references.
3. **Deduplication**: All reference URLs are deduplicated before injection.
4. **Backward compatibility**: All new parameters are optional; existing calls work unchanged.
5. **Automatic + explicit merge**: Routes auto-collect references from DB and merge with explicitly provided ones.

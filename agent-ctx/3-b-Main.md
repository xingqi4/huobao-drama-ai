# Task 3-b: 创建核心资产API

## Task Summary
Created API routes for character appearance management and scene image management — the core "asset" APIs for ensuring consistency in AI-generated images.

## Files Created
1. `/src/app/api/characters/[id]/appearances/route.ts` - GET (list all) + POST (create/generate with AI Vision)
2. `/src/app/api/characters/[id]/appearances/[appearanceId]/route.ts` - GET + PATCH (select image, update label) + DELETE
3. `/src/app/api/scenes/[id]/images/route.ts` - GET (list all) + POST (create/generate)
4. `/src/app/api/scenes/[id]/images/[imageId]/route.ts` - GET + PATCH (select, update) + DELETE
5. `/src/app/api/ai/generate-character-sheet/route.ts` - POST (三视图 + portrait generation)

## Files Modified
6. `/src/app/api/ai/generate-character-image/route.ts` - Added referenceImages, CharacterAppearance creation, AI Vision description extraction
7. `/src/app/api/ai/generate-scene-image/route.ts` - Added referenceImages, SceneImage creation

## Key Design Decisions
- CharacterAppearance.imageUrls is a JSON string field — API layer handles JSON.parse/stringify transparently
- When selectedIndex changes, imageUrl is automatically updated from imageUrls[selectedIndex], with previousImageUrl saved for rollback
- Scene image selection (isSelected) cascades to update Scene.imageUrl for backward compatibility
- Delete operations auto-select the next available image if the deleted one was selected
- Character sheet (三视图) generates both a reference sheet and a portrait, using the sheet as reference for the portrait
- AI Vision description extraction is non-fatal — failures are logged but don't block the response

## Integration with 3-c (Reference Collector)
After this task was completed, task 3-c enhanced the appearances and scene-images routes with automatic reference collection from `@/lib/reference-collector`. The final versions of these files include both the core CRUD logic from this task and the reference injection enhancements.

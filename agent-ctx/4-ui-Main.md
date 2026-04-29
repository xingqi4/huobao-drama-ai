# Task 4-ui: 前端资产卡片UI

## Summary
Updated the episode workspace frontend to integrate character appearance and scene image asset management.

## Changes Made

### 1. episode-workspace.tsx - Added handleGenerateCharSheet handler
- New handler that calls `api.ai.generateCharacterSheet(characterId)` to generate character reference sheets (三视图)
- Uses existing `generatingCharImg` state to track loading
- Toast notifications for success/failure

### 2. episode-workspace.tsx - Updated character card rendering
- Changed layout from `flex gap-3` to `flex items-start gap-3` for better vertical alignment
- Avatar images now use explicit `w-16 h-16` instead of `size-16`
- Added "设定图" badge (green outline) when character has imageUrl
- Added "生成设定图" button with Layers icon (variant="outline")
- Changed "生成头像" button from ghost to outline variant with ImageIcon
- Changed "本地上传头像" button text to just "上传" for compactness
- Removed "复制外貌描述" button to reduce clutter (keeping core asset actions)

### 3. episode-workspace.tsx - Updated scene card rendering
- Scene images now use explicit `w-16 h-16` instead of `size-16`
- Added "参考图" badge (green outline with ImageIcon) when scene has imageUrl
- Changed "生成场景图" button from ghost to outline variant with ImageIcon
- Removed "复制场景提示词" button to reduce clutter
- Changed "上传场景图" button text to just "上传"

### 4. episode-workspace.tsx - Updated handleGenerateShotImage
- Now passes `selectedEpisodeId` and `storyboard.dialogueChar` to `api.ai.generateImage()` for reference image injection

### 5. episode-workspace.tsx - Updated handleGenerateAllImages
- Same change as above: passes `selectedEpisodeId` and `sb.dialogueChar` for each storyboard

## Notes
- The `api.ai.generateCharacterSheet` method was already added by the parallel task (4-api)
- The `api.ai.generateImage` method signature was already updated to accept `episodeId`, `dialogueChar`, `sceneLocation` parameters
- Lint check passed with no errors

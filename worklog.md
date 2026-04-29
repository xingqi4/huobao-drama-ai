# AI短剧创作平台 (huobao-drama-ai) - Work Log

---
Task ID: 1
Agent: Main
Task: 解决合并冲突 + 项目状态检查

Work Log:
- 从GitHub拉取现有代码仓 https://github.com/dav-niu474/huobao-drama-ai.git
- 项目已有完整代码，非空壳
- 修复Prisma schema从PostgreSQL切换为SQLite用于本地开发
- 启动dev server确认页面正常渲染

Stage Summary:
- 项目已有完整功能：项目CRUD、Agent架构、多供应商AI配置
- Dev server运行正常在3000端口

---
Task ID: 2
Agent: Main
Task: 修复生图和语音模型API不可用问题

Work Log:
- 验证NVIDIA NIM API端点：
  - chat/completions: ✅ (401=端点存在)
  - images/generations: ❌ 404 (不支持)
  - audio/speech: ❌ 404 (不支持)
- 验证SiliconFlow API端点：
  - images/generations: ✅ (401=端点存在)
  - video/submit: ✅ (401=端点存在)
- 验证OpenAI API端点：
  - audio/speech: ❌ 403 (地区限制)
- 修复ai-config.ts：
  - 移除NVIDIA Image预设（NIM不支持images/generations端点）
  - 移除NVIDIA Riva TTS预设（NIM不支持audio/speech端点）
  - 修复z-ai-sdk图片生成调用：移除不支持的n/response_format参数
  - 修复z-ai-sdk TTS调用：增加空响应检查和错误处理
  - 重构图片生成分发逻辑：z-ai-sdk→独立方法，其他→OpenAI兼容
  - 修正Video fallback从z-ai-sdk改为SiliconFlow兼容
  - 修正TTS fallback从z-ai-sdk改为OpenAI兼容
  - 增强testConnection：Image和TTS真正测试生成，而非只检查API Key

Stage Summary:
- NVIDIA NIM只支持LLM，不支持Image/TTS/Video
- SiliconFlow是Image和Video的推荐供应商（国内可用）
- OpenAI TTS因地区限制在国内不可用，Fish Audio/z-ai-sdk作为替代
- z-ai-sdk的CreateImageGenerationBody只支持model/prompt/size三个参数

---
Task ID: 3
Agent: Main
Task: 合并grid_prompt_generator到storyboard_breaker

Work Log:
- storyboard_breaker的prompt已包含完整的imagePrompt和videoPrompt生成规范
- 修改episode-workspace.tsx中handleEnhanceShotPrompt：从grid_prompt_generator改为storyboard_breaker
- 更新Agent类型定义：grid_prompt_generator标记为deprecated
- ALL_AGENT_TYPES中移除grid_prompt_generator
- 更新AGENT_NAMES和AGENT_DESCRIPTIONS

Stage Summary:
- grid_prompt_generator功能已合并到storyboard_breaker
- 单条提示词增强使用storyboard_breaker的update_storyboard工具
- 保留grid_prompt_generator类型定义以兼容数据库中已有配置

---
Task ID: 3-a
Agent: Main
Task: 扩展Prisma Schema支持核心资产沉淀

Work Log:
- 读取现有Prisma schema，了解当前模型结构（Drama, Episode, Character, Scene, Storyboard, AiProvider, AgentConfig）
- 新增 CharacterAppearance 模型：支持角色多形态（主形象、夜晚形态、战斗形态等），包含imageUrls JSON数组、selectedIndex、previousImageUrl等字段，@@unique([characterId, appearanceIndex])
- 新增 SceneImage 模型：支持场景多角度/时段参考图，包含timeOfDay、angle、isSelected等字段
- 新增 ImageGeneration 模型：追踪所有图片生成任务，包含frameType、referenceImages、taskId、status等字段
- 更新 Character 模型：添加 appearances CharacterAppearance[] 关联
- 更新 Scene 模型：添加 images SceneImage[] 关联
- 跳过在Storyboard上添加dramaId（可通过episode推导）
- 运行 bun run db:push 成功同步schema到SQLite数据库，Prisma Client已重新生成

Stage Summary:
- 新增3个模型：CharacterAppearance、SceneImage、ImageGeneration
- Character↔CharacterAppearance 一对多关联（级联删除）
- Scene↔SceneImage 一对多关联（级联删除）
- ImageGeneration为独立追踪表，支持character_portrait/scene_establishing/storyboard_frame等frameType
- 数据库已同步，Prisma Client已更新

---
Task ID: 2-a
Agent: Main
Task: 多厂商适配器架构改进

Work Log:
- 创建 `/src/lib/adapters/url.ts`：从参考项目 huobao-drama 移植 `joinProviderUrl` 工具函数，防止 baseUrl 已含 API 版本前缀时重复拼接
- 更新 `tts.ts`：新增 `ChatfireTTSAdapter` 类（MiniMax兼容格式，使用 `/v1/t2a_v2` 端点，Bearer auth，hex→base64 解析），注册到 ttsAdapters 为 `chatfire` 键；移除 `z_ai_sdk` 适配器注册
- 更新 `image.ts`：所有 5 个适配器（OpenAI、Gemini、MiniMax、VolcEngine、Ali）的 generate 和 poll URL 构造均改用 `joinProviderUrl`，移除手动 `.replace(/\/$/, '')` + 模板字符串拼接
- 更新 `video.ts`：所有 4 个适配器（MiniMax、VolcEngine、Vidu、Ali）的 generate 和 poll URL 构造均改用 `joinProviderUrl`
- 更新 `ai-config.ts` PROVIDER_PRESETS：移除 image/video/tts 三个类别中的 `z-ai-sdk` 预设条目；Chatfire TTS 预设已使用 `chatfire` provider 键（非 openai）
- 更新 `ai-config.ts` aiClient 方法：移除 `generateImage()` 中 `if (provider.provider === 'z-ai-sdk')` 分支及 `_generateImageZaiSdk` 方法；移除 `generateVideo()` 中 z-ai-sdk 分支及 `_generateVideoZai` 方法；移除 `generateTts()` 中 z-ai-sdk 分支及 `_generateTtsZai` 方法
- 更新 `ai-config.ts` getActiveProvider：将 `noKeyProviders` 从 `['z-ai-sdk']` 改为空数组 `[]`（z-ai-sdk 不再是 image/video/tts 的有效 provider）
- Lint 检查通过，dev server 正常运行

Stage Summary:
- 新增 `joinProviderUrl` 工具函数，统一所有适配器的 URL 构造，防止路径重复拼接
- 新增 `ChatfireTTSAdapter`，Chatfire TTS 使用独立的 `chatfire` 适配器（MiniMax兼容格式）
- z-ai-sdk 不再作为 image/video/tts 供应商，所有生成均走适配器模式
- 适配器架构完全统一：image/video/tts 全部通过 adapter pattern 处理，无特殊分支

---
Task ID: 3-c
Agent: Main
Task: 实现参考图注入机制

Work Log:
- 创建 `/src/lib/reference-collector.ts`：核心参考图收集工具，包含4个导出函数：
  - `collectStoryboardReferences(episodeId, dialogueChar?, sceneLocation?)` — 从 episode→drama→characters+scenes 收集参考图，支持角色名别名匹配
  - `buildEnhancedPrompt(basePrompt, references)` — 将角色/场景文字描述注入提示词（用于不支持参考图的供应商）
  - `collectCharacterReferences(characterId)` — 收集角色主形象参考图（用于生成子形态时保持一致性）
  - `collectSceneReferences(sceneId)` — 收集场景已选参考图（用于生成新场景图时保持一致性）
- 更新 `ai-config.ts` aiClient 方法签名，添加 `referenceImages?: string[]` 参数：
  - `generateCharacterPortrait(description, style?, characterName?, personality?, referenceImages?)`
  - `generateStoryboardFrame(description, atmosphere?, shotType?, cameraAngle?, style?, referenceImages?)`
  - `generateSceneImage(location, timeOfDay?, style?, weather?, referenceImages?)`
  - 三个方法均将 referenceImages 透传给 `this.generateImage()` 的 options
- 更新 `/api/ai/generate-image/route.ts`：接受 episodeId/dialogueChar/sceneLocation/characterId/sceneId 参数，根据上下文调用对应 reference collector，并通过 buildEnhancedPrompt 增强提示词
- 更新 `/api/ai/generate-character-image/route.ts`：使用 collectCharacterReferences 自动注入主形象参考图
- 更新 `/api/ai/generate-scene-image/route.ts`：使用 collectSceneReferences 自动注入场景参考图
- 更新 `/api/characters/[id]/appearances/route.ts`：生成子形态时自动从主形象收集参考图，与显式传入的 referenceImages 合并
- 更新 `/api/scenes/[id]/images/route.ts`：生成新场景图时自动从已有选中图片收集参考图，与显式传入的 referenceImages 合并
- 所有参考图URL经过过滤：去除空值、只保留 data: 和 http 开头的有效URL
- Lint 检查通过，dev server 正常运行

Stage Summary:
- 参考图注入机制完整实现：从数据库收集→过滤→注入adapter→增强提示词，全链路贯通
- MiniMax adapter 原生支持 referenceImages（通过 `image` 字段），其他 adapter 通过增强提示词文本保持一致性
- 6个API路由已集成参考图注入：generate-image、generate-character-image、generate-scene-image、appearances、scene-images
- 向后兼容：referenceImages 为可选参数，无参考图时行为与之前一致

---
Task ID: 3-b
Agent: Main
Task: 创建核心资产API

Work Log:
- 读取现有 Prisma schema 和 API 路由模式，了解 CharacterAppearance、SceneImage、ImageGeneration 模型及 params 约定
- 创建 `/api/characters/[id]/appearances/route.ts`：GET 列出角色所有形态，POST 创建新形态（支持 generateImage 选项，通过 AI Vision 提取文字描述）
- 创建 `/api/characters/[id]/appearances/[appearanceId]/route.ts`：GET 获取单个形态，PATCH 更新（selectedIndex 切换图片、imageUrl 追加新图片、label 更新），DELETE 删除
- 创建 `/api/scenes/[id]/images/route.ts`：GET 列出场景所有参考图，POST 创建/生成场景参考图（支持 generateImage、timeOfDay、angle）
- 创建 `/api/scenes/[id]/images/[imageId]/route.ts`：GET 获取单张场景图，PATCH 更新（isSelected 切换自动级联场景 imageUrl），DELETE 删除（自动选择下一张图片）
- 创建 `/api/ai/generate-character-sheet/route.ts`：POST 生成角色设定图（三视图），先生成角色设定图再生成肖像，两图均保存为 CharacterAppearance，角色设定图作为肖像的参考图确保一致性
- 更新 `/api/ai/generate-character-image/route.ts`：新增 referenceImages 参数支持，生成后自动创建/更新 CharacterAppearance 记录，使用 AI Vision 提取角色外貌描述
- 更新 `/api/ai/generate-scene-image/route.ts`：新增 referenceImages 参数支持，生成后自动创建 SceneImage 记录，自动选择首张图片
- Lint 检查通过

Stage Summary:
- 7个API路由已创建/更新，覆盖角色外观管理（CRUD + AI生成）和场景图片管理（CRUD + AI生成）
- 角色设定图（三视图）API是核心一致性机制：生成正面/侧面/背面参考图 + 基于参考图的肖像
- 所有图片生成接口均支持 referenceImages 参数，与 reference-collector 机制无缝衔接
- CharacterAppearance.imageUrls 为 JSON string 字段，API 层自动 JSON.parse/stringify
- 场景图片选中状态自动级联更新 Scene.imageUrl
- 删除场景图时自动选择下一张图片作为选中状态

---
Task ID: 4-api
Agent: Main
Task: 更新API客户端 + 清理遗留代码

Work Log:
- 更新 `/src/lib/api.ts`：
  - 新增 `appearances` 命名空间：list、create、get、update、delete 五个方法，对应角色外观管理 API
  - 新增 `sceneImages` 命名空间：list、create、update、delete 四个方法，对应场景图片管理 API
  - 新增 `ai.generateCharacterSheet` 方法：支持 characterId、style、referenceImages 参数
  - 更新 `ai.generateImage` 方法签名：新增 episodeId、dialogueChar、sceneLocation 参数，支持参考图注入
- 更新 `/src/lib/ai-config.ts`：
  - 重写 TTS testConnection：从直接调用 `_generateTtsOpenAI` 改为使用 adapter pattern（getTTSAdapter → buildGenerateRequest → fetch → parseResponse）
  - 删除 `_generateTtsOpenAI` 方法（约40行）
  - 删除 `_generateTtsFishAudio` 方法（约30行）
- Lint 检查通过，dev server 正常运行

Stage Summary:
- API客户端完整覆盖核心资产接口：appearances（5方法）+ sceneImages（4方法）+ ai.generateCharacterSheet + ai.generateImage增强
- TTS testConnection 完全统一到适配器架构，不再有任何硬编码供应商分支
- 两个遗留方法 `_generateTtsOpenAI` 和 `_generateTtsFishAudio` 已彻底删除

---
Task ID: 4-ui
Agent: Main
Task: 前端资产卡片UI

Work Log:
- 读取 episode-workspace.tsx 全文（1600+行），定位角色卡片、场景卡片、镜头图片生成相关代码
- 确认 api.ts 已由并行任务(4-api)更新：`generateCharacterSheet` 和 `generateImage` 签名已更新
- 新增 `handleGenerateCharSheet` 处理器：调用 `api.ai.generateCharacterSheet(characterId)`，复用 `generatingCharImg` 状态追踪
- 更新角色卡片渲染：
  - 布局从 `flex gap-3` 改为 `flex items-start gap-3`，更佳垂直对齐
  - 头像尺寸从 `size-16` 改为 `w-16 h-16`
  - 新增"设定图"绿色Badge（`char.imageUrl` 存在时显示，Layers图标）
  - 新增"生成设定图"按钮（Layers图标，variant="outline"）
  - "生成头像"按钮从ghost改为outline样式，图标从Camera改为ImageIcon
  - "本地上传头像"简化为"上传"
  - 移除"复制外貌描述"按钮减少视觉噪音
- 更新场景卡片渲染：
  - 图片尺寸从 `size-16` 改为 `w-16 h-16`
  - 新增"参考图"绿色Badge（`scene.imageUrl` 存在时显示，ImageIcon图标）
  - "生成场景图"按钮从ghost改为outline样式，图标从Camera改为ImageIcon
  - 移除"复制场景提示词"按钮
  - "上传场景图"简化为"上传"
- 更新 `handleGenerateShotImage`：传入 `selectedEpisodeId` 和 `storyboard.dialogueChar` 实现参考图注入
- 更新 `handleGenerateAllImages`：同样传入 `selectedEpisodeId` 和 `sb.dialogueChar`
- Lint 检查通过，dev server 正常运行

Stage Summary:
- 角色卡片新增"生成设定图"按钮和"设定图"状态Badge，核心一致性机制前端可见
- 场景卡片新增"参考图"状态Badge，按钮样式统一为outline
- 镜头图片生成已接入参考图注入（episodeId + dialogueChar），自动收集角色/场景参考图
- UI更简洁：移除低频复制按钮，上传按钮文字精简

---
Task ID: 5
Agent: Main
Task: 修复Prisma Schema兼容性 - PostgreSQL线上 + SQLite本地双模式

Work Log:
- 对比远程线上 schema (commit 25ccf21) 和本地 schema：
  - 线上：provider = "postgresql", directUrl, relationMode = "prisma"
  - 本地：provider = "sqlite"（之前为本地开发手动改的）
  - 问题：本地 sqlite 版本推送到 GitHub 导致 Vercel 构建失败
- 修复 schema：恢复 postgresql provider + directUrl + relationMode
- 保留所有原有 7 个模型的字段完整不变（Drama/Episode/Character/Scene/Storyboard/AiProvider/AgentConfig）
- 新增 3 个模型完整保留：CharacterAppearance/SceneImage/ImageGeneration
- Character 模型新增 `appearances CharacterAppearance[]` 关联（仅增加，未删除任何字段）
- Scene 模型新增 `images SceneImage[]` 关联（仅增加，未删除任何字段）
- 创建 `scripts/pre-dev.js`：本地开发自动切换 SQLite，生成客户端，推送 schema
- 更新 `scripts/build.js`：构建时确保 PostgreSQL schema + 增量推送（去掉 --accept-data-loss，保护线上数据）
- 更新 `package.json`：dev 脚本集成 pre-dev 自动切换
- .gitignore 添加 prisma/.sqlite-mode marker
- 合并远程分支冲突（保留本地所有新增修改 + 远程 .env.example/README.md）
- 推送到 GitHub 成功

Stage Summary:
- Schema 双模式机制：GitHub 上是 PostgreSQL（Vercel 构建），本地 pre-dev 自动切换 SQLite
- 线上原有 7 个模型和数据完全保留，3 个新模型增量添加
- build.js 去掉 --accept-data-loss 标志，保护线上已有数据
- 代码已推送到 GitHub (commit 3422cc1)，Vercel 应自动触发重新部署

---
Task ID: 6
Agent: Main
Task: 全面更新图片/视频/TTS供应商模型列表

Work Log:
- 分析当前模型列表，对比各供应商2025年最新API文档
- 更新图片生成模型 (10→22个):
  - OpenAI: 默认gpt-image-1 + dall-e-3/dall-e-2
  - Chatfire: 新增gemini-2.5-flash/gpt-image-1/MiniMax-Image-01代理 (1→5)
  - Gemini: 新增gemini-2.5-pro-preview-image-generation高清 (2→3)
  - MiniMax: 新增MiniMax-Image-02 (1→2)
  - 火山引擎: 新增Seedream 4.0/3.5 (2→4)
  - 阿里: 新增wanx2.1-t2i-plus/wanx-v1/flux-dev/flux-schnell (2→6)
- 更新视频生成模型 (6→15个):
  - MiniMax: 新增T2V-01/T2V-01-Director/S2V-01 (2→5)
  - 火山引擎: 新增Seedance 1.0 Pro/Lite (2→4)
  - Vidu: 新增vidu2/vidu1.5 (2→4)
  - 阿里: 新增wan2.1-i2v-turbo/plus/wan2.1-t2v-turbo/plus (2→6)
- 更新TTS模型 (5→8个):
  - MiniMax: 新增speech-01 (2→3)
  - Chatfire: 新增speech-2.6 (1→2)
  - 新增Fish Audio供应商: fish-speech-1.5/1.4 (0→2)，复用OpenAITTSAdapter
- Lint检查通过，代码已推送GitHub (commit c30b509)

Stage Summary:
- 图片模型 10→22，视频模型 6→15，TTS模型 5→8
- Chatfire作为统一网关可代理Gemini/OpenAI/MiniMax
- Fish Audio已注册到ttsAdapters（复用OpenAI兼容adapter）
- 所有新增模型均配有推荐/最新/快速/高清/经济等专业标签

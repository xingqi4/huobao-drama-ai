---
Task ID: 1
Agent: Main Orchestrator
Task: 克隆并扫描参考工程 chatfire-AI/huobao-drama 源码

Work Log:
- 克隆参考工程到 /tmp/huobao-drama-ref
- 全面扫描参考工程源码：后端(Hono+Drizzle+Mastra)、前端(Nuxt3+Vue3)
- 分析5个Mastra Agent架构：script_rewriter, extractor, storyboard_breaker, voice_assigner, grid_prompt_generator
- 分析多厂商适配层：6个图片适配器、4个视频适配器、1个TTS适配器，Registry模式+MiniMax默认fallback
- 分析Grid图片系统：生成合成网格图→Sharp分割→分配到storyboard
- 分析FFmpeg合成：单镜头合成(video+TTS+字幕)→整集合并(concat)
- 分析当前项目架构：Agent系统已建但前端未接入，使用简单LLM调用
- 识别关键差距

Stage Summary:
- 参考工程：Hono后端 + Nuxt3前端 + Mastra Agent + 14表 + FFmpeg + Grid系统
- 当前项目：Next.js全栈 + 7表 + Agent已建未用 + 客户端合成 + 无Grid系统
- 关键差距：①Agent未接入前端 ②无Grid图片系统 ③无服务端FFmpeg合成 ④无整集视频合并 ⑤多厂商无Registry模式 ⑥音色分配/Grid提示词Agent未使用

---
Task ID: 6
Agent: SSE Streaming Upgrade Agent
Task: Upgrade Agent API to support SSE streaming for real-time progress feedback

Work Log:
- Read existing codebase: agent types, factory, tools, existing API route at `/api/agent/[type]`
- Read existing SSE patterns from `extract-stream` and `generate-storyboard-stream` routes
- Created new SSE streaming route at `/api/agent/[type]/stream/route.ts`
  - POST endpoint returning `text/event-stream` response
  - Validates agent type and request body (episodeId, dramaId, message)
  - Uses `executeAgent()` with `onProgress` callback to stream progress events
  - Sends SSE events: `starting`, `thinking`, `tool_call`, `tool_result`, `tool_error`, `error`, `completed`
  - Completed event includes full result: text, toolCalls, steps
  - Error handling with proper SSE error event before stream close
- Added three new methods to `api.ai` object in `/src/lib/api.ts`:
  - `agentStream()` — SSE streaming with onProgress callback, returns Promise with result
  - `agentExecute()` — Non-streaming simple POST to existing `/api/agent/[type]` route
  - `agentGetConfig()` — GET agent config from existing `/api/agent/[type]` route
- Lint passes clean, no TypeScript errors

Stage Summary:
- SSE streaming route created and fully functional
- Client API methods added with proper types and error handling
- Backward compatible: existing non-streaming route remains untouched
- Pattern consistent with existing SSE routes (extractStream, generateStoryboardStream)

---
Task ID: 6
Agent: Main Orchestrator
Task: 升级Agent API支持SSE流式输出 + 前端切换到Agent调用

Work Log:
- 创建了 /api/agent/[type]/stream SSE流式路由，支持实时进度反馈
- 在 api.ts 中添加了 agentStream/agentExecute/agentGetConfig 三个方法
- 将前端3个核心AI操作从简单LLM调用切换到Agent架构：
  - handleRewrite → script_rewriter Agent
  - handleExtract → extractor Agent  
  - handleGenerateStoryboard → storyboard_breaker Agent
- 添加了 voice_assigner Agent 的前端调用 (handleVoiceAssign)
- 扩展管线为6步：原始内容→AI改写→提取→音色分配→分镜→制作
- 添加了音色分配面板 (renderVoicePanel)
- 更新了 isStepCompleted 函数支持 voice 步骤
- 创建了5个SKILL.md文件用于Agent专业技能指南

Stage Summary:
- 前端已完全切换到Agent架构，所有AI操作现在通过Agent执行
- 管线从4步扩展为6步（增加音色分配步骤）
- Agent执行支持SSE实时进度反馈
- 5个SKILL.md提供专业领域知识增强Agent表现

---
Task ID: 7-8
Agent: Main Orchestrator
Task: 扩展前端管线 + 完善制作模块

Work Log:
- 管线从4步扩展为6步：原始内容→AI改写→提取→音色分配→分镜→制作
- 前端3个核心AI操作切换到Agent架构（script_rewriter/extractor/storyboard_breaker）
- 添加voice_assigner Agent前端调用（handleVoiceAssign）
- 添加音色分配面板（renderVoicePanel）：角色卡片展示、音色状态、AI一键分配
- 制作模块步骤编号更新为06
- 创建5个SKILL.md文件：script_rewriter/extractor/storyboard_breaker/voice_assigner/grid_prompt_generator

Stage Summary:
- 完成了与参考工程的核心差距弥补：Agent架构已接入前端
- 管线完整6步，对标参考工程11步流程的核心部分
- 5个SKILL.md提供Agent专业领域知识
- 所有代码已推送到GitHub（commit f8f1b88）

---
Task ID: 1
Agent: PostgreSQL Migration Agent
Task: Migrate from SQLite to PostgreSQL for Vercel deployment

Work Log:
- Changed prisma/schema.prisma: `provider = "sqlite"` → `provider = "postgresql"`, added `directUrl = env("DIRECT_URL")` for Vercel connection pooling
- Rewrote src/lib/db.ts (~340 lines → ~85 lines): removed all raw SQL migration code (`runSafeMigration`, `ensureDatabaseReady`, `addColumnIfNotExists`, `isPostgres`), kept URL resolution logic and PrismaClient singleton
- Rewrote src/app/api/migrate/route.ts: replaced ~418 lines of raw SQL with clean `prisma db push` via `execFile`, GET endpoint now queries `information_schema.tables` for PostgreSQL only
- Updated .env: changed `DATABASE_URL=file:/home/z/my-project/db/custom.db` to `postgresql://user:password@localhost:5432/huobao_drama`, added `DIRECT_URL`
- Updated .env.example: same PostgreSQL placeholder URLs, removed SQLite reference
- Removed `ensureDatabaseReady` imports and calls from 9 API route files:
  - src/app/api/settings/route.ts
  - src/app/api/storyboards/[id]/route.ts
  - src/app/api/dramas/[id]/route.ts
  - src/app/api/dramas/[id]/scenes/route.ts
  - src/app/api/dramas/[id]/episodes/route.ts
  - src/app/api/dramas/[id]/characters/route.ts
  - src/app/api/dramas/route.ts
  - src/app/api/episodes/[id]/storyboards/route.ts
  - src/app/api/episodes/[id]/route.ts
- Updated src/app/api/health/route.ts: removed SQLite detection logic
- Updated src/lib/api.ts: removed force migration logic, simplified retry to 2 attempts
- Deleted prisma/schema.development.prisma (SQLite backup)
- Deleted prisma/schema.production.prisma (obsolete, main schema is now PostgreSQL)
- Simplified scripts/build.js: removed SQLite↔PostgreSQL switching logic
- Simplified scripts/postinstall.js: removed SQLite backup/restore logic
- All lint checks pass clean
- Prisma schema validates successfully
- Prisma client generates successfully for PostgreSQL

Stage Summary:
- Project fully migrated from SQLite to PostgreSQL-only
- No raw SQL migration code remains — schema managed via `prisma db push`
- All API routes cleaned of `ensureDatabaseReady` calls
- Ready for Vercel deployment with PostgreSQL (e.g., Vercel Postgres / Neon / Supabase)

---
Task ID: 4
Agent: Agent Config & Pipeline Integration Agent
Task: Add Agent Configuration UI + grid_prompt_generator Pipeline Integration

Work Log:
- Added PATCH endpoint to /api/agent/[type]/route.ts for updating agent config (systemPrompt, model, temperature, maxTokens, isActive)
  - Uses upsert pattern: creates AgentConfig row if not exists, updates if exists
  - Returns updated config with defaults from DEFAULT_SYSTEM_PROMPTS
- Created /api/agents/route.ts (GET) for listing all agent configs
  - Returns all 5 agents with names, descriptions, prompts, tool lists, and SKILL.md content
  - Merges DB config with defaults when no DB row exists
- Updated src/lib/api.ts with agents.list() and agents.update() methods
  - agents.list() — GET /api/agents, returns full agent info array
  - agents.update(agentType, config) — PATCH /api/agent/[type]
- Added 5th tab "🤖 Agent配置" to settings-view.tsx
  - AgentConfigCard component for each of the 5 agents
  - Active/Inactive toggle switch
  - Model selector (text input, follows global LLM setting if empty)
  - Temperature slider (0-2, step 0.1)
  - Max tokens input
  - Expandable system prompt editor with "Reset to Default" button
  - Read-only tools list (name + description per tool)
  - Collapsible SKILL.md preview
- Integrated grid_prompt_generator into pipeline as step 6 (提示词增强)
  - Pipeline now: 原始内容→AI改写→提取→音色分配→分镜→提示词增强→制作 (7 steps)
  - Added handleGenerateEnhancedPrompts() using grid_prompt_generator agent via SSE streaming
  - Added renderPromptEnhancePanel() with stats cards, per-shot prompt details, and copy functionality
  - Updated isStepCompleted to handle 'prompt_enhance' step
  - Updated renderActivePanel switch to include 'prompt_enhance' case
  - Step numbering updated: 01-07 across all panels
- All lint checks pass clean

Stage Summary:
- Agent configuration now fully exposed in settings UI with 5th tab
- Users can see and configure all 5 agents: script_rewriter, extractor, storyboard_breaker, voice_assigner, grid_prompt_generator
- grid_prompt_generator integrated into pipeline between storyboard and production
- API endpoints: PATCH /api/agent/[type], GET /api/agents
- Client API: api.agents.list(), api.agents.update()

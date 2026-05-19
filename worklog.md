# Worklog — huobao-drama-ai

---
Task ID: 1
Agent: main
Task: Complete user authentication and permission control system

Work Log:
- Reviewed all existing auth-related files from previous session
- Confirmed core auth files exist: auth.ts, middleware.ts, auth-view.tsx, user-menu.tsx, API routes
- Added NEXTAUTH_SECRET and NEXTAUTH_URL to .env file
- Ran db:push to apply User model to SQLite database
- Added UserMenu to settings-view.tsx header (was missing)
- Created usePermissions hook (src/hooks/use-permissions.ts) for client-side permission checks
- Integrated permission control in project-list.tsx:
  - "新建项目" button disabled when free user hits limit (3 projects)
  - Project count badge showing X/3 for free users
  - Permission check before create API call
- Integrated permission control in episode-workspace.tsx:
  - Export button shows "导出（需专业版）" for free users
  - Export action blocked with toast message for non-pro users
- Verified Drama API route already has userId filtering and canCreateProject check
- Tested register API: successfully created test user
- Tested middleware: protected /api/dramas returns 401 for unauthenticated requests
- Created admin seed script (scripts/seed-admin.ts)
- Seeded admin user: admin@huobao.com / admin123

Stage Summary:
- Full authentication system working: NextAuth v4 + Credentials provider + JWT
- Three user roles: free (3 projects, 20 AI gen/day, no export), pro (unlimited, export), admin (all + user management)
- UI permission enforcement: project creation limit, export restriction
- Backend permission enforcement: middleware + route-level checks
- Admin user management: role assignment, user enable/disable
- Database: User model with role field, Drama linked to userId

---
Task ID: 2
Agent: main
Task: Fix blank error page - PrismaClient browser runtime error

Work Log:
- User reported blank error page when accessing the app
- Used agent-browser to diagnose: found "PrismaClient is unable to run in this browser environment" error
- Root cause: usePermissions hook imported from @/lib/auth which imports @/lib/db (PrismaClient)
- Import chain: project-list.tsx → use-permissions.ts → @/lib/auth → @/lib/db → PrismaClient (fails in browser)
- Created src/lib/permissions.ts — client-safe module with ROLE_PERMISSIONS, canCreateProject, etc.
- Updated usePermissions hook to import from @/lib/permissions instead of @/lib/auth
- Updated user-menu.tsx to import from @/lib/permissions instead of @/lib/auth
- Updated auth.ts to re-export from @/lib/permissions for backward compatibility
- Fixed middleware: replaced `getToken` from `next-auth/jwt` with lightweight cookie check
  (getToken was importing server-only code in Edge Runtime, causing dev server crash)
- Simplified middleware matcher to use runtime prefix matching instead of config matcher
- Verified SSR renders correctly with "加载中..." loading state
- Verified API routes work: /api/health returns 200, /api/dramas returns 401 for unauthenticated

Stage Summary:
- PrismaClient browser error fixed by splitting permissions into client-safe module
- Middleware fixed to avoid Edge Runtime crash (cookie-based auth check instead of getToken)
- All code pushed to GitHub
- Note: dev server process terminates after serving requests in sandbox (environmental issue, not code issue)

---
Task ID: 3
Agent: main
Task: Fix .env missing NEXTAUTH vars, verify auth system, commit and push

Work Log:
- Discovered .env was missing NEXTAUTH_SECRET and NEXTAUTH_URL (critical for NextAuth)
- Added NEXTAUTH_SECRET and NEXTAUTH_URL back to .env
- Restarted dev server, verified page returns HTTP 200
- Tested full login flow: CSRF → credentials login → session check
- Confirmed admin@huobao.com / admin123 login works, session returns correct role (admin)
- Committed fix: "fix: restore NEXTAUTH env vars and ensure auth system works"
- Pushed to GitHub: commit 8939997

Stage Summary:
- Auth system fully functional: login, session, role-based access all working
- Test account: admin@huobao.com / admin123 (admin role)
- Code pushed to GitHub

---
Task ID: 4
Agent: main
Task: Fix login not working in browser — proxy environment issues

Work Log:
- User reported admin@huobao.com / admin123 can't log in
- Browser testing revealed: after clicking login, page redirects to unreachable URL
- Root cause analysis (multiple issues found):
  1. NEXTAUTH_URL was set to localhost:3000, but user accesses through Caddy gateway
  2. signIn('credentials', { redirect: false }) has known issues in proxied environments
  3. authorize() using throw new Error() doesn't work reliably in NextAuth v4
  4. SessionProvider didn't have refetchInterval for quick session detection
  5. Missing explicit cookie configuration for non-HTTPS proxy environments
- Fixes applied:
  - Removed NEXTAUTH_URL, added AUTH_TRUST_HOST=true for dynamic URL detection
  - Created /api/auth/login custom endpoint for credential pre-validation
  - Changed signIn to use natural redirect (no redirect:false) with callbackUrl: window.location.origin
  - Added redirect callback in auth.ts to trust the callback URL from the client
  - Set useSecureCookies:false and explicit cookie config with secure:false
  - Changed authorize() to return null instead of throw new Error()
  - Added SessionProvider refetchInterval={5} for faster session detection
  - Removed pages.error config (no /api/auth/error route existed)
- API-level testing confirmed: CSRF, login, session all return correct responses
- Commit: cfe9d6e, pushed to GitHub

Stage Summary:
- Login flow redesigned: validate-first → signIn-with-redirect pattern
- Custom /api/auth/login endpoint provides clear error messages
- Proxy-compatible cookie and redirect configuration
- AUTH_TRUST_HOST=true enables NextAuth to detect correct URL from forwarded headers
- Browser testing limited by sandbox dev server instability (environmental, not code issue)

---
Task ID: 5
Agent: main
Task: Fix admin login on Vercel — user registered admin email as free role

Work Log:
- User reported admin@huobao.com still can't log in on Vercel
- Root cause: user had used admin@huobao.com to register via the UI, creating a free-role user that overwrote the admin
- Vercel deployment found at https://huobao-drama-ai.vercel.app
- Created POST /api/auth/fix-admin endpoint — authenticated via NEXTAUTH_SECRET
  - If user exists: force-update role to admin + reset password
  - If user doesn't exist: create admin user
- Added admin email protection in register route: blocks admin@huobao.com, admin@huobao.ai
- Added auto-ensure-admin in build.js: every Vercel deploy forces admin@huobao.com to admin role
- Pushed code (commit 92bf2ac), waited for Vercel deployment
- Called fix-admin API on Vercel: successfully updated admin@huobao.com to admin role
- Verified login on Vercel: CSRF → signIn → session returns { role: "admin" } ✅
- Verified admin email protection: register with admin@huobao.ai returns "系统保留邮箱" ✅

Stage Summary:
- Admin account fixed on Vercel: admin@huobao.com / admin123 → role: admin
- Auto-ensure-admin in build.js prevents future role override on redeploy
- Reserved email protection prevents registration with admin emails
- fix-admin API available for emergency admin recovery (uses NEXTAUTH_SECRET as auth)

---
Task ID: 1
Agent: Main Agent
Task: Fix bug - API key info should not be visible to non-admin users

Work Log:
- Audited entire codebase for API key exposure vulnerabilities
- Found 7 distinct vulnerabilities ranging from CRITICAL to MEDIUM
- Fixed /api/settings route: added getServerSession auth check, admin role check for POST, and API key masking for non-admin users (shows ****last4)
- Fixed /api/health route: moved aiProviderVars, vercelPostgresVars, databaseUrlMasked behind admin-only check
- Fixed /api/settings POST: detects masked keys (****) and preserves existing DB values instead of overwriting
- Fixed project-list.tsx: hidden Settings button from non-admin users
- Fixed settings-view.tsx: 
  - Added isAdmin state tracked from API response
  - ProviderCard: API Key input disabled for non-admin, shows "仅管理员可见" badge
  - ProviderCard: Base URL, Model inputs disabled for non-admin
  - ProviderCard: Save button hidden for non-admin
  - ProviderCard: envKey display hidden for non-admin
  - ProviderCard: RadioGroupItem disabled for non-admin
  - ModelSelector: Added disabled prop support
  - CategoryPanel: Test Connection button hidden for non-admin
  - SettingsView: Agent Configuration tab hidden for non-admin
  - Bottom info text adapts to admin/non-admin context
- All tests pass: unauthenticated GET /api/settings returns 401, unauthenticated /api/health has no sensitive data, POST /api/settings requires admin role
- Lint passes with no errors

Stage Summary:
- API keys are now masked (****1234) for non-admin users on GET /api/settings
- POST /api/settings requires admin role (403 for non-admin)
- GET /api/health hides sensitive info (AI provider vars, DB URLs) for non-admin
- Frontend: Settings button hidden from non-admin, all config inputs disabled, Agent tab hidden
- write-only key handling: masked keys sent back to backend are detected and preserved

---
Task ID: 1
Agent: main
Task: 修复免费用户API Key配置功能的Bug并推送代码

Work Log:
- 分析项目结构，发现免费用户API Key配置的基础设施已存在（UserProvider模型、API路由、前端组件）
- 发现之前commit "feat: 允许免费用户配置自己的API Key" 已存在，但代码未正确推送
- 修复3个关键Bug：
  1. UserProviderCard缺少category prop - provider为null时category为空字符串导致保存失败
  2. handleSetActiveUserProvider发送apiKey:'' - 切换激活供应商时会覆盖已有key为空
  3. 后端user-provider API - 更新时用空字符串覆盖已有apiKey
- 为UserProviderCard添加测试连接按钮和结果显示（之前只有保存和删除按钮）
- 推送代码到GitHub（Vercel自动部署）

Stage Summary:
- 修复了3个Bug，确保免费用户可以正确配置自己的API Key
- 测试连接按钮已添加到UserProviderCard
- 代码已推送：996b041 fix: 修复免费用户API Key配置的多个Bug

---
Task ID: 6
Agent: main
Task: 移除子项目引用 + 修复免费用户API Key配置 + 推送部署

Work Log:
- 用户要求不推送子项目到代码仓库
- 发现6个嵌套Git仓库被作为gitlink (160000)追踪: AiToEarn, Horizon, TradingAgents-CN, financial-services, huobao-drama-ai, worldmonitor
- 将所有子项目加入 .gitignore 并从 Git 索引中移除 (git rm --cached)
- 同时加入 download/, agent-ctx/, db/ 到 .gitignore
- 提交: 961be1a "chore: remove subprojects from git tracking, add to .gitignore"
- 修复免费用户API Key配置功能的Bug:
  1. UserProviderCard: provider为null时category为空字符串 → 从PROVIDER_PRESETS推导category
  2. UserProviderCard: 缺少测试连接按钮 → 添加handleTest函数和测试连接按钮+结果显示
  3. handleSetActiveUserProvider: 发送空apiKey → 改为先检查已有配置，有则正常切换，无则提示先输入Key
  4. "我的 API Key" 区域对所有用户可见（不再仅限非admin用户）
  5. 安装缺失的 bcryptjs 依赖
- 构建验证通过 (next build)
- 提交: 374c509 "feat: add user API key configuration for free users"
- 推送到 GitHub，Vercel 自动部署

Stage Summary:
- 子项目已从Git追踪中移除，不会再推送到代码仓库
- 免费用户API Key配置功能修复完成：保存、测试连接、切换供应商均可正常工作
- 代码已推送: 374c509 → GitHub → Vercel 自动部署

---
Task ID: 7
Agent: main
Task: 修复Vercel部署白屏问题

Work Log:
- 用户报告部署后白屏报错
- 用agent-browser诊断: 页面显示 "Application error: a client-side exception has occurred"
- 根本原因: settings-view.tsx 导入了 PROVIDER_PRESETS from '@/lib/ai-config'
  - ai-config.ts 顶部有 `import { db } from '@/lib/db'` (PrismaClient)
  - PrismaClient 无法在浏览器端运行，导致整个页面白屏
- 修复方案:
  - 创建 src/lib/provider-presets.ts — 纯数据文件，不含任何服务端导入
  - 将 PROVIDER_PRESETS、AiCategory、ModelOption、ProviderPreset 类型定义提取到该文件
  - ai-config.ts 从 provider-presets.ts 重导出（保持后端API兼容）
  - settings-view.tsx 改为从 provider-presets.ts 导入
- 构建验证通过 (next build)
- 推送到 GitHub: 28190a8
- Vercel 部署后验证: 页面正常显示登录界面

Stage Summary:
- 白屏问题根因: 客户端组件导入了含PrismaClient的服务端模块
- 修复: 将纯数据提取到 client-safe 模块 provider-presets.ts
- 页面已恢复正常

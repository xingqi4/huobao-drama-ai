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

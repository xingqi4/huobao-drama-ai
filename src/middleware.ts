import { NextResponse } from 'next/server'
import { getToken } from 'next-auth/jwt'

// ============================================================
// NextAuth Middleware — Route protection
// Note: Next.js 16 recommends "proxy" convention, but middleware
// still works. We use it for API route protection.
// ============================================================

export async function middleware(request: Request) {
  const { pathname } = new URL(request.url)

  // Allow auth routes, health, migrate, and static files
  if (
    pathname.startsWith('/api/auth/') ||
    pathname === '/api/health' ||
    pathname === '/api/migrate' ||
    pathname.startsWith('/_next/') ||
    pathname.startsWith('/favicon')
  ) {
    return NextResponse.next()
  }

  // For protected API routes, check for JWT token
  if (pathname.startsWith('/api/')) {
    const token = await getToken({ req: request as any })

    if (!token) {
      return NextResponse.json({ error: '未登录' }, { status: 401 })
    }

    return NextResponse.next()
  }

  // For page routes, let the client-side AuthGuard handle it
  return NextResponse.next()
}

export const config = {
  matcher: [
    // Protect all API routes EXCEPT auth and health
    '/api/dramas/:path*',
    '/api/episodes/:path*',
    '/api/characters/:path*',
    '/api/scenes/:path*',
    '/api/storyboards/:path*',
    '/api/ai/:path*',
    '/api/agent/:path*',
    '/api/agents/:path*',
    '/api/settings/:path*',
    '/api/upload/:path*',
    '/api/auth/profile',
    '/api/auth/users',
  ],
}

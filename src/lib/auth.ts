import type { NextAuthOptions } from 'next-auth'
import CredentialsProvider from 'next-auth/providers/credentials'
import bcrypt from 'bcryptjs'
import { db } from '@/lib/db'

// Re-export permissions from the client-safe module
export { ROLE_PERMISSIONS, canCreateProject, canUseAiGeneration, getPermissions } from './permissions'
export type { UserRole } from './permissions'

// ============================================================
// NextAuth v4 Configuration — Credentials + JWT strategy
// Works with both SQLite (local) and PostgreSQL (Vercel)
// ============================================================

export const authOptions: NextAuthOptions = {
  // For proxy/gateway environments: don't force secure cookies
  // since the gateway may terminate SSL
  useSecureCookies: false,

  providers: [
    CredentialsProvider({
      name: 'credentials',
      credentials: {
        email: { label: '邮箱', type: 'email', placeholder: 'your@email.com' },
        password: { label: '密码', type: 'password' },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          return null
        }

        const user = await db.user.findUnique({
          where: { email: credentials.email },
        })

        if (!user) {
          return null
        }

        if (!user.isActive) {
          return null
        }

        const isValid = await bcrypt.compare(credentials.password, user.password)
        if (!isValid) {
          return null
        }

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          avatar: user.avatar,
        }
      },
    }),
  ],

  session: {
    strategy: 'jwt',
    maxAge: 7 * 24 * 60 * 60, // 7 days
  },

  jwt: {
    maxAge: 7 * 24 * 60 * 60, // 7 days
  },

  cookies: {
    sessionToken: {
      name: 'next-auth.session-token',
      options: {
        httpOnly: true,
        sameSite: 'lax',
        path: '/',
        secure: false,
      },
    },
    callbackUrl: {
      name: 'next-auth.callback-url',
      options: {
        httpOnly: false,
        sameSite: 'lax',
        path: '/',
        secure: false,
      },
    },
    csrfToken: {
      name: 'next-auth.csrf-token',
      options: {
        httpOnly: true,
        sameSite: 'lax',
        path: '/',
        secure: false,
      },
    },
  },

  callbacks: {
    async redirect({ url, baseUrl }) {
      // In proxied environments, baseUrl may be wrong (e.g., http://localhost:3000)
      // Use the url param or the x-forwarded headers to construct the correct redirect
      if (url.startsWith('/')) return url
      // If url is already a valid external URL, use it
      try {
        const parsedUrl = new URL(url)
        // Keep the path but don't rewrite the origin — trust the url param
        return url
      } catch {
        return baseUrl
      }
    },

    async jwt({ token, user, trigger, session }) {
      // Initial sign in — add user info to token
      if (user) {
        token.id = user.id
        token.role = (user as any).role
        token.avatar = (user as any).avatar
      }

      // Update session (e.g., when user updates profile)
      if (trigger === 'update' && session) {
        token.name = session.name ?? token.name
        token.role = session.role ?? token.role
        token.avatar = session.avatar ?? token.avatar
      }

      return token
    },

    async session({ session, token }) {
      if (session.user) {
        (session.user as any).id = token.id
        ;(session.user as any).role = token.role
        ;(session.user as any).avatar = token.avatar
      }
      return session
    },
  },

  debug: process.env.NODE_ENV === 'development',
}

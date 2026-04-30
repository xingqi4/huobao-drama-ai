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
  providers: [
    CredentialsProvider({
      name: 'credentials',
      credentials: {
        email: { label: '邮箱', type: 'email', placeholder: 'your@email.com' },
        password: { label: '密码', type: 'password' },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          throw new Error('请输入邮箱和密码')
        }

        const user = await db.user.findUnique({
          where: { email: credentials.email },
        })

        if (!user) {
          throw new Error('邮箱未注册')
        }

        if (!user.isActive) {
          throw new Error('账号已被禁用，请联系管理员')
        }

        const isValid = await bcrypt.compare(credentials.password, user.password)
        if (!isValid) {
          throw new Error('密码错误')
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

  callbacks: {
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

  pages: {
    // We handle auth UI in our SPA, not separate pages
    // signIn: '/auth/signin',
    error: '/api/auth/error',
  },

  debug: process.env.NODE_ENV === 'development',
}

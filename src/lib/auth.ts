import type { NextAuthOptions } from 'next-auth'
import CredentialsProvider from 'next-auth/providers/credentials'
import bcrypt from 'bcryptjs'
import { db } from '@/lib/db'

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

// ============================================================
// Permission constants
// ============================================================

export type UserRole = 'free' | 'pro' | 'admin'

export const ROLE_PERMISSIONS: Record<UserRole, {
  label: string
  maxProjects: number       // -1 = unlimited
  maxAiGenerationsPerDay: number // -1 = unlimited
  canExport: boolean
  canManageUsers: boolean
  canAccessAllProjects: boolean
}> = {
  free: {
    label: '免费用户',
    maxProjects: 3,
    maxAiGenerationsPerDay: 20,
    canExport: false,
    canManageUsers: false,
    canAccessAllProjects: false,
  },
  pro: {
    label: '专业版',
    maxProjects: -1,
    maxAiGenerationsPerDay: -1,
    canExport: true,
    canManageUsers: false,
    canAccessAllProjects: false,
  },
  admin: {
    label: '管理员',
    maxProjects: -1,
    maxAiGenerationsPerDay: -1,
    canExport: true,
    canManageUsers: true,
    canAccessAllProjects: true,
  },
}

export function getPermissions(role: string) {
  return ROLE_PERMISSIONS[role as UserRole] ?? ROLE_PERMISSIONS.free
}

export function canCreateProject(role: string, currentProjectCount: number): boolean {
  const perms = getPermissions(role)
  if (perms.maxProjects === -1) return true
  return currentProjectCount < perms.maxProjects
}

export function canUseAiGeneration(role: string, todayCount: number): boolean {
  const perms = getPermissions(role)
  if (perms.maxAiGenerationsPerDay === -1) return true
  return todayCount < perms.maxAiGenerationsPerDay
}

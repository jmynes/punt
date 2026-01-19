import NextAuth from 'next-auth'
import Credentials from 'next-auth/providers/credentials'
import { PrismaAdapter } from '@auth/prisma-adapter'
import { z } from 'zod'

import { db } from '@/lib/db'
import { verifyPassword } from '@/lib/password'
import { authConfig } from '@/lib/auth.config'

const loginSchema = z.object({
  username: z.string().min(1),
  password: z.string().min(1),
})

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  adapter: PrismaAdapter(db),
  session: { strategy: 'jwt' },
  providers: [
    Credentials({
      name: 'credentials',
      credentials: {
        username: { label: 'Username', type: 'text' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        const parsed = loginSchema.safeParse(credentials)

        if (!parsed.success) {
          return null
        }

        const { username, password } = parsed.data

        const user = await db.user.findUnique({
          where: { username },
        })

        if (!user || !user.passwordHash) {
          return null
        }

        // Check if user is active
        if (!user.isActive) {
          return null
        }

        const isValidPassword = await verifyPassword(password, user.passwordHash)

        if (!isValidPassword) {
          return null
        }

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          image: user.avatar,
        }
      },
    }),
  ],
  callbacks: {
    ...authConfig.callbacks,
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id
      }

      // Fetch additional user data
      if (token.id) {
        const dbUser = await db.user.findUnique({
          where: { id: token.id as string },
          select: {
            id: true,
            username: true,
            email: true,
            name: true,
            avatar: true,
            isSystemAdmin: true,
            isActive: true,
          },
        })

        if (dbUser && dbUser.isActive) {
          token.username = dbUser.username
          token.isSystemAdmin = dbUser.isSystemAdmin
          token.avatar = dbUser.avatar
        }
      }

      return token
    },
    async session({ session, token }) {
      if (token && session.user) {
        session.user.id = token.id as string
        session.user.username = token.username as string
        session.user.isSystemAdmin = token.isSystemAdmin as boolean
        session.user.avatar = token.avatar as string | null
      }

      return session
    },
  },
})

// Type augmentation for Auth.js
declare module 'next-auth' {
  interface Session {
    user: {
      id: string
      username: string
      email: string | null
      name: string
      image?: string | null
      isSystemAdmin: boolean
      avatar: string | null
    }
  }

  interface User {
    username?: string
    isSystemAdmin?: boolean
    avatar?: string | null
  }
}

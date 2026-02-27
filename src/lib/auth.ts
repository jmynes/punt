import NextAuth from 'next-auth'
import Credentials from 'next-auth/providers/credentials'
import { z } from 'zod'
import { authConfig } from '@/lib/auth.config'
import { db } from '@/lib/db'
import { verifyPassword } from '@/lib/password'
import { checkRateLimit } from '@/lib/rate-limit'
import {
  decryptTotpSecret,
  markRecoveryCodeUsed,
  verifyRecoveryCode,
  verifyTotpToken,
} from '@/lib/totp'

const loginSchema = z.object({
  username: z.string().min(1),
  password: z.string().min(1),
  totpCode: z.string().optional(),
  isRecoveryCode: z.string().optional(), // "true" or undefined (credentials are always strings)
})

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  // Note: PrismaAdapter removed - not needed for credentials + JWT strategy
  // The adapter is only required for OAuth providers or database sessions
  session: { strategy: 'jwt' },
  providers: [
    Credentials({
      name: 'credentials',
      credentials: {
        username: { label: 'Username', type: 'text' },
        password: { label: 'Password', type: 'password' },
        totpCode: { label: 'TOTP Code', type: 'text' },
        isRecoveryCode: { label: 'Is Recovery Code', type: 'text' },
      },
      async authorize(credentials) {
        const parsed = loginSchema.safeParse(credentials)

        if (!parsed.success) {
          return null
        }

        const { username, password, totpCode, isRecoveryCode } = parsed.data

        // Normalize username to NFC form for consistent matching
        // Registration also normalizes to NFC, so this ensures login works
        // regardless of which Unicode form the client sends
        const normalizedUsername = username.normalize('NFC')

        const user = await db.user.findFirst({
          where: { username: { equals: normalizedUsername, mode: 'insensitive' } },
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

        // Check if 2FA is enabled
        if (user.totpEnabled && user.totpSecret) {
          // If no TOTP code provided, signal that 2FA is required
          if (!totpCode) {
            // Throw a specific error that the client can detect
            throw new Error('2FA_REQUIRED')
          }

          // Rate limit TOTP attempts by username to prevent brute-force
          const totpRateLimit = await checkRateLimit(normalizedUsername, 'auth/2fa')
          if (!totpRateLimit.allowed) {
            throw new Error('RATE_LIMITED')
          }

          const useRecoveryCode = isRecoveryCode === 'true'

          if (useRecoveryCode) {
            // Verify recovery code
            if (!user.totpRecoveryCodes) {
              return null
            }

            const normalizedCode = totpCode.toUpperCase().trim()
            const matchIndex = await verifyRecoveryCode(normalizedCode, user.totpRecoveryCodes)
            if (matchIndex === -1) {
              throw new Error('INVALID_2FA_CODE')
            }

            // Mark recovery code as used
            const updatedCodes = markRecoveryCodeUsed(user.totpRecoveryCodes, matchIndex)
            await db.user.update({
              where: { id: user.id },
              data: { totpRecoveryCodes: updatedCodes },
            })
          } else {
            // Verify TOTP code
            const secret = decryptTotpSecret(user.totpSecret)
            const isValid = verifyTotpToken(totpCode, secret)

            if (!isValid) {
              throw new Error('INVALID_2FA_CODE')
            }
          }
        }

        // Update last login timestamp
        await db.user.update({
          where: { id: user.id },
          data: { lastLoginAt: new Date() },
        })

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
            avatarColor: true,
            isSystemAdmin: true,
            isActive: true,
            passwordChangedAt: true,
          },
        })

        if (!dbUser) {
          // User no longer exists (e.g., after database wipe), invalidate session
          return { ...token, id: undefined, invalidated: true }
        }

        if (!dbUser.isActive) {
          // User is deactivated, invalidate session
          return { ...token, id: undefined, invalidated: true }
        }

        // Check if password was changed after token was issued
        if (dbUser.passwordChangedAt && token.iat) {
          const passwordChangedAtSeconds = Math.floor(dbUser.passwordChangedAt.getTime() / 1000)
          // If password was changed after token was issued, invalidate session
          if (passwordChangedAtSeconds > (token.iat as number)) {
            // Return empty token to force re-authentication
            return { ...token, id: undefined, invalidated: true }
          }
        }

        token.name = dbUser.name
        token.email = dbUser.email
        token.username = dbUser.username
        token.isSystemAdmin = dbUser.isSystemAdmin
        token.avatar = dbUser.avatar
        token.avatarColor = dbUser.avatarColor
      }

      return token
    },
    async session({ session, token }) {
      // If token was invalidated (password changed or user deactivated), clear session
      if (token.invalidated || !token.id) {
        // Return session with null user to trigger re-authentication
        session.user = null as unknown as typeof session.user
        return session
      }

      if (token && session.user) {
        session.user.id = token.id as string
        session.user.username = token.username as string
        session.user.isSystemAdmin = token.isSystemAdmin as boolean
        session.user.avatar = token.avatar as string | null
        session.user.avatarColor = token.avatarColor as string | null
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
      avatarColor: string | null
    }
  }

  interface User {
    username?: string
    isSystemAdmin?: boolean
    avatar?: string | null
    avatarColor?: string | null
  }
}

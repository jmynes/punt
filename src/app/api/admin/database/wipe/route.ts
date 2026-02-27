/**
 * API route for wiping the database
 *
 * POST /api/admin/database/wipe
 * Wipes all data and creates a fresh admin user
 * Requires system admin authentication
 */

import { hash } from 'bcryptjs'
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { requireSystemAdmin } from '@/lib/auth-helpers'
import { db } from '@/lib/db'
import { projectEvents } from '@/lib/events'
import { validatePasswordStrength, verifyPassword } from '@/lib/password'
import {
  decryptTotpSecret,
  markRecoveryCodeUsed,
  verifyRecoveryCode,
  verifyTotpToken,
} from '@/lib/totp'

const WipeRequestSchema = z.object({
  // Current admin's password for verification
  currentPassword: z.string().min(1, 'Your current password is required'),
  // New admin credentials
  username: z
    .string()
    .min(3, 'Username must be at least 3 characters')
    .max(30, 'Username must be at most 30 characters')
    .regex(
      /^[a-zA-Z0-9_-]+$/,
      'Username can only contain letters, numbers, underscores, and hyphens',
    ),
  password: z.string().min(1, 'Password is required'),
  confirmText: z.string(),
  totpCode: z.string().optional(),
  isRecoveryCode: z.boolean().optional(),
})

async function verifyReauth(
  userId: string,
  password: string,
  totpCode?: string,
  isRecoveryCode?: boolean,
): Promise<NextResponse | null> {
  const user = await db.user.findUnique({
    where: { id: userId },
    select: {
      passwordHash: true,
      totpEnabled: true,
      totpSecret: true,
      totpRecoveryCodes: true,
    },
  })

  if (!user?.passwordHash) {
    return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 })
  }

  const isValidPassword = await verifyPassword(password, user.passwordHash)
  if (!isValidPassword) {
    return NextResponse.json({ error: 'Invalid password' }, { status: 401 })
  }

  if (user.totpEnabled && user.totpSecret) {
    if (!totpCode) {
      return NextResponse.json({ error: '2FA code required', requires2fa: true }, { status: 401 })
    }

    if (isRecoveryCode) {
      if (!user.totpRecoveryCodes) {
        return NextResponse.json({ error: 'No recovery codes available' }, { status: 401 })
      }

      const codeIndex = await verifyRecoveryCode(totpCode, user.totpRecoveryCodes)
      if (codeIndex === -1) {
        return NextResponse.json({ error: 'Invalid recovery code' }, { status: 401 })
      }

      const updatedCodes = markRecoveryCodeUsed(user.totpRecoveryCodes, codeIndex)
      await db.user.update({
        where: { id: userId },
        data: { totpRecoveryCodes: updatedCodes },
      })
    } else {
      const secret = decryptTotpSecret(user.totpSecret)
      const isValidTotp = verifyTotpToken(totpCode, secret)
      if (!isValidTotp) {
        return NextResponse.json({ error: 'Invalid 2FA code' }, { status: 401 })
      }
    }
  }

  return null
}

export async function POST(request: Request) {
  try {
    // Require system admin
    const currentAdmin = await requireSystemAdmin()

    const body = await request.json()
    const result = WipeRequestSchema.safeParse(body)

    if (!result.success) {
      return Response.json({ error: result.error.issues[0].message }, { status: 400 })
    }

    const { currentPassword, username, password, confirmText, totpCode, isRecoveryCode } =
      result.data

    const authError = await verifyReauth(currentAdmin.id, currentPassword, totpCode, isRecoveryCode)
    if (authError) return authError

    // Verify confirmation text
    if (confirmText !== 'WIPE ALL DATA') {
      return Response.json({ error: 'Confirmation text does not match' }, { status: 400 })
    }

    // Validate password strength
    const passwordValidation = validatePasswordStrength(password)
    if (!passwordValidation.valid) {
      return Response.json({ error: `Password: ${passwordValidation.errors[0]}` }, { status: 400 })
    }

    // Hash the password
    const passwordHash = await hash(password, 12)

    // Wipe and recreate in a transaction
    await db.$transaction(
      async (tx) => {
        // Delete in reverse FK order
        await tx.ticketSprintHistory.deleteMany()
        await tx.attachment.deleteMany()
        await tx.ticketEdit.deleteMany()
        await tx.comment.deleteMany()
        await tx.ticketWatcher.deleteMany()
        await tx.ticketLink.deleteMany()
        await tx.ticket.deleteMany()
        await tx.projectSprintSettings.deleteMany()
        await tx.projectMember.deleteMany()
        await tx.sprint.deleteMany()
        await tx.label.deleteMany()
        await tx.column.deleteMany()
        await tx.role.deleteMany()
        await tx.invitation.deleteMany()
        await tx.project.deleteMany()
        await tx.rateLimit.deleteMany()
        await tx.passwordResetToken.deleteMany()
        await tx.emailVerificationToken.deleteMany()
        await tx.session.deleteMany()
        await tx.account.deleteMany()
        await tx.user.deleteMany()
        // Reset system settings to defaults
        await tx.systemSettings.deleteMany()

        // Create the new admin user
        await tx.user.create({
          data: {
            username: username.normalize('NFC'),
            usernameLower: username.normalize('NFC').toLowerCase(),
            name: username,
            passwordHash,
            isSystemAdmin: true,
            isActive: true,
          },
        })
      },
      {
        timeout: 60_000, // 1 minute timeout
      },
    )

    // Emit database event for real-time updates
    // This notifies other browser tabs/windows to refresh/logout
    projectEvents.emitDatabaseEvent({
      type: 'database.wiped',
      userId: currentAdmin.id,
      timestamp: Date.now(),
    })

    return Response.json({
      success: true,
      message: 'Database wiped successfully. Please log in with your new credentials.',
    })
  } catch (error) {
    console.error('Database wipe error:', error)
    return Response.json({ error: 'Failed to wipe database' }, { status: 500 })
  }
}

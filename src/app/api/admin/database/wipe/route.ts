/**
 * API route for wiping the database
 *
 * POST /api/admin/database/wipe
 * Wipes all data and creates a fresh admin user
 * Requires system admin authentication
 */

import { hash } from 'bcryptjs'
import { z } from 'zod'
import { requireSystemAdmin } from '@/lib/auth-helpers'
import { db } from '@/lib/db'
import { validatePasswordStrength } from '@/lib/password'

const WipeRequestSchema = z.object({
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
})

export async function POST(request: Request) {
  try {
    // Require system admin
    await requireSystemAdmin()

    const body = await request.json()
    const result = WipeRequestSchema.safeParse(body)

    if (!result.success) {
      return Response.json({ error: result.error.issues[0].message }, { status: 400 })
    }

    const { username, password, confirmText } = result.data

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

    return Response.json({
      success: true,
      message: 'Database wiped successfully. Please log in with your new credentials.',
    })
  } catch (error) {
    console.error('Database wipe error:', error)
    return Response.json({ error: 'Failed to wipe database' }, { status: 500 })
  }
}

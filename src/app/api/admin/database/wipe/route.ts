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
import { projectEvents } from '@/lib/events'
import { validatePasswordStrength, verifyPassword } from '@/lib/password'

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
})

export async function POST(request: Request) {
  try {
    // Require system admin
    const currentAdmin = await requireSystemAdmin()

    const body = await request.json()
    const result = WipeRequestSchema.safeParse(body)

    if (!result.success) {
      return Response.json({ error: result.error.issues[0].message }, { status: 400 })
    }

    const { currentPassword, username, password, confirmText } = result.data

    // Verify the current admin's password
    const adminUser = await db.user.findUnique({
      where: { id: currentAdmin.id },
      select: { passwordHash: true },
    })

    if (!adminUser?.passwordHash) {
      return Response.json({ error: 'Unable to verify your identity' }, { status: 400 })
    }

    const isValidPassword = await verifyPassword(currentPassword, adminUser.passwordHash)
    if (!isValidPassword) {
      return Response.json({ error: 'Incorrect password' }, { status: 401 })
    }

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

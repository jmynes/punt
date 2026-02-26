/**
 * API route for wiping all projects while keeping users
 *
 * POST /api/admin/database/wipe-projects
 * Wipes all projects, tickets, sprints, etc. but keeps user accounts
 * Requires system admin authentication
 */

import { NextResponse } from 'next/server'
import { z } from 'zod'
import { requireSystemAdmin } from '@/lib/auth-helpers'
import { db } from '@/lib/db'
import { projectEvents } from '@/lib/events'
import { verifyPassword } from '@/lib/password'
import {
  decryptTotpSecret,
  markRecoveryCodeUsed,
  verifyRecoveryCode,
  verifyTotpToken,
} from '@/lib/totp'

const WipeProjectsRequestSchema = z.object({
  // Current admin's password for verification
  confirmPassword: z.string().min(1, 'Your password is required'),
  confirmText: z.string(),
  totpCode: z.string().optional(),
  isRecoveryCode: z.boolean().optional(),
})

const REQUIRED_CONFIRMATION = 'DELETE ALL PROJECTS'

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

  // If 2FA is enabled, require TOTP code or recovery code
  if (user.totpEnabled && user.totpSecret) {
    if (!totpCode) {
      return NextResponse.json({ error: '2FA code required', requires2fa: true }, { status: 401 })
    }

    if (isRecoveryCode) {
      // Verify recovery code
      if (!user.totpRecoveryCodes) {
        return NextResponse.json({ error: 'No recovery codes available' }, { status: 401 })
      }

      const codeIndex = await verifyRecoveryCode(totpCode, user.totpRecoveryCodes)
      if (codeIndex === -1) {
        return NextResponse.json({ error: 'Invalid recovery code' }, { status: 401 })
      }

      // Mark recovery code as used
      const updatedCodes = markRecoveryCodeUsed(user.totpRecoveryCodes, codeIndex)
      await db.user.update({
        where: { id: userId },
        data: { totpRecoveryCodes: updatedCodes },
      })
    } else {
      // Verify TOTP code
      const secret = decryptTotpSecret(user.totpSecret)
      const isValidTotp = verifyTotpToken(totpCode, secret)
      if (!isValidTotp) {
        return NextResponse.json({ error: 'Invalid 2FA code' }, { status: 401 })
      }
    }
  }

  return null // Success
}

export async function POST(request: Request) {
  try {
    // Require system admin
    const currentAdmin = await requireSystemAdmin()

    const body = await request.json()
    const result = WipeProjectsRequestSchema.safeParse(body)

    if (!result.success) {
      return Response.json({ error: result.error.issues[0].message }, { status: 400 })
    }

    const { confirmPassword, confirmText, totpCode, isRecoveryCode } = result.data

    // Verify the current admin's password and 2FA
    const authError = await verifyReauth(currentAdmin.id, confirmPassword, totpCode, isRecoveryCode)
    if (authError) return authError

    // Verify confirmation text
    if (confirmText !== REQUIRED_CONFIRMATION) {
      return Response.json({ error: 'Confirmation text does not match' }, { status: 400 })
    }

    // Wipe all project data in a transaction
    const counts = await db.$transaction(
      async (tx) => {
        // Delete in reverse FK order - project-related data only
        const ticketSprintHistory = await tx.ticketSprintHistory.deleteMany()
        const attachments = await tx.attachment.deleteMany()
        const ticketEdits = await tx.ticketEdit.deleteMany()
        const comments = await tx.comment.deleteMany()
        const ticketWatchers = await tx.ticketWatcher.deleteMany()
        const ticketLinks = await tx.ticketLink.deleteMany()
        const tickets = await tx.ticket.deleteMany()
        const projectSprintSettings = await tx.projectSprintSettings.deleteMany()
        const projectMembers = await tx.projectMember.deleteMany()
        const sprints = await tx.sprint.deleteMany()
        const labels = await tx.label.deleteMany()
        const columns = await tx.column.deleteMany()
        const roles = await tx.role.deleteMany()
        const invitations = await tx.invitation.deleteMany()
        const projects = await tx.project.deleteMany()

        return {
          projects: projects.count,
          tickets: tickets.count,
          sprints: sprints.count,
          labels: labels.count,
          comments: comments.count,
          attachments: attachments.count,
          ticketEdits: ticketEdits.count,
          ticketWatchers: ticketWatchers.count,
          ticketLinks: ticketLinks.count,
          ticketSprintHistory: ticketSprintHistory.count,
          projectMembers: projectMembers.count,
          projectSprintSettings: projectSprintSettings.count,
          columns: columns.count,
          roles: roles.count,
          invitations: invitations.count,
        }
      },
      {
        timeout: 60_000, // 1 minute timeout
      },
    )

    // Emit database event for real-time updates
    projectEvents.emitDatabaseEvent({
      type: 'database.projects.wiped',
      userId: currentAdmin.id,
      timestamp: Date.now(),
    })

    return Response.json({
      success: true,
      message: 'All projects wiped successfully. User accounts have been preserved.',
      counts,
    })
  } catch (error) {
    console.error('Project wipe error:', error)
    return Response.json({ error: 'Failed to wipe projects' }, { status: 500 })
  }
}

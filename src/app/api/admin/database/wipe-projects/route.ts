/**
 * API route for wiping all projects while keeping users
 *
 * POST /api/admin/database/wipe-projects
 * Wipes all projects, tickets, sprints, etc. but keeps user accounts
 * Requires system admin authentication
 */

import { z } from 'zod'
import { requireSystemAdmin } from '@/lib/auth-helpers'
import { db } from '@/lib/db'
import { projectEvents } from '@/lib/events'
import { verifyPassword } from '@/lib/password'

const WipeProjectsRequestSchema = z.object({
  // Current admin's password for verification
  confirmPassword: z.string().min(1, 'Your password is required'),
  confirmText: z.string(),
})

const REQUIRED_CONFIRMATION = 'DELETE ALL PROJECTS'

export async function POST(request: Request) {
  try {
    // Require system admin
    const currentAdmin = await requireSystemAdmin()

    const body = await request.json()
    const result = WipeProjectsRequestSchema.safeParse(body)

    if (!result.success) {
      return Response.json({ error: result.error.issues[0].message }, { status: 400 })
    }

    const { confirmPassword, confirmText } = result.data

    // Verify the current admin's password
    const adminUser = await db.user.findUnique({
      where: { id: currentAdmin.id },
      select: { passwordHash: true },
    })

    if (!adminUser?.passwordHash) {
      return Response.json({ error: 'Unable to verify your identity' }, { status: 400 })
    }

    const isValidPassword = await verifyPassword(confirmPassword, adminUser.passwordHash)
    if (!isValidPassword) {
      return Response.json({ error: 'Incorrect password' }, { status: 401 })
    }

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

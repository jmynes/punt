import { NextResponse } from 'next/server'
import { requireSystemAdmin } from '@/lib/auth-helpers'
import { db } from '@/lib/db'

export interface DatabaseStats {
  users: number
  projects: number
  tickets: number
  sprints: number
  labels: number
  columns: number
  comments: number
  attachments: number
  roles: number
}

/**
 * GET /api/admin/database/stats
 * Get current database record counts
 */
export async function GET() {
  const authResult = await requireSystemAdmin()
  if (authResult instanceof NextResponse) return authResult

  const [users, projects, tickets, sprints, labels, columns, comments, attachments, roles] =
    await Promise.all([
      db.user.count(),
      db.project.count(),
      db.ticket.count(),
      db.sprint.count(),
      db.label.count(),
      db.column.count(),
      db.comment.count(),
      db.attachment.count(),
      db.role.count(),
    ])

  const stats: DatabaseStats = {
    users,
    projects,
    tickets,
    sprints,
    labels,
    columns,
    comments,
    attachments,
    roles,
  }

  return NextResponse.json(stats)
}

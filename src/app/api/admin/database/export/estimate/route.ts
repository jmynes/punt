import { NextResponse } from 'next/server'
import { handleApiError } from '@/lib/api-utils'
import { requireSystemAdmin } from '@/lib/auth-helpers'
import { db } from '@/lib/db'

export interface ExportSizeEstimate {
  /** Per-project breakdown */
  projects: Array<{
    id: string
    name: string
    key: string
    color: string
    ticketCount: number
    commentCount: number
    activityCount: number
    attachmentCount: number
    attachmentSizeBytes: number
    estimatedBytes: number
  }>
  /** Global (non-project) data */
  global: {
    userCount: number
    avatarSizeBytes: number
    systemSettingsBytes: number
    estimatedBytes: number
  }
  /** Totals by category */
  totals: {
    baseDataBytes: number
    attachmentBytes: number
    avatarBytes: number
    commentBytes: number
    activityBytes: number
    totalBytes: number
  }
}

interface ProjectIdCount {
  projectId: string
  count: bigint
}

interface ProjectIdAttachmentAgg {
  projectId: string
  count: bigint
  totalSize: bigint
}

// Average sizes for estimation (bytes)
const AVG_COMMENT_SIZE = 300
const AVG_ACTIVITY_SIZE = 150
const AVG_TICKET_SIZE = 500
const AVG_USER_SIZE = 400
const AVG_SYSTEM_SETTINGS_SIZE = 2000
const AVG_AVATAR_SIZE = 50_000

/**
 * GET /api/admin/database/export/estimate
 *
 * Returns size estimates for the export, broken down by category and project.
 * Used to show live size estimation in the export dialog.
 *
 * Requires system admin.
 */
export async function GET() {
  try {
    const authResult = await requireSystemAdmin()
    if (authResult instanceof NextResponse) return authResult

    // Fetch all data in parallel for efficiency
    const [
      projects,
      userCount,
      systemSettings,
      avatarUserCount,
      projectTicketCounts,
      projectCommentCounts,
      projectActivityCounts,
      projectAttachmentAggs,
    ] = await Promise.all([
      db.project.findMany({
        select: { id: true, name: true, key: true, color: true },
        orderBy: { createdAt: 'asc' },
      }),
      db.user.count(),
      db.systemSettings.findUnique({ where: { id: 'system-settings' } }),
      db.user.count({ where: { avatar: { not: null } } }),
      db.ticket.groupBy({
        by: ['projectId'],
        _count: { id: true },
      }),
      db.$queryRaw<ProjectIdCount[]>`
        SELECT t."projectId", COUNT(c.id)::bigint as count
        FROM "Comment" c
        JOIN "Ticket" t ON c."ticketId" = t.id
        GROUP BY t."projectId"
      `,
      db.$queryRaw<ProjectIdCount[]>`
        SELECT t."projectId", COUNT(ta.id)::bigint as count
        FROM "TicketActivity" ta
        JOIN "Ticket" t ON ta."ticketId" = t.id
        GROUP BY t."projectId"
      `,
      db.$queryRaw<ProjectIdAttachmentAgg[]>`
        SELECT t."projectId", COUNT(a.id)::bigint as count, COALESCE(SUM(a.size), 0)::bigint as "totalSize"
        FROM "Attachment" a
        JOIN "Ticket" t ON a."ticketId" = t.id
        GROUP BY t."projectId"
      `,
    ])

    // Build lookup maps
    const ticketCountMap = new Map<string, number>(
      projectTicketCounts.map((r) => [r.projectId, r._count.id]),
    )
    const commentCountMap = new Map<string, number>(
      projectCommentCounts.map((r) => [r.projectId, Number(r.count)]),
    )
    const activityCountMap = new Map<string, number>(
      projectActivityCounts.map((r) => [r.projectId, Number(r.count)]),
    )
    const attachmentMap = new Map<string, { count: number; totalSize: number }>(
      projectAttachmentAggs.map((r) => [
        r.projectId,
        { count: Number(r.count), totalSize: Number(r.totalSize) },
      ]),
    )

    const avatarSizeBytes = avatarUserCount * AVG_AVATAR_SIZE
    const systemSettingsBytes = systemSettings ? AVG_SYSTEM_SETTINGS_SIZE : 0

    // Build per-project breakdowns
    const projectEstimates = projects.map((project) => {
      const ticketCount = ticketCountMap.get(project.id) ?? 0
      const commentCount = commentCountMap.get(project.id) ?? 0
      const activityCount = activityCountMap.get(project.id) ?? 0
      const attachmentInfo = attachmentMap.get(project.id) ?? { count: 0, totalSize: 0 }

      const estimatedBytes =
        ticketCount * AVG_TICKET_SIZE +
        commentCount * AVG_COMMENT_SIZE +
        activityCount * AVG_ACTIVITY_SIZE

      return {
        id: project.id,
        name: project.name,
        key: project.key,
        color: project.color,
        ticketCount,
        commentCount,
        activityCount,
        attachmentCount: attachmentInfo.count,
        attachmentSizeBytes: attachmentInfo.totalSize,
        estimatedBytes,
      }
    })

    // Calculate totals
    const totalBaseData =
      systemSettingsBytes +
      userCount * AVG_USER_SIZE +
      projectEstimates.reduce((sum: number, p) => sum + p.ticketCount * AVG_TICKET_SIZE, 0)

    const totalAttachmentBytes = projectEstimates.reduce(
      (sum: number, p) => sum + p.attachmentSizeBytes,
      0,
    )
    const totalCommentBytes = projectEstimates.reduce(
      (sum: number, p) => sum + p.commentCount * AVG_COMMENT_SIZE,
      0,
    )
    const totalActivityBytes = projectEstimates.reduce(
      (sum: number, p) => sum + p.activityCount * AVG_ACTIVITY_SIZE,
      0,
    )

    const estimate: ExportSizeEstimate = {
      projects: projectEstimates,
      global: {
        userCount,
        avatarSizeBytes,
        systemSettingsBytes,
        estimatedBytes: systemSettingsBytes + userCount * AVG_USER_SIZE,
      },
      totals: {
        baseDataBytes: totalBaseData,
        attachmentBytes: totalAttachmentBytes,
        avatarBytes: avatarSizeBytes,
        commentBytes: totalCommentBytes,
        activityBytes: totalActivityBytes,
        totalBytes:
          totalBaseData +
          totalAttachmentBytes +
          avatarSizeBytes +
          totalCommentBytes +
          totalActivityBytes,
      },
    }

    return NextResponse.json(estimate)
  } catch (error) {
    return handleApiError(error, 'estimate export size')
  }
}

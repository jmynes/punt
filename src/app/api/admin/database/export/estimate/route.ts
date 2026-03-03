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
    /** Bytes for always-included data: tickets, roles, columns, labels, sprints, members, etc. */
    baseEstimatedBytes: number
    /** Bytes for comment data (togglable) */
    commentEstimatedBytes: number
    /** Bytes for activity data (togglable) */
    activityEstimatedBytes: number
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

// Average sizes for estimation (bytes, based on pretty-printed JSON measurements)
const AVG_TICKET_SIZE = 1800
const AVG_COMMENT_SIZE = 700
const AVG_ACTIVITY_SIZE = 400
const AVG_USER_SIZE = 1200
const AVG_SYSTEM_SETTINGS_SIZE = 3000
const AVG_AVATAR_SIZE = 50_000

// Per-project metadata model averages
const AVG_ROLE_SIZE = 700
const AVG_COLUMN_SIZE = 200
const AVG_LABEL_SIZE = 150
const AVG_SPRINT_SIZE = 600
const AVG_MEMBER_SIZE = 300
const AVG_PROJECT_SIZE = 600
const AVG_SPRINT_HISTORY_SIZE = 300
const AVG_TICKET_LINK_SIZE = 200
const AVG_TICKET_EDIT_SIZE = 500

// JSON array nesting adds indentation overhead (~10%)
const JSON_NESTING_OVERHEAD = 1.1

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
      projectRoleCounts,
      projectColumnCounts,
      projectLabelCounts,
      projectSprintCounts,
      projectMemberCounts,
      projectSprintHistoryCounts,
      projectTicketEditCounts,
      projectTicketLinkCounts,
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
        SELECT t.project_id AS "projectId", COUNT(c.id)::bigint as count
        FROM comments c
        JOIN tickets t ON c.ticket_id = t.id
        GROUP BY t.project_id
      `,
      db.$queryRaw<ProjectIdCount[]>`
        SELECT t.project_id AS "projectId", COUNT(ta.id)::bigint as count
        FROM ticket_activities ta
        JOIN tickets t ON ta.ticket_id = t.id
        GROUP BY t.project_id
      `,
      db.$queryRaw<ProjectIdAttachmentAgg[]>`
        SELECT t.project_id AS "projectId", COUNT(a.id)::bigint as count, COALESCE(SUM(a.size), 0)::bigint as "totalSize"
        FROM attachments a
        JOIN tickets t ON a.ticket_id = t.id
        GROUP BY t.project_id
      `,
      db.role.groupBy({
        by: ['projectId'],
        _count: { id: true },
      }),
      db.column.groupBy({
        by: ['projectId'],
        _count: { id: true },
      }),
      db.label.groupBy({
        by: ['projectId'],
        _count: { id: true },
      }),
      db.sprint.groupBy({
        by: ['projectId'],
        _count: { id: true },
      }),
      db.projectMember.groupBy({
        by: ['projectId'],
        _count: { id: true },
      }),
      db.$queryRaw<ProjectIdCount[]>`
        SELECT t.project_id AS "projectId", COUNT(tsh.id)::bigint as count
        FROM ticket_sprint_history tsh
        JOIN tickets t ON tsh.ticket_id = t.id
        GROUP BY t.project_id
      `,
      db.$queryRaw<ProjectIdCount[]>`
        SELECT t.project_id AS "projectId", COUNT(te.id)::bigint as count
        FROM ticket_edits te
        JOIN tickets t ON te.ticket_id = t.id
        GROUP BY t.project_id
      `,
      db.$queryRaw<ProjectIdCount[]>`
        SELECT project_id AS "projectId", COUNT(id)::bigint as count
        FROM (
          SELECT DISTINCT tl.id, t.project_id
          FROM ticket_links tl
          JOIN tickets t ON tl.from_ticket_id = t.id
        ) sub
        GROUP BY project_id
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
    const roleCountMap = new Map<string, number>(
      projectRoleCounts.map((r) => [r.projectId, r._count.id]),
    )
    const columnCountMap = new Map<string, number>(
      projectColumnCounts.map((r) => [r.projectId, r._count.id]),
    )
    const labelCountMap = new Map<string, number>(
      projectLabelCounts.map((r) => [r.projectId, r._count.id]),
    )
    const sprintCountMap = new Map<string, number>(
      projectSprintCounts.map((r) => [r.projectId, r._count.id]),
    )
    const memberCountMap = new Map<string, number>(
      projectMemberCounts.map((r) => [r.projectId, r._count.id]),
    )
    const sprintHistoryCountMap = new Map<string, number>(
      projectSprintHistoryCounts.map((r) => [r.projectId, Number(r.count)]),
    )
    const ticketEditCountMap = new Map<string, number>(
      projectTicketEditCounts.map((r) => [r.projectId, Number(r.count)]),
    )
    const ticketLinkCountMap = new Map<string, number>(
      projectTicketLinkCounts.map((r) => [r.projectId, Number(r.count)]),
    )

    const avatarSizeBytes = avatarUserCount * AVG_AVATAR_SIZE
    const systemSettingsBytes = systemSettings ? AVG_SYSTEM_SETTINGS_SIZE : 0

    // Build per-project breakdowns
    const projectEstimates = projects.map((project) => {
      const ticketCount = ticketCountMap.get(project.id) ?? 0
      const commentCount = commentCountMap.get(project.id) ?? 0
      const activityCount = activityCountMap.get(project.id) ?? 0
      const attachmentInfo = attachmentMap.get(project.id) ?? { count: 0, totalSize: 0 }
      const roleCount = roleCountMap.get(project.id) ?? 0
      const columnCount = columnCountMap.get(project.id) ?? 0
      const labelCount = labelCountMap.get(project.id) ?? 0
      const sprintCount = sprintCountMap.get(project.id) ?? 0
      const memberCount = memberCountMap.get(project.id) ?? 0
      const sprintHistoryCount = sprintHistoryCountMap.get(project.id) ?? 0
      const ticketEditCount = ticketEditCountMap.get(project.id) ?? 0
      const ticketLinkCount = ticketLinkCountMap.get(project.id) ?? 0

      // Base: always-included data for this project
      const baseEstimatedBytes = Math.round(
        (AVG_PROJECT_SIZE +
          ticketCount * AVG_TICKET_SIZE +
          roleCount * AVG_ROLE_SIZE +
          columnCount * AVG_COLUMN_SIZE +
          labelCount * AVG_LABEL_SIZE +
          sprintCount * AVG_SPRINT_SIZE +
          memberCount * AVG_MEMBER_SIZE +
          sprintHistoryCount * AVG_SPRINT_HISTORY_SIZE +
          ticketEditCount * AVG_TICKET_EDIT_SIZE +
          ticketLinkCount * AVG_TICKET_LINK_SIZE) *
          JSON_NESTING_OVERHEAD,
      )

      const commentEstimatedBytes = Math.round(
        commentCount * AVG_COMMENT_SIZE * JSON_NESTING_OVERHEAD,
      )
      const activityEstimatedBytes = Math.round(
        activityCount * AVG_ACTIVITY_SIZE * JSON_NESTING_OVERHEAD,
      )

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
        baseEstimatedBytes,
        commentEstimatedBytes,
        activityEstimatedBytes,
      }
    })

    // Calculate totals
    const globalEstimatedBytes = Math.round(
      (systemSettingsBytes + userCount * AVG_USER_SIZE) * JSON_NESTING_OVERHEAD,
    )

    const totalBaseData =
      globalEstimatedBytes +
      projectEstimates.reduce((sum: number, p) => sum + p.baseEstimatedBytes, 0)

    const totalAttachmentBytes = projectEstimates.reduce(
      (sum: number, p) => sum + p.attachmentSizeBytes,
      0,
    )
    const totalCommentBytes = projectEstimates.reduce(
      (sum: number, p) => sum + p.commentEstimatedBytes,
      0,
    )
    const totalActivityBytes = projectEstimates.reduce(
      (sum: number, p) => sum + p.activityEstimatedBytes,
      0,
    )

    const estimate: ExportSizeEstimate = {
      projects: projectEstimates,
      global: {
        userCount,
        avatarSizeBytes,
        systemSettingsBytes,
        estimatedBytes: globalEstimatedBytes,
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

import { NextResponse } from 'next/server'
import { handleApiError, notFoundError } from '@/lib/api-utils'
import { requireAuth, requireMembership, requireProjectByKey } from '@/lib/auth-helpers'
import { db } from '@/lib/db'

type RouteParams = { params: Promise<{ projectId: string; sprintId: string }> }

interface TicketEntry {
  ticketId: string
  storyPoints: number
  resolvedAt: Date | null
  addedAt: Date
  removedAt: Date | null
}

/**
 * GET /api/projects/[projectId]/sprints/[sprintId]/burndown - Get burndown chart data
 * Requires project membership (read-only)
 *
 * Query params:
 * - unit: "points" (default) or "tickets" — sum story points vs count tickets
 *
 * Merges two data sources:
 * 1. TicketSprintHistory - has addedAt/removedAt for scope tracking over time
 * 2. Ticket.sprintId - catches tickets assigned to sprint without history entries
 */
export async function GET(request: Request, { params }: RouteParams) {
  try {
    const user = await requireAuth()
    const { projectId: projectKey, sprintId } = await params
    const projectId = await requireProjectByKey(projectKey)

    await requireMembership(user.id, projectId)

    const url = new URL(request.url)
    const unit = url.searchParams.get('unit') === 'tickets' ? 'tickets' : 'points'

    // Fetch sprint
    const sprint = await db.sprint.findFirst({
      where: { id: sprintId, projectId },
      select: {
        id: true,
        name: true,
        startDate: true,
        endDate: true,
        status: true,
      },
    })

    if (!sprint) {
      return notFoundError('Sprint')
    }

    if (!sprint.startDate) {
      return NextResponse.json({
        sprint: {
          id: sprint.id,
          name: sprint.name,
          startDate: null,
          endDate: sprint.endDate?.toISOString() ?? null,
          status: sprint.status,
        },
        unit,
        dataPoints: [],
      })
    }

    // Fetch sprint history entries (tickets with add/remove tracking)
    const histories = await db.ticketSprintHistory.findMany({
      where: { sprintId },
      select: {
        ticketId: true,
        addedAt: true,
        removedAt: true,
        ticket: {
          select: {
            id: true,
            storyPoints: true,
            resolvedAt: true,
          },
        },
      },
    })

    // Fetch all tickets currently assigned to this sprint
    // (covers tickets that were added without history entries)
    const sprintTickets = await db.ticket.findMany({
      where: { sprintId, projectId },
      select: {
        id: true,
        storyPoints: true,
        resolvedAt: true,
        createdAt: true,
      },
    })

    // Build unified ticket entries, preferring history data when available
    const ticketEntries = new Map<string, TicketEntry>()

    for (const h of histories) {
      ticketEntries.set(h.ticketId, {
        ticketId: h.ticketId,
        storyPoints: h.ticket.storyPoints ?? 0,
        resolvedAt: h.ticket.resolvedAt,
        addedAt: h.addedAt,
        removedAt: h.removedAt,
      })
    }

    // Tickets in sprint but missing from history — use max(sprintStart, createdAt)
    for (const t of sprintTickets) {
      if (!ticketEntries.has(t.id)) {
        const effectiveAddedAt = t.createdAt > sprint.startDate ? t.createdAt : sprint.startDate
        ticketEntries.set(t.id, {
          ticketId: t.id,
          storyPoints: t.storyPoints ?? 0,
          resolvedAt: t.resolvedAt,
          addedAt: effectiveAddedAt,
          removedAt: null,
        })
      }
    }

    const entries = Array.from(ticketEntries.values())

    // Determine date range
    const startDate = new Date(sprint.startDate)
    startDate.setHours(0, 0, 0, 0)

    const now = new Date()
    now.setHours(23, 59, 59, 999)

    let endDate: Date
    if (sprint.endDate) {
      endDate = new Date(sprint.endDate)
      endDate.setHours(23, 59, 59, 999)
      if (sprint.status !== 'completed' && endDate > now) {
        endDate = now
      }
    } else {
      endDate = now
    }

    const plannedEnd = sprint.endDate ? new Date(sprint.endDate) : endDate
    plannedEnd.setHours(23, 59, 59, 999)

    const totalDays = Math.max(
      1,
      Math.round((plannedEnd.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)),
    )

    // Helper: get the "weight" of a ticket entry based on unit mode
    const weight = (entry: TicketEntry) => (unit === 'tickets' ? 1 : entry.storyPoints)

    // First pass: compute scope/completed per day
    const rawPoints: Array<{ date: string; day: number; scope: number; completed: number }> = []
    const current = new Date(startDate)
    let dayNum = 1

    while (current <= endDate) {
      const dayEnd = new Date(current)
      dayEnd.setHours(23, 59, 59, 999)

      let scope = 0
      let completed = 0

      for (const entry of entries) {
        const addedAt = new Date(entry.addedAt)
        addedAt.setHours(0, 0, 0, 0)

        const wasAdded = addedAt <= dayEnd
        const wasRemoved = entry.removedAt && new Date(entry.removedAt) <= dayEnd
        const inSprint = wasAdded && !wasRemoved

        if (inSprint) {
          scope += weight(entry)
          if (entry.resolvedAt && new Date(entry.resolvedAt) <= dayEnd) {
            completed += weight(entry)
          }
        }
      }

      rawPoints.push({ date: current.toISOString().split('T')[0], day: dayNum, scope, completed })
      current.setDate(current.getDate() + 1)
      dayNum++
    }

    // Guideline: straight line from commitment to 0 at sprint end.
    // Jira anchors this to the original sprint commitment (day 1 scope) — it stays
    // fixed even when scope changes mid-sprint, so being above/below the line is
    // meaningful. When the sprint starts with 0 scope (tickets added progressively),
    // fall back to max scope so the guideline is still useful.
    const day1Scope = rawPoints.length > 0 ? rawPoints[0].scope : 0
    const maxScope = rawPoints.reduce((max, p) => Math.max(max, p.scope), 0)
    const commitment = day1Scope > 0 ? day1Scope : maxScope

    const dataPoints = rawPoints.map((point) => {
      const dayIndex = point.day - 1
      const ideal = Math.max(0, commitment - (commitment * dayIndex) / totalDays)

      return {
        date: point.date,
        day: point.day,
        ideal: Math.round(ideal * 10) / 10,
        remaining: point.scope - point.completed,
        scope: point.scope,
        completed: point.completed,
      }
    })

    return NextResponse.json({
      sprint: {
        id: sprint.id,
        name: sprint.name,
        startDate: sprint.startDate.toISOString(),
        endDate: sprint.endDate?.toISOString() ?? null,
        status: sprint.status,
      },
      unit,
      dataPoints,
    })
  } catch (error) {
    return handleApiError(error, 'get burndown data')
  }
}

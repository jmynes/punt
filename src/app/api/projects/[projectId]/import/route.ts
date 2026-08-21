import { NextResponse } from 'next/server'
import { z } from 'zod'
import { badRequestError, handleApiError, validationError } from '@/lib/api-utils'
import { requireAuth, requirePermission, requireProjectByKey } from '@/lib/auth-helpers'
import { db } from '@/lib/db'
import { projectEvents } from '@/lib/events'
import { PERMISSIONS } from '@/lib/permissions'

const parsedTicketSchema = z.object({
  externalKey: z.string(),
  title: z.string().min(1),
  description: z.string().nullable(),
  type: z.enum(['epic', 'story', 'task', 'bug', 'subtask']),
  priority: z.enum(['lowest', 'low', 'medium', 'high', 'highest', 'critical']),
  storyPoints: z.number().nullable(),
  labels: z.array(z.string()),
  originalStatus: z.string().nullable(),
  originalPriority: z.string().nullable(),
  originalType: z.string().nullable(),
  isResolved: z.boolean(),
  resolution: z.string().nullable(),
})

const importSchema = z.object({
  tickets: z.array(parsedTicketSchema).min(1, 'At least one ticket is required'),
  columnId: z.string().min(1),
  sprintId: z.string().nullable().optional(),
  createMissingLabels: z.boolean().default(true),
})

/**
 * POST /api/projects/[projectId]/import - Import tickets from external sources
 * Requires ticket creation permission
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ projectId: string }> },
) {
  try {
    const user = await requireAuth()
    const { projectId: projectKey } = await params
    const projectId = await requireProjectByKey(projectKey)

    // Check ticket creation permission
    await requirePermission(user.id, projectId, PERMISSIONS.TICKETS_CREATE)

    const body = await request.json()
    const parsed = importSchema.safeParse(body)

    if (!parsed.success) {
      return validationError(parsed)
    }

    const { tickets, columnId, sprintId, createMissingLabels } = parsed.data

    // Verify column belongs to project
    const column = await db.column.findFirst({
      where: { id: columnId, projectId },
    })

    if (!column) {
      return badRequestError('Column not found or does not belong to project')
    }

    // Verify sprint belongs to project (if provided)
    if (sprintId) {
      const sprint = await db.sprint.findFirst({
        where: { id: sprintId, projectId },
      })
      if (!sprint) {
        return badRequestError('Sprint not found or does not belong to project')
      }
    }

    // Import tickets in a transaction
    const result = await db.$transaction(async (tx) => {
      const warnings: string[] = []
      let labelsCreated = 0

      // Get existing labels for this project
      const existingLabels = await tx.label.findMany({
        where: { projectId },
        select: { id: true, name: true },
      })
      const labelMap = new Map(existingLabels.map((l) => [l.name.toLowerCase(), l.id]))

      // Collect all unique label names from tickets
      const allLabelNames = new Set<string>()
      for (const ticket of tickets) {
        for (const label of ticket.labels) {
          allLabelNames.add(label)
        }
      }

      // Create missing labels if requested
      if (createMissingLabels) {
        const defaultColors = [
          '#ef4444',
          '#f97316',
          '#eab308',
          '#22c55e',
          '#06b6d4',
          '#3b82f6',
          '#8b5cf6',
          '#ec4899',
          '#6b7280',
          '#14b8a6',
        ]
        let colorIdx = 0

        for (const labelName of allLabelNames) {
          if (!labelMap.has(labelName.toLowerCase())) {
            const color = defaultColors[colorIdx % defaultColors.length]
            colorIdx++
            try {
              const newLabel = await tx.label.create({
                data: {
                  name: labelName,
                  color,
                  projectId,
                },
              })
              labelMap.set(labelName.toLowerCase(), newLabel.id)
              labelsCreated++
            } catch {
              // Label might already exist due to race condition; try to find it
              const existing = await tx.label.findFirst({
                where: { projectId, name: labelName },
              })
              if (existing) {
                labelMap.set(labelName.toLowerCase(), existing.id)
              } else {
                warnings.push(`Failed to create label "${labelName}"`)
              }
            }
          }
        }
      }

      // Get max ticket number for this project
      const maxResult = await tx.ticket.aggregate({
        where: { projectId },
        _max: { number: true },
      })
      let nextNumber = (maxResult._max.number ?? 0) + 1

      // Get max order in target column
      const maxOrderResult = await tx.ticket.aggregate({
        where: { columnId },
        _max: { order: true },
      })
      let nextOrder = (maxOrderResult._max.order ?? -1) + 1

      // Create each ticket
      let imported = 0
      for (const ticketData of tickets) {
        // Resolve label IDs
        const labelIds: string[] = []
        for (const labelName of ticketData.labels) {
          const labelId = labelMap.get(labelName.toLowerCase())
          if (labelId) {
            labelIds.push(labelId)
          } else if (!createMissingLabels) {
            warnings.push(`Label "${labelName}" not found for ticket "${ticketData.externalKey}"`)
          }
        }

        try {
          const newTicket = await tx.ticket.create({
            data: {
              number: nextNumber,
              title: ticketData.title,
              description: ticketData.description,
              type: ticketData.type,
              priority: ticketData.priority,
              storyPoints: ticketData.storyPoints,
              order: nextOrder,
              columnId,
              projectId,
              creatorId: user.id,
              sprintId: sprintId ?? undefined,
              resolution: ticketData.isResolved ? (ticketData.resolution ?? 'Done') : null,
              resolvedAt: ticketData.isResolved ? new Date() : null,
              labels: labelIds.length > 0 ? { connect: labelIds.map((id) => ({ id })) } : undefined,
            },
          })

          // Create sprint history entry if assigned to a sprint
          if (sprintId) {
            await tx.ticketSprintHistory.create({
              data: {
                ticketId: newTicket.id,
                sprintId,
                entryType: 'added',
              },
            })
          }

          nextNumber++
          nextOrder++
          imported++
        } catch (error) {
          const msg = error instanceof Error ? error.message : 'Unknown error'
          warnings.push(`Failed to import "${ticketData.externalKey}": ${msg}`)
        }
      }

      return { imported, labelsCreated, warnings }
    })

    // Emit real-time events so other tabs/users see the imported tickets
    const tabId = request.headers.get('X-Tab-Id') || undefined
    projectEvents.emitTicketEvent({
      type: 'ticket.created',
      projectId,
      ticketId: 'batch-import',
      userId: user.id,
      tabId,
      timestamp: Date.now(),
    })

    return NextResponse.json(result, { status: 201 })
  } catch (error) {
    return handleApiError(error, 'import tickets')
  }
}

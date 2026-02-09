import { NextResponse } from 'next/server'
import { z } from 'zod'
import { handleApiError, notFoundError, validationError } from '@/lib/api-utils'
import { requireAuth, requirePermission, requireProjectByKey } from '@/lib/auth-helpers'
import { db } from '@/lib/db'
import { PERMISSIONS } from '@/lib/permissions'

const updateColumnSchema = z.object({
  name: z.string().min(1).max(50).optional(),
  order: z.number().int().min(0).optional(),
})

/**
 * PATCH /api/projects/[projectId]/columns/[columnId] - Update a column
 * Requires board.manage permission
 */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ projectId: string; columnId: string }> },
) {
  try {
    const user = await requireAuth()
    const { projectId: projectKey, columnId } = await params
    const projectId = await requireProjectByKey(projectKey)

    // Check board.manage permission
    await requirePermission(user.id, projectId, PERMISSIONS.BOARD_MANAGE)

    const body = await request.json()
    const parsed = updateColumnSchema.safeParse(body)

    if (!parsed.success) {
      return validationError(parsed)
    }

    // Verify column exists and belongs to project
    const existingColumn = await db.column.findFirst({
      where: { id: columnId, projectId },
    })

    if (!existingColumn) {
      return notFoundError('Column')
    }

    const updateData: { name?: string; order?: number } = {}
    if (parsed.data.name !== undefined) {
      updateData.name = parsed.data.name
    }
    if (parsed.data.order !== undefined) {
      updateData.order = parsed.data.order
    }

    const column = await db.column.update({
      where: { id: columnId },
      data: updateData,
      select: {
        id: true,
        name: true,
        order: true,
        projectId: true,
      },
    })

    return NextResponse.json(column)
  } catch (error) {
    return handleApiError(error, 'update column')
  }
}

/**
 * DELETE /api/projects/[projectId]/columns/[columnId] - Delete a column
 * Requires board.manage permission
 * Query params:
 *   - moveTicketsTo: column ID to move tickets to (required if column has tickets)
 */
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ projectId: string; columnId: string }> },
) {
  try {
    const user = await requireAuth()
    const { projectId: projectKey, columnId } = await params
    const projectId = await requireProjectByKey(projectKey)

    // Check board.manage permission
    await requirePermission(user.id, projectId, PERMISSIONS.BOARD_MANAGE)

    // Get moveTicketsTo from query params
    const url = new URL(request.url)
    const moveTicketsTo = url.searchParams.get('moveTicketsTo')

    // Verify column exists and belongs to project
    const existingColumn = await db.column.findFirst({
      where: { id: columnId, projectId },
      include: { _count: { select: { tickets: true } } },
    })

    if (!existingColumn) {
      return notFoundError('Column')
    }

    // Check if column has tickets
    if (existingColumn._count.tickets > 0) {
      if (!moveTicketsTo) {
        return NextResponse.json(
          {
            error: `Column has ${existingColumn._count.tickets} ticket(s). Provide moveTicketsTo parameter.`,
          },
          { status: 400 },
        )
      }

      // Verify target column exists and belongs to project
      const targetColumn = await db.column.findFirst({
        where: { id: moveTicketsTo, projectId },
      })

      if (!targetColumn) {
        return NextResponse.json({ error: 'Target column not found' }, { status: 400 })
      }

      if (targetColumn.id === columnId) {
        return NextResponse.json(
          { error: 'Cannot move tickets to the same column' },
          { status: 400 },
        )
      }
    }

    // Get the count of columns to prevent deleting the last one
    const columnCount = await db.column.count({
      where: { projectId },
    })

    if (columnCount <= 1) {
      return NextResponse.json(
        { error: 'Cannot delete the last column in a project' },
        { status: 400 },
      )
    }

    // Use transaction to move tickets and delete column
    await db.$transaction(async (tx) => {
      // Move tickets if needed
      if (existingColumn._count.tickets > 0 && moveTicketsTo) {
        await tx.ticket.updateMany({
          where: { columnId },
          data: { columnId: moveTicketsTo },
        })
      }

      await tx.column.delete({
        where: { id: columnId },
      })
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    return handleApiError(error, 'delete column')
  }
}

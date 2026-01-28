import { NextResponse } from 'next/server'
import { z } from 'zod'
import { handleApiError, notFoundError, validationError } from '@/lib/api-utils'
import { requireAuth, requirePermission } from '@/lib/auth-helpers'
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
    const { projectId, columnId } = await params

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
 * Note: Tickets in this column must be moved first
 */
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ projectId: string; columnId: string }> },
) {
  try {
    const user = await requireAuth()
    const { projectId, columnId } = await params

    // Check board.manage permission
    await requirePermission(user.id, projectId, PERMISSIONS.BOARD_MANAGE)

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
      return NextResponse.json(
        {
          error: `Cannot delete column with ${existingColumn._count.tickets} ticket(s). Move or delete tickets first.`,
        },
        { status: 400 },
      )
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

    await db.column.delete({
      where: { id: columnId },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    return handleApiError(error, 'delete column')
  }
}

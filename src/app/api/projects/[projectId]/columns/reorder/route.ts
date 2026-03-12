import { NextResponse } from 'next/server'
import { z } from 'zod'
import { handleApiError, validationError } from '@/lib/api-utils'
import { requireAuth, requirePermission, requireProjectByKey } from '@/lib/auth-helpers'
import { db } from '@/lib/db'
import { PERMISSIONS } from '@/lib/permissions'

const reorderColumnsSchema = z.object({
  columnIds: z.array(z.string()).min(1, 'At least one column ID is required'),
})

/**
 * POST /api/projects/[projectId]/columns/reorder - Reorder columns
 * Requires board.manage permission
 * Accepts an array of column IDs in the desired order
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ projectId: string }> },
) {
  try {
    const user = await requireAuth()
    const { projectId: projectKey } = await params
    const projectId = await requireProjectByKey(projectKey)

    await requirePermission(user.id, projectId, PERMISSIONS.BOARD_MANAGE)

    const body = await request.json()
    const parsed = reorderColumnsSchema.safeParse(body)

    if (!parsed.success) {
      return validationError(parsed)
    }

    const { columnIds } = parsed.data

    // Verify all column IDs belong to this project
    const existingColumns = await db.column.findMany({
      where: { projectId, id: { in: columnIds } },
      select: { id: true },
    })

    if (existingColumns.length !== columnIds.length) {
      return NextResponse.json(
        { error: 'Some column IDs are invalid or do not belong to this project' },
        { status: 400 },
      )
    }

    // Update order in a transaction
    await db.$transaction(
      columnIds.map((columnId: string, index: number) =>
        db.column.update({
          where: { id: columnId },
          data: { order: index },
        }),
      ),
    )

    // Return updated columns
    const columns = await db.column.findMany({
      where: { projectId },
      orderBy: { order: 'asc' },
      select: {
        id: true,
        name: true,
        icon: true,
        color: true,
        order: true,
        projectId: true,
      },
    })

    return NextResponse.json(columns)
  } catch (error) {
    return handleApiError(error, 'reorder columns')
  }
}

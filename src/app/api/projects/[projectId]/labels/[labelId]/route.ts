import { NextResponse } from 'next/server'
import { requireAuth, requirePermission } from '@/lib/auth-helpers'
import { db } from '@/lib/db'
import { projectEvents } from '@/lib/events'
import { PERMISSIONS } from '@/lib/permissions'

/**
 * DELETE /api/projects/[projectId]/labels/[labelId] - Delete a label
 * Requires labels.manage permission
 * Removes the label from all tickets that use it
 */
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ projectId: string; labelId: string }> },
) {
  try {
    const user = await requireAuth()
    const { projectId, labelId } = await params

    // Check label management permission
    await requirePermission(user.id, projectId, PERMISSIONS.LABELS_MANAGE)

    // Verify label exists and belongs to this project
    const label = await db.label.findFirst({
      where: { id: labelId, projectId },
    })

    if (!label) {
      return NextResponse.json({ error: 'Label not found' }, { status: 404 })
    }

    // Delete the label (Prisma will automatically disconnect from tickets)
    await db.label.delete({
      where: { id: labelId },
    })

    // Emit real-time event for other clients
    const tabId = request.headers.get('X-Tab-Id') || undefined
    projectEvents.emitLabelEvent({
      type: 'label.deleted',
      projectId,
      labelId,
      userId: user.id,
      tabId,
      timestamp: Date.now(),
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === 'Unauthorized') {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
      }
      if (error.message.startsWith('Forbidden:')) {
        return NextResponse.json({ error: error.message }, { status: 403 })
      }
    }
    console.error('Failed to delete label:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

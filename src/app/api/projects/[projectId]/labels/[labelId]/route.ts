import { NextResponse } from 'next/server'
import { z } from 'zod'
import { requireAuth, requirePermission, requireProjectByKey } from '@/lib/auth-helpers'
import { db } from '@/lib/db'
import { projectEvents } from '@/lib/events'
import { PERMISSIONS } from '@/lib/permissions'
import { LABEL_SELECT } from '@/lib/prisma-selects'

const updateLabelSchema = z.object({
  name: z.string().min(1).max(50).trim().optional(),
  color: z
    .string()
    .regex(/^#[0-9A-Fa-f]{6}$/)
    .optional(),
})

/**
 * PATCH /api/projects/[projectId]/labels/[labelId] - Update a label
 * Requires labels.manage permission
 */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ projectId: string; labelId: string }> },
) {
  try {
    const user = await requireAuth()
    const { projectId: projectKey, labelId } = await params
    const projectId = await requireProjectByKey(projectKey)

    // Check label management permission
    await requirePermission(user.id, projectId, PERMISSIONS.LABELS_MANAGE)

    const body = await request.json()
    const result = updateLabelSchema.safeParse(body)

    if (!result.success) {
      return NextResponse.json({ error: 'Invalid request data' }, { status: 400 })
    }

    const { name, color } = result.data

    // Check if at least one field is provided
    if (!name && !color) {
      return NextResponse.json({ error: 'No fields to update' }, { status: 400 })
    }

    // Verify label exists and belongs to this project
    const existingLabel = await db.label.findFirst({
      where: { id: labelId, projectId },
    })

    if (!existingLabel) {
      return NextResponse.json({ error: 'Label not found' }, { status: 404 })
    }

    // If name is changing, check for duplicates (case-insensitive)
    if (name && name.toLowerCase() !== existingLabel.name.toLowerCase()) {
      const allLabels = await db.label.findMany({
        where: { projectId },
        select: { id: true, name: true },
      })
      const normalizedName = name.toLowerCase()
      const duplicate = allLabels.find(
        (l) => l.id !== labelId && l.name.toLowerCase() === normalizedName,
      )
      if (duplicate) {
        return NextResponse.json(
          { error: 'A label with this name already exists' },
          { status: 409 },
        )
      }
    }

    // Update the label
    const updatedLabel = await db.label.update({
      where: { id: labelId },
      data: {
        ...(name && { name }),
        ...(color && { color }),
      },
      select: LABEL_SELECT,
    })

    // Emit real-time event for other clients
    const tabId = request.headers.get('X-Tab-Id') || undefined
    projectEvents.emitLabelEvent({
      type: 'label.updated',
      projectId,
      labelId,
      userId: user.id,
      tabId,
      timestamp: Date.now(),
    })

    return NextResponse.json(updatedLabel)
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === 'Unauthorized') {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
      }
      if (error.message.startsWith('Forbidden:')) {
        return NextResponse.json({ error: error.message }, { status: 403 })
      }
    }
    console.error('Failed to update label:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

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
    const { projectId: projectKey, labelId } = await params
    const projectId = await requireProjectByKey(projectKey)

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

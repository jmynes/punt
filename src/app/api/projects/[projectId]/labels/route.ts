import { NextResponse } from 'next/server'
import { z } from 'zod'
import {
  requireAuth,
  requireMembership,
  requirePermission,
  requireProjectByKey,
} from '@/lib/auth-helpers'
import { LABEL_COLORS } from '@/lib/constants'
import { db } from '@/lib/db'
import { projectEvents } from '@/lib/events'
import { PERMISSIONS } from '@/lib/permissions'
import { LABEL_SELECT } from '@/lib/prisma-selects'

const createLabelSchema = z.object({
  name: z.string().min(1).max(50).trim(),
  color: z
    .string()
    .regex(/^#[0-9A-Fa-f]{6}$/)
    .optional(),
})

/**
 * GET /api/projects/[projectId]/labels - Get all labels for a project
 * Requires project membership
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ projectId: string }> },
) {
  try {
    const user = await requireAuth()
    const { projectId: projectKey } = await params
    const projectId = await requireProjectByKey(projectKey)

    // Check project membership
    await requireMembership(user.id, projectId)

    // Check if ticket count should be included
    const url = new URL(request.url)
    const includeCount = url.searchParams.get('include_count') === 'true'

    const labels = await db.label.findMany({
      where: { projectId },
      select: {
        ...LABEL_SELECT,
        ...(includeCount && { _count: { select: { tickets: true } } }),
      },
      orderBy: { name: 'asc' },
    })

    return NextResponse.json(labels)
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === 'Unauthorized') {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
      }
      if (error.message.startsWith('Forbidden:')) {
        return NextResponse.json({ error: error.message }, { status: 403 })
      }
    }
    console.error('Failed to fetch labels:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

/**
 * POST /api/projects/[projectId]/labels - Create a new label
 * Requires project membership
 * Returns existing label if one with the same name (case-insensitive) already exists
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ projectId: string }> },
) {
  try {
    const user = await requireAuth()
    const { projectId: projectKey } = await params
    const projectId = await requireProjectByKey(projectKey)

    // Check label management permission
    await requirePermission(user.id, projectId, PERMISSIONS.LABELS_MANAGE)

    const body = await request.json()
    const result = createLabelSchema.safeParse(body)

    if (!result.success) {
      console.error('Label creation validation error:', result.error.flatten())
      return NextResponse.json({ error: 'Invalid request data' }, { status: 400 })
    }

    const { name, color } = result.data

    // Check if label with same name already exists (case-insensitive)
    const existingLabel = await db.label.findFirst({
      where: { projectId, name: { equals: name, mode: 'insensitive' } },
      select: LABEL_SELECT,
    })

    if (existingLabel) {
      // Return existing label instead of creating duplicate
      return NextResponse.json(existingLabel)
    }

    // Get existing labels count to pick a color
    const existingCount = await db.label.count({ where: { projectId } })
    const assignedColor = color || LABEL_COLORS[existingCount % LABEL_COLORS.length]

    const label = await db.label.create({
      data: {
        name,
        color: assignedColor,
        projectId,
      },
      select: LABEL_SELECT,
    })

    // Emit real-time event for other clients
    const tabId = request.headers.get('X-Tab-Id') || undefined
    projectEvents.emitLabelEvent({
      type: 'label.created',
      projectId,
      labelId: label.id,
      userId: user.id,
      tabId,
      timestamp: Date.now(),
    })

    return NextResponse.json(label, { status: 201 })
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === 'Unauthorized') {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
      }
      if (error.message.startsWith('Forbidden:')) {
        return NextResponse.json({ error: error.message }, { status: 403 })
      }
    }
    console.error('Failed to create label:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

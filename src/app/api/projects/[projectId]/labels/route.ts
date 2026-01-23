import { NextResponse } from 'next/server'
import { z } from 'zod'
import { requireAuth, requireMembership, requirePermission } from '@/lib/auth-helpers'
import { db } from '@/lib/db'
import { projectEvents } from '@/lib/events'
import { PERMISSIONS } from '@/lib/permissions'
import { LABEL_SELECT } from '@/lib/prisma-selects'

// Predefined colors for auto-assignment when creating labels
const LABEL_COLORS = [
  '#ec4899', // pink
  '#06b6d4', // cyan
  '#8b5cf6', // purple
  '#f59e0b', // amber
  '#ef4444', // red
  '#14b8a6', // teal
  '#64748b', // slate
  '#22c55e', // green
  '#eab308', // yellow
  '#dc2626', // red-600
  '#a855f7', // purple-500
  '#78716c', // stone
  '#3b82f6', // blue
  '#16a34a', // green-600
  '#f97316', // orange
]

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
  _request: Request,
  { params }: { params: Promise<{ projectId: string }> },
) {
  try {
    const user = await requireAuth()
    const { projectId } = await params

    // Check project membership
    await requireMembership(user.id, projectId)

    const labels = await db.label.findMany({
      where: { projectId },
      select: LABEL_SELECT,
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
    const { projectId } = await params

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
    // SQLite doesn't support case-insensitive mode, so we fetch all and compare in JS
    const allLabels = await db.label.findMany({
      where: { projectId },
      select: LABEL_SELECT,
    })
    const normalizedName = name.toLowerCase()
    const existingLabel = allLabels.find((l) => l.name.toLowerCase() === normalizedName)

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

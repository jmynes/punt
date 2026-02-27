import { NextResponse } from 'next/server'
import { z } from 'zod'
import { handleApiError, validationError } from '@/lib/api-utils'
import {
  requireAuth,
  requireMembership,
  requirePermission,
  requireProjectByKey,
} from '@/lib/auth-helpers'
import { db } from '@/lib/db'
import { PERMISSIONS } from '@/lib/permissions'

// Time format validation regex (HH:mm)
const timeRegex = /^([01]\d|2[0-3]):([0-5]\d)$/

const updateSettingsSchema = z.object({
  defaultSprintDuration: z.number().int().min(1).max(90).optional(),
  autoCarryOverIncomplete: z.boolean().optional(),
  doneColumnIds: z.array(z.string()).optional(),
  defaultStartTime: z.string().regex(timeRegex, 'Invalid time format (HH:mm)').optional(),
  defaultEndTime: z.string().regex(timeRegex, 'Invalid time format (HH:mm)').optional(),
})

type RouteParams = { params: Promise<{ projectId: string }> }

/**
 * GET /api/projects/[projectId]/sprints/settings - Get sprint settings
 * Requires project membership
 * Returns default settings if none configured
 */
export async function GET(_request: Request, { params }: RouteParams) {
  try {
    const user = await requireAuth()
    const { projectId: projectKey } = await params
    const projectId = await requireProjectByKey(projectKey)

    await requireMembership(user.id, projectId)

    let settings = await db.projectSprintSettings.findUnique({
      where: { projectId },
    })

    // Return default settings if none exist
    if (!settings) {
      settings = {
        id: '',
        projectId,
        defaultSprintDuration: 14,
        autoCarryOverIncomplete: true,
        doneColumnIds: '[]',
        defaultStartTime: '09:00',
        defaultEndTime: '17:00',
        createdAt: new Date(),
        updatedAt: new Date(),
      }
    }

    // Parse doneColumnIds from JSON string
    return NextResponse.json({
      defaultSprintDuration: settings.defaultSprintDuration,
      autoCarryOverIncomplete: settings.autoCarryOverIncomplete,
      doneColumnIds: settings.doneColumnIds,
      defaultStartTime: settings.defaultStartTime,
      defaultEndTime: settings.defaultEndTime,
    })
  } catch (error) {
    return handleApiError(error, 'fetch sprint settings')
  }
}

/**
 * PATCH /api/projects/[projectId]/sprints/settings - Update sprint settings
 * Requires project admin role
 */
export async function PATCH(request: Request, { params }: RouteParams) {
  try {
    const user = await requireAuth()
    const { projectId: projectKey } = await params
    const projectId = await requireProjectByKey(projectKey)

    await requirePermission(user.id, projectId, PERMISSIONS.SPRINTS_MANAGE)

    const body = await request.json()
    const result = updateSettingsSchema.safeParse(body)

    if (!result.success) {
      return validationError(result)
    }

    const {
      defaultSprintDuration,
      autoCarryOverIncomplete,
      doneColumnIds,
      defaultStartTime,
      defaultEndTime,
    } = result.data

    const settings = await db.projectSprintSettings.upsert({
      where: { projectId },
      create: {
        projectId,
        ...(defaultSprintDuration !== undefined && { defaultSprintDuration }),
        ...(autoCarryOverIncomplete !== undefined && { autoCarryOverIncomplete }),
        ...(doneColumnIds !== undefined && { doneColumnIds: doneColumnIds }),
        ...(defaultStartTime !== undefined && { defaultStartTime }),
        ...(defaultEndTime !== undefined && { defaultEndTime }),
      },
      update: {
        ...(defaultSprintDuration !== undefined && { defaultSprintDuration }),
        ...(autoCarryOverIncomplete !== undefined && { autoCarryOverIncomplete }),
        ...(doneColumnIds !== undefined && { doneColumnIds: doneColumnIds }),
        ...(defaultStartTime !== undefined && { defaultStartTime }),
        ...(defaultEndTime !== undefined && { defaultEndTime }),
      },
    })

    return NextResponse.json({
      defaultSprintDuration: settings.defaultSprintDuration,
      autoCarryOverIncomplete: settings.autoCarryOverIncomplete,
      doneColumnIds: settings.doneColumnIds,
      defaultStartTime: settings.defaultStartTime,
      defaultEndTime: settings.defaultEndTime,
    })
  } catch (error) {
    return handleApiError(error, 'update sprint settings')
  }
}

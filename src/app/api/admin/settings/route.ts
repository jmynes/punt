import { NextResponse } from 'next/server'
import { z } from 'zod'
import { handleApiError, validationError } from '@/lib/api-utils'
import { requireSystemAdmin } from '@/lib/auth-helpers'
import { db } from '@/lib/db'
import { getSystemSettings } from '@/lib/system-settings'

const UpdateSettingsSchema = z.object({
  maxImageSizeMB: z.number().int().min(1).max(100).optional(),
  maxVideoSizeMB: z.number().int().min(1).max(500).optional(),
  maxDocumentSizeMB: z.number().int().min(1).max(100).optional(),
  maxAttachmentsPerTicket: z.number().int().min(1).max(50).optional(),
  allowedImageTypes: z.array(z.string()).optional(),
  allowedVideoTypes: z.array(z.string()).optional(),
  allowedDocumentTypes: z.array(z.string()).optional(),
})

/**
 * GET /api/admin/settings
 * Fetch system settings (creates defaults if none exist)
 * Requires system admin
 */
export async function GET() {
  try {
    await requireSystemAdmin()

    const settings = await getSystemSettings()
    return NextResponse.json(settings)
  } catch (error) {
    return handleApiError(error, 'fetch system settings')
  }
}

/**
 * PATCH /api/admin/settings
 * Update system settings
 * Requires system admin
 */
export async function PATCH(request: Request) {
  try {
    const user = await requireSystemAdmin()

    const body = await request.json()
    const parseResult = UpdateSettingsSchema.safeParse(body)

    if (!parseResult.success) {
      return validationError(parseResult)
    }

    const updates = parseResult.data
    const updateData: Record<string, unknown> = {
      updatedBy: user.id,
    }

    // Apply numeric updates
    if (updates.maxImageSizeMB !== undefined) {
      updateData.maxImageSizeMB = updates.maxImageSizeMB
    }
    if (updates.maxVideoSizeMB !== undefined) {
      updateData.maxVideoSizeMB = updates.maxVideoSizeMB
    }
    if (updates.maxDocumentSizeMB !== undefined) {
      updateData.maxDocumentSizeMB = updates.maxDocumentSizeMB
    }
    if (updates.maxAttachmentsPerTicket !== undefined) {
      updateData.maxAttachmentsPerTicket = updates.maxAttachmentsPerTicket
    }

    // Stringify array fields for storage
    if (updates.allowedImageTypes !== undefined) {
      updateData.allowedImageTypes = JSON.stringify(updates.allowedImageTypes)
    }
    if (updates.allowedVideoTypes !== undefined) {
      updateData.allowedVideoTypes = JSON.stringify(updates.allowedVideoTypes)
    }
    if (updates.allowedDocumentTypes !== undefined) {
      updateData.allowedDocumentTypes = JSON.stringify(updates.allowedDocumentTypes)
    }

    // Upsert to handle case where settings don't exist yet
    await db.systemSettings.upsert({
      where: { id: 'system-settings' },
      update: updateData,
      create: {
        id: 'system-settings',
        ...updateData,
      },
    })

    // Return the updated settings with parsed arrays
    const settings = await getSystemSettings()
    return NextResponse.json(settings)
  } catch (error) {
    return handleApiError(error, 'update system settings')
  }
}

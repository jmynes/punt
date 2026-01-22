import { NextResponse } from 'next/server'
import { z } from 'zod'
import { handleApiError, validationError } from '@/lib/api-utils'
import { requireSystemAdmin } from '@/lib/auth-helpers'
import { db } from '@/lib/db'
import { getEmailSettings } from '@/lib/email/settings'
import { projectEvents } from '@/lib/events'
import { getSystemSettings } from '@/lib/system-settings'

const UpdateSettingsSchema = z.object({
  // Branding settings
  appName: z.string().min(1).max(50).optional(),
  logoLetter: z.string().min(1).max(2).optional(),
  logoGradientFrom: z
    .string()
    .regex(/^#[0-9A-Fa-f]{6}$/, 'Invalid hex color')
    .optional(),
  logoGradientTo: z
    .string()
    .regex(/^#[0-9A-Fa-f]{6}$/, 'Invalid hex color')
    .optional(),

  // Upload settings
  maxImageSizeMB: z.number().int().min(1).max(100).optional(),
  maxVideoSizeMB: z.number().int().min(1).max(500).optional(),
  maxDocumentSizeMB: z.number().int().min(1).max(100).optional(),
  maxAttachmentsPerTicket: z.number().int().min(1).max(50).optional(),
  allowedImageTypes: z.array(z.string()).optional(),
  allowedVideoTypes: z.array(z.string()).optional(),
  allowedDocumentTypes: z.array(z.string()).optional(),

  // Email settings
  emailEnabled: z.boolean().optional(),
  emailProvider: z.enum(['none', 'smtp', 'resend', 'console']).optional(),
  emailFromAddress: z.string().email().optional().or(z.literal('')),
  emailFromName: z.string().max(100).optional(),
  smtpHost: z.string().max(255).optional(),
  smtpPort: z.number().int().min(1).max(65535).optional(),
  smtpUsername: z.string().max(255).optional(),
  smtpSecure: z.boolean().optional(),
  emailPasswordReset: z.boolean().optional(),
  emailWelcome: z.boolean().optional(),
  emailVerification: z.boolean().optional(),
  emailInvitations: z.boolean().optional(),
})

/**
 * GET /api/admin/settings
 * Fetch system settings (creates defaults if none exist)
 * Requires system admin
 */
export async function GET() {
  try {
    await requireSystemAdmin()

    const uploadSettings = await getSystemSettings()
    const emailSettings = await getEmailSettings()

    return NextResponse.json({
      ...uploadSettings,
      ...emailSettings,
    })
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

    // Branding updates
    if (updates.appName !== undefined) {
      updateData.appName = updates.appName
    }
    if (updates.logoLetter !== undefined) {
      updateData.logoLetter = updates.logoLetter
    }
    if (updates.logoGradientFrom !== undefined) {
      updateData.logoGradientFrom = updates.logoGradientFrom
    }
    if (updates.logoGradientTo !== undefined) {
      updateData.logoGradientTo = updates.logoGradientTo
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

    // Email settings
    if (updates.emailEnabled !== undefined) {
      updateData.emailEnabled = updates.emailEnabled
    }
    if (updates.emailProvider !== undefined) {
      updateData.emailProvider = updates.emailProvider
    }
    if (updates.emailFromAddress !== undefined) {
      updateData.emailFromAddress = updates.emailFromAddress
    }
    if (updates.emailFromName !== undefined) {
      updateData.emailFromName = updates.emailFromName
    }
    if (updates.smtpHost !== undefined) {
      updateData.smtpHost = updates.smtpHost
    }
    if (updates.smtpPort !== undefined) {
      updateData.smtpPort = updates.smtpPort
    }
    if (updates.smtpUsername !== undefined) {
      updateData.smtpUsername = updates.smtpUsername
    }
    if (updates.smtpSecure !== undefined) {
      updateData.smtpSecure = updates.smtpSecure
    }
    if (updates.emailPasswordReset !== undefined) {
      updateData.emailPasswordReset = updates.emailPasswordReset
    }
    if (updates.emailWelcome !== undefined) {
      updateData.emailWelcome = updates.emailWelcome
    }
    if (updates.emailVerification !== undefined) {
      updateData.emailVerification = updates.emailVerification
    }
    if (updates.emailInvitations !== undefined) {
      updateData.emailInvitations = updates.emailInvitations
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

    // Emit branding event if any branding field was updated
    const hasBrandingUpdate =
      updates.appName !== undefined ||
      updates.logoLetter !== undefined ||
      updates.logoGradientFrom !== undefined ||
      updates.logoGradientTo !== undefined

    if (hasBrandingUpdate) {
      const tabId = request.headers.get('x-tab-id') || undefined
      projectEvents.emitBrandingEvent({
        type: 'branding.updated',
        userId: user.id,
        tabId,
        timestamp: Date.now(),
      })
    }

    // Return the updated settings with parsed arrays
    const uploadSettings = await getSystemSettings()
    const emailSettings = await getEmailSettings()
    return NextResponse.json({
      ...uploadSettings,
      ...emailSettings,
    })
  } catch (error) {
    return handleApiError(error, 'update system settings')
  }
}

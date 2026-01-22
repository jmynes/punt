import { unlink } from 'node:fs/promises'
import { NextResponse } from 'next/server'
import { handleApiError } from '@/lib/api-utils'
import { requireSystemAdmin } from '@/lib/auth-helpers'
import { db } from '@/lib/db'
import { projectEvents } from '@/lib/events'
import { FilesystemStorage } from '@/lib/file-storage'
import { processLogoImage } from '@/lib/image-processing'
import { logger } from '@/lib/logger'

const fileStorage = new FilesystemStorage()

const ALLOWED_LOGO_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp']
const MAX_LOGO_SIZE = 2 * 1024 * 1024 // 2MB

function generateLogoFilename(): string {
  const timestamp = Date.now()
  return `logo-${timestamp}.webp`
}

/**
 * POST /api/admin/settings/logo
 * Upload a custom logo
 * Requires system admin
 */
export async function POST(request: Request) {
  try {
    const user = await requireSystemAdmin()

    const formData = await request.formData()
    const file = formData.get('logo') as File | null

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 })
    }

    // Validate file type
    if (!ALLOWED_LOGO_TYPES.includes(file.type)) {
      return NextResponse.json(
        { error: `Invalid file type. Allowed: ${ALLOWED_LOGO_TYPES.join(', ')}` },
        { status: 400 },
      )
    }

    // Validate file size
    if (file.size > MAX_LOGO_SIZE) {
      return NextResponse.json(
        { error: `File too large. Maximum size is ${MAX_LOGO_SIZE / 1024 / 1024}MB` },
        { status: 400 },
      )
    }

    // Get current logo for cleanup
    const currentSettings = await db.systemSettings.findUnique({
      where: { id: 'system-settings' },
      select: { logoUrl: true },
    })

    // Save new logo
    const logoDir = fileStorage.join(process.cwd(), 'public', 'uploads', 'branding')
    await fileStorage.ensureDirectoryExists(logoDir)

    const filename = generateLogoFilename()
    const filepath = fileStorage.join(logoDir, filename)

    const bytes = await file.arrayBuffer()
    const rawBuffer = Buffer.from(bytes)

    // Process image: resize, strip metadata, convert to WebP
    let processedBuffer: Buffer
    try {
      processedBuffer = await processLogoImage(rawBuffer)
      logger.debug('Logo processed successfully', {
        originalSize: rawBuffer.length,
        processedSize: processedBuffer.length,
        reduction: `${Math.round((1 - processedBuffer.length / rawBuffer.length) * 100)}%`,
      })
    } catch (error) {
      logger.error('Failed to process logo image', error instanceof Error ? error : undefined)
      return NextResponse.json(
        { error: 'Failed to process image. Please try a different file.' },
        { status: 400 },
      )
    }

    await fileStorage.writeFile(filepath, processedBuffer)

    const logoUrl = `/uploads/branding/${filename}`

    // Update system settings with new logo URL
    await db.systemSettings.upsert({
      where: { id: 'system-settings' },
      update: {
        logoUrl,
        updatedBy: user.id,
      },
      create: {
        id: 'system-settings',
        logoUrl,
        updatedBy: user.id,
      },
    })

    // Delete old logo file if exists
    if (currentSettings?.logoUrl?.startsWith('/uploads/branding/')) {
      try {
        const oldPath = fileStorage.join(process.cwd(), 'public', currentSettings.logoUrl)
        await unlink(oldPath)
      } catch {
        // Ignore errors deleting old file
      }
    }

    // Emit branding event for real-time sync
    const tabId = request.headers.get('x-tab-id') || undefined
    projectEvents.emitBrandingEvent({
      type: 'branding.updated',
      userId: user.id,
      tabId,
      timestamp: Date.now(),
    })

    return NextResponse.json({ success: true, logoUrl })
  } catch (error) {
    return handleApiError(error, 'upload logo')
  }
}

/**
 * DELETE /api/admin/settings/logo
 * Remove the custom logo
 * Requires system admin
 */
export async function DELETE(request: Request) {
  try {
    const user = await requireSystemAdmin()

    // Get current logo for cleanup
    const currentSettings = await db.systemSettings.findUnique({
      where: { id: 'system-settings' },
      select: { logoUrl: true },
    })

    // Clear logo URL in database
    await db.systemSettings.upsert({
      where: { id: 'system-settings' },
      update: {
        logoUrl: null,
        updatedBy: user.id,
      },
      create: {
        id: 'system-settings',
        logoUrl: null,
        updatedBy: user.id,
      },
    })

    // Delete logo file if exists
    if (currentSettings?.logoUrl?.startsWith('/uploads/branding/')) {
      try {
        const logoPath = fileStorage.join(process.cwd(), 'public', currentSettings.logoUrl)
        await unlink(logoPath)
      } catch {
        // Ignore errors deleting file
      }
    }

    // Emit branding event for real-time sync
    const tabId = request.headers.get('x-tab-id') || undefined
    projectEvents.emitBrandingEvent({
      type: 'branding.updated',
      userId: user.id,
      tabId,
      timestamp: Date.now(),
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    return handleApiError(error, 'delete logo')
  }
}

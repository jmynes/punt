import { unlink } from 'node:fs/promises'
import path from 'node:path'
import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth-helpers'
import { db } from '@/lib/db'
import { isDemoMode } from '@/lib/demo/demo-config'
import { projectEvents } from '@/lib/events'
import { FilesystemStorage } from '@/lib/file-storage'
import { processAvatarImage } from '@/lib/image-processing'
import { logger } from '@/lib/logger'

const fileStorage = new FilesystemStorage()

const ALLOWED_AVATAR_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp']
const MAX_AVATAR_SIZE = 5 * 1024 * 1024 // 5MB

function generateAvatarFilename(userId: string): string {
  const timestamp = Date.now()
  // Always use .webp since we convert all avatars to WebP
  return `avatar-${userId}-${timestamp}.webp`
}

// POST /api/me/avatar - Upload avatar
export async function POST(request: Request) {
  try {
    // Handle demo mode - return success without persisting
    if (isDemoMode()) {
      return NextResponse.json({
        success: true,
        avatar: null,
        message: 'Avatar upload simulated in demo mode (changes are not persisted)',
      })
    }

    const currentUser = await requireAuth()

    const formData = await request.formData()
    const file = formData.get('avatar') as File | null

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 })
    }

    // Validate file type
    if (!ALLOWED_AVATAR_TYPES.includes(file.type)) {
      return NextResponse.json(
        { error: `Invalid file type. Allowed: ${ALLOWED_AVATAR_TYPES.join(', ')}` },
        { status: 400 },
      )
    }

    // Validate file size
    if (file.size > MAX_AVATAR_SIZE) {
      return NextResponse.json(
        { error: `File too large. Maximum size is ${MAX_AVATAR_SIZE / 1024 / 1024}MB` },
        { status: 400 },
      )
    }

    // Get old avatar path for cleanup
    const existingUser = await db.user.findUnique({
      where: { id: currentUser.id },
      select: { avatar: true },
    })

    // Save new avatar
    const avatarDir = fileStorage.join(process.cwd(), 'public', 'uploads', 'avatars')
    await fileStorage.ensureDirectoryExists(avatarDir)

    const filename = generateAvatarFilename(currentUser.id)
    const filepath = fileStorage.join(avatarDir, filename)

    const bytes = await file.arrayBuffer()
    const rawBuffer = Buffer.from(bytes)

    // Process image: resize, strip metadata, convert to WebP
    let processedBuffer: Buffer
    try {
      processedBuffer = await processAvatarImage(rawBuffer)
      logger.debug('Avatar processed successfully', {
        originalSize: rawBuffer.length,
        processedSize: processedBuffer.length,
        reduction: `${Math.round((1 - processedBuffer.length / rawBuffer.length) * 100)}%`,
      })
    } catch (error) {
      logger.error('Failed to process avatar image', error instanceof Error ? error : undefined)
      return NextResponse.json(
        { error: 'Failed to process image. Please try a different file.' },
        { status: 400 },
      )
    }

    await fileStorage.writeFile(filepath, processedBuffer)

    const avatarUrl = `/uploads/avatars/${filename}`

    // Update user avatar in database
    const user = await db.user.update({
      where: { id: currentUser.id },
      data: { avatar: avatarUrl },
      select: {
        id: true,
        avatar: true,
      },
    })

    // Delete old avatar file if exists
    if (existingUser?.avatar?.startsWith('/uploads/avatars/')) {
      try {
        const avatarDir = fileStorage.join(process.cwd(), 'public', 'uploads', 'avatars')
        const oldPath = fileStorage.join(process.cwd(), 'public', existingUser.avatar)

        // Security: Verify resolved path is within the avatars directory
        const resolvedPath = path.resolve(oldPath)
        const resolvedAvatarDir = path.resolve(avatarDir)
        if (resolvedPath.startsWith(resolvedAvatarDir + path.sep)) {
          await unlink(oldPath)
        }
      } catch {
        // Ignore errors deleting old file
      }
    }

    // Emit SSE event for avatar update
    const tabId = request.headers.get('x-tab-id') || undefined
    projectEvents.emitUserEvent({
      type: 'user.updated',
      userId: currentUser.id,
      tabId,
      timestamp: Date.now(),
      changes: {
        avatar: user.avatar,
      },
    })

    return NextResponse.json({ success: true, avatar: user.avatar })
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === 'Unauthorized') {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
      }
      if (error.message === 'Account disabled') {
        return NextResponse.json({ error: 'Account disabled' }, { status: 403 })
      }
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// DELETE /api/me/avatar - Remove avatar
export async function DELETE(request: Request) {
  try {
    // Handle demo mode - return success without persisting
    if (isDemoMode()) {
      return NextResponse.json({ success: true })
    }

    const currentUser = await requireAuth()

    // Get current avatar for cleanup
    const existingUser = await db.user.findUnique({
      where: { id: currentUser.id },
      select: { avatar: true },
    })

    // Clear avatar in database
    await db.user.update({
      where: { id: currentUser.id },
      data: { avatar: null },
    })

    // Delete avatar file if exists
    if (existingUser?.avatar?.startsWith('/uploads/avatars/')) {
      try {
        const avatarDir = fileStorage.join(process.cwd(), 'public', 'uploads', 'avatars')
        const avatarPath = fileStorage.join(process.cwd(), 'public', existingUser.avatar)

        // Security: Verify resolved path is within the avatars directory
        const resolvedPath = path.resolve(avatarPath)
        const resolvedAvatarDir = path.resolve(avatarDir)
        if (resolvedPath.startsWith(resolvedAvatarDir + path.sep)) {
          await unlink(avatarPath)
        }
      } catch {
        // Ignore errors deleting file
      }
    }

    // Emit SSE event for avatar removal
    const tabId = request.headers.get('x-tab-id') || undefined
    projectEvents.emitUserEvent({
      type: 'user.updated',
      userId: currentUser.id,
      tabId,
      timestamp: Date.now(),
      changes: {
        avatar: null,
      },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === 'Unauthorized') {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
      }
      if (error.message === 'Account disabled') {
        return NextResponse.json({ error: 'Account disabled' }, { status: 403 })
      }
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

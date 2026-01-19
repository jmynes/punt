import { unlink } from 'node:fs/promises'
import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth-helpers'
import { db } from '@/lib/db'
import { FilesystemStorage } from '@/lib/file-storage'

const fileStorage = new FilesystemStorage()

const ALLOWED_AVATAR_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp']
const MAX_AVATAR_SIZE = 5 * 1024 * 1024 // 5MB

function generateAvatarFilename(userId: string, originalName: string): string {
  const timestamp = Date.now()
  const extension = originalName.split('.').pop() || 'jpg'
  return `avatar-${userId}-${timestamp}.${extension}`
}

// POST /api/me/avatar - Upload avatar
export async function POST(request: Request) {
  try {
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

    const filename = generateAvatarFilename(currentUser.id, file.name)
    const filepath = fileStorage.join(avatarDir, filename)

    const bytes = await file.arrayBuffer()
    const buffer = Buffer.from(bytes)
    await fileStorage.writeFile(filepath, buffer)

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
    if (existingUser?.avatar && existingUser.avatar.startsWith('/uploads/avatars/')) {
      try {
        const oldPath = fileStorage.join(process.cwd(), 'public', existingUser.avatar)
        await unlink(oldPath)
      } catch {
        // Ignore errors deleting old file
      }
    }

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
export async function DELETE() {
  try {
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
    if (existingUser?.avatar && existingUser.avatar.startsWith('/uploads/avatars/')) {
      try {
        const avatarPath = fileStorage.join(process.cwd(), 'public', existingUser.avatar)
        await unlink(avatarPath)
      } catch {
        // Ignore errors deleting file
      }
    }

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

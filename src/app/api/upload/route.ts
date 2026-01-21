import { NextResponse } from 'next/server'
import { logger } from '@/lib/logger'
import {
  getFileCategoryForMimeType,
  getMaxSizeForMimeType,
  getSystemSettings,
  getUploadConfig,
} from '@/lib/system-settings'
import { getFileStorage } from '@/lib/upload-storage'

function generateFilename(originalName: string): string {
  const timestamp = Date.now()
  const random = Math.random().toString(36).substring(2, 8)
  const extension = originalName.split('.').pop() || ''
  const baseName = originalName.replace(/\.[^/.]+$/, '').replace(/[^a-zA-Z0-9-_]/g, '_')
  return `${baseName}-${timestamp}-${random}.${extension}`
}

export async function POST(request: Request) {
  try {
    logger.info('File upload request received')
    const formData = await request.formData()
    const files = formData.getAll('files') as File[]

    if (!files || files.length === 0) {
      logger.warn('Upload request with no files')
      return NextResponse.json({ error: 'No files provided' }, { status: 400 })
    }

    logger.debug('Processing file upload', { fileCount: files.length })

    // Get dynamic settings from database
    const settings = await getSystemSettings()
    const allowedTypes = [
      ...settings.allowedImageTypes,
      ...settings.allowedVideoTypes,
      ...settings.allowedDocumentTypes,
    ]

    const uploadedFiles: Array<{
      id: string
      filename: string
      originalName: string
      mimetype: string
      size: number
      url: string
      category: 'image' | 'video' | 'document'
    }> = []

    // Ensure upload directory exists
    const uploadDir = getFileStorage().join(process.cwd(), 'public', 'uploads')
    await getFileStorage().ensureDirectoryExists(uploadDir)

    for (const file of files) {
      logger.debug('Validating file', { name: file.name, type: file.type, size: file.size })

      // Validate file type
      if (!allowedTypes.includes(file.type)) {
        logger.warn('File type not allowed', { name: file.name, type: file.type })
        return NextResponse.json({ error: `File type not allowed: ${file.type}` }, { status: 400 })
      }

      // Validate file size
      const maxSize = getMaxSizeForMimeType(file.type, settings)
      if (file.size > maxSize) {
        logger.warn('File too large', { name: file.name, size: file.size, maxSize })
        return NextResponse.json(
          {
            error: `File too large: ${file.name}. Maximum size is ${Math.round(maxSize / 1024 / 1024)}MB`,
          },
          { status: 400 },
        )
      }

      // Generate unique filename
      const filename = generateFilename(file.name)
      const filepath = getFileStorage().join(uploadDir, filename)

      // Write file to disk
      const bytes = await file.arrayBuffer()
      const buffer = Buffer.from(bytes)
      await getFileStorage().writeFile(filepath, buffer)

      // Add to uploaded files list
      const fileInfo = {
        id: `upload-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`,
        filename,
        originalName: file.name,
        mimetype: file.type,
        size: file.size,
        url: `/uploads/${filename}`,
        category: getFileCategoryForMimeType(file.type, settings),
      }
      uploadedFiles.push(fileInfo)
      logger.info('File uploaded successfully', {
        filename,
        originalName: file.name,
        size: file.size,
      })
    }

    logger.info('All files uploaded successfully', { count: uploadedFiles.length })
    return NextResponse.json({
      success: true,
      files: uploadedFiles,
    })
  } catch (error) {
    logger.error('Upload error', error instanceof Error ? error : new Error(String(error)), {
      message: 'Failed to upload file',
    })
    return NextResponse.json({ error: 'Failed to upload file' }, { status: 500 })
  }
}

// Return allowed types for client-side validation
export async function GET() {
  try {
    const config = await getUploadConfig()
    return NextResponse.json(config)
  } catch (error) {
    logger.error(
      'Failed to fetch upload config',
      error instanceof Error ? error : new Error(String(error)),
    )
    // Return sensible defaults if settings fetch fails
    return NextResponse.json({
      allowedTypes: [
        'image/jpeg',
        'image/png',
        'image/gif',
        'image/webp',
        'video/mp4',
        'video/webm',
        'video/ogg',
        'video/quicktime',
        'application/pdf',
        'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'application/vnd.ms-excel',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'text/plain',
        'text/csv',
      ],
      maxSizes: {
        image: 10 * 1024 * 1024,
        video: 100 * 1024 * 1024,
        document: 25 * 1024 * 1024,
      },
      maxAttachmentsPerTicket: 20,
    })
  }
}

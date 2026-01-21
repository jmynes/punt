import { fileTypeFromBuffer } from 'file-type'
import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth-helpers'
import { logger } from '@/lib/logger'
import {
  getFileCategoryForMimeType,
  getMaxSizeForMimeType,
  getSystemSettings,
  getUploadConfig,
} from '@/lib/system-settings'
import { getFileStorage } from '@/lib/upload-storage'

// Allowed extensions mapped from MIME types - prevents dual extension attacks
const SAFE_EXTENSIONS: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/gif': 'gif',
  'image/webp': 'webp',
  'video/mp4': 'mp4',
  'video/webm': 'webm',
  'video/ogg': 'ogg',
  'video/quicktime': 'mov',
  'application/pdf': 'pdf',
  'application/msword': 'doc',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
  'application/vnd.ms-excel': 'xls',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'xlsx',
  'text/plain': 'txt',
  'text/csv': 'csv',
}

function generateFilename(originalName: string, mimeType: string): string {
  const timestamp = Date.now()
  const random = Math.random().toString(36).substring(2, 8)
  // Use safe extension based on MIME type to prevent dual extension attacks (e.g., shell.php.jpg)
  const extension = SAFE_EXTENSIONS[mimeType] || 'bin'
  // Strip ALL extensions from original name and sanitize
  const baseName = originalName
    .replace(/\.[^/.]+/g, '') // Remove all extensions
    .replace(/[^a-zA-Z0-9-_]/g, '_') // Sanitize
    .substring(0, 50) // Limit length
  return `${baseName}-${timestamp}-${random}.${extension}`
}

export async function POST(request: Request) {
  try {
    await requireAuth()

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

      // Generate unique filename based on MIME type (prevents dual extension attacks)
      const filename = generateFilename(file.name, file.type)
      const filepath = getFileStorage().join(uploadDir, filename)

      // Read file contents
      const bytes = await file.arrayBuffer()
      const buffer = Buffer.from(bytes)

      // Magic byte validation - verify file content matches declared type
      const detectedType = await fileTypeFromBuffer(buffer)

      // For files that file-type can detect, verify MIME matches
      if (detectedType) {
        // Allow if detected type matches declared type OR is in allowed list
        if (detectedType.mime !== file.type && !allowedTypes.includes(detectedType.mime)) {
          logger.warn('File content does not match declared type', {
            name: file.name,
            declared: file.type,
            detected: detectedType.mime,
          })
          return NextResponse.json(
            { error: 'File content does not match declared type' },
            { status: 400 },
          )
        }
      }
      // For text files (plain text, CSV) that file-type can't detect, trust extension + MIME
      // These are already validated by the allowedTypes check above

      // Write file to disk
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
    await requireAuth()

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

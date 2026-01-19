import { NextResponse } from 'next/server'
import { FilesystemStorage } from '@/lib/file-storage'
import { logger } from '@/lib/logger'

// Use filesystem storage
const fileStorage = new FilesystemStorage()

// Allowed file types
// Note: SVG intentionally excluded due to XSS risk (embedded scripts)
const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp']
const ALLOWED_VIDEO_TYPES = ['video/mp4', 'video/webm', 'video/ogg', 'video/quicktime']
const ALLOWED_DOCUMENT_TYPES = [
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'text/plain',
  'text/csv',
]

const ALLOWED_TYPES = [...ALLOWED_IMAGE_TYPES, ...ALLOWED_VIDEO_TYPES, ...ALLOWED_DOCUMENT_TYPES]

// Max file sizes (in bytes)
const MAX_IMAGE_SIZE = 10 * 1024 * 1024 // 10MB
const MAX_VIDEO_SIZE = 100 * 1024 * 1024 // 100MB
const MAX_DOCUMENT_SIZE = 25 * 1024 * 1024 // 25MB

function getMaxSize(mimetype: string): number {
  if (ALLOWED_IMAGE_TYPES.includes(mimetype)) return MAX_IMAGE_SIZE
  if (ALLOWED_VIDEO_TYPES.includes(mimetype)) return MAX_VIDEO_SIZE
  return MAX_DOCUMENT_SIZE
}

function getFileCategory(mimetype: string): 'image' | 'video' | 'document' {
  if (ALLOWED_IMAGE_TYPES.includes(mimetype)) return 'image'
  if (ALLOWED_VIDEO_TYPES.includes(mimetype)) return 'video'
  return 'document'
}

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
    const uploadDir = fileStorage.join(process.cwd(), 'public', 'uploads')
    await fileStorage.ensureDirectoryExists(uploadDir)

    for (const file of files) {
      logger.debug('Validating file', { name: file.name, type: file.type, size: file.size })

      // Validate file type
      if (!ALLOWED_TYPES.includes(file.type)) {
        logger.warn('File type not allowed', { name: file.name, type: file.type })
        return NextResponse.json({ error: `File type not allowed: ${file.type}` }, { status: 400 })
      }

      // Validate file size
      const maxSize = getMaxSize(file.type)
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
      const filepath = fileStorage.join(uploadDir, filename)

      // Write file to disk
      const bytes = await file.arrayBuffer()
      const buffer = Buffer.from(bytes)
      await fileStorage.writeFile(filepath, buffer)

      // Add to uploaded files list
      const fileInfo = {
        id: `upload-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`,
        filename,
        originalName: file.name,
        mimetype: file.type,
        size: file.size,
        url: `/uploads/${filename}`,
        category: getFileCategory(file.type),
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
  return NextResponse.json({
    allowedTypes: ALLOWED_TYPES,
    maxSizes: {
      image: MAX_IMAGE_SIZE,
      video: MAX_VIDEO_SIZE,
      document: MAX_DOCUMENT_SIZE,
    },
  })
}

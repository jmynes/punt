'use client'

import { FileImage, FileText, FileVideo, Loader2, Upload, X } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { useUploadConfig } from '@/hooks/queries/use-attachments'
import { cn } from '@/lib/utils'

export interface UploadedFile {
  id: string
  filename: string
  originalName: string
  mimetype: string
  size: number
  url: string
  category: 'image' | 'video' | 'document'
}

interface FileUploadProps {
  value: UploadedFile[]
  onChange: (files: UploadedFile[]) => void
  maxFiles?: number
  disabled?: boolean
}

// Fallback extensions when config hasn't loaded yet
const DEFAULT_EXTENSIONS = [
  // Images
  '.jpg',
  '.jpeg',
  '.png',
  '.gif',
  '.webp',
  // Videos (SVG intentionally excluded for security)
  '.mp4',
  '.webm',
  '.ogg',
  '.mov',
  // Documents
  '.pdf',
  '.doc',
  '.docx',
  '.xls',
  '.xlsx',
  '.txt',
  '.csv',
]

// Map MIME types to extensions
function mimeTypesToExtensions(types: string[]): string[] {
  const mimeToExt: Record<string, string> = {
    'image/jpeg': '.jpg',
    'image/png': '.png',
    'image/gif': '.gif',
    'image/webp': '.webp',
    'video/mp4': '.mp4',
    'video/webm': '.webm',
    'video/ogg': '.ogg',
    'video/quicktime': '.mov',
    'application/pdf': '.pdf',
    'application/msword': '.doc',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document': '.docx',
    'application/vnd.ms-excel': '.xls',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': '.xlsx',
    'text/plain': '.txt',
    'text/csv': '.csv',
  }
  return types.map((type) => mimeToExt[type]).filter(Boolean)
}

function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 Bytes'
  const k = 1024
  const sizes = ['Bytes', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return `${Number.parseFloat((bytes / k ** i).toFixed(1))} ${sizes[i]}`
}

function getFileIcon(category: 'image' | 'video' | 'document') {
  switch (category) {
    case 'image':
      return FileImage
    case 'video':
      return FileVideo
    default:
      return FileText
  }
}

export function FileUpload({ value, onChange, maxFiles: maxFilesProp, disabled }: FileUploadProps) {
  const [isDragging, setIsDragging] = useState(false)
  const [isUploading, setIsUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Fetch dynamic upload config
  const { data: uploadConfig } = useUploadConfig()

  // Use config from server or fallback to defaults/props
  const maxFiles = maxFilesProp ?? uploadConfig?.maxAttachmentsPerTicket ?? 10
  const allowedExtensions = uploadConfig?.allowedTypes
    ? mimeTypesToExtensions(uploadConfig.allowedTypes)
    : DEFAULT_EXTENSIONS

  // Get max size for display
  const maxSizeDisplay = uploadConfig?.maxSizes
    ? Math.max(
        uploadConfig.maxSizes.image,
        uploadConfig.maxSizes.video,
        uploadConfig.maxSizes.document,
      ) /
      (1024 * 1024)
    : 100

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(true)
  }, [])

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(false)
  }, [])

  const uploadFiles = useCallback(
    async (files: FileList | File[]) => {
      if (disabled || isUploading) return

      const fileArray = Array.from(files)

      // Check max files limit
      if (value.length + fileArray.length > maxFiles) {
        setError(`Maximum ${maxFiles} files allowed`)
        return
      }

      setError(null)
      setIsUploading(true)

      try {
        const formData = new FormData()
        for (const file of fileArray) {
          formData.append('files', file)
        }

        const response = await fetch('/api/upload', {
          method: 'POST',
          body: formData,
        })

        if (!response.ok) {
          const data = await response.json()
          throw new Error(data.error || 'Upload failed')
        }

        const data = await response.json()
        onChange([...value, ...data.files])
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Upload failed')
      } finally {
        setIsUploading(false)
      }
    },
    [disabled, isUploading, maxFiles, onChange, value],
  )

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      e.stopPropagation()
      setIsDragging(false)

      const { files } = e.dataTransfer
      if (files && files.length > 0) {
        uploadFiles(files)
      }
    },
    [uploadFiles],
  )

  const handleFileSelect = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const { files } = e.target
      if (files && files.length > 0) {
        uploadFiles(files)
      }
      // Reset input so same file can be selected again
      e.target.value = ''
    },
    [uploadFiles],
  )

  const removeFile = useCallback(
    (fileId: string) => {
      onChange(value.filter((f) => f.id !== fileId))
    },
    [onChange, value],
  )

  return (
    <div className="space-y-3">
      {/* biome-ignore lint/a11y/useSemanticElements: Drop zone requires div for drag events */}
      <div
        role="region"
        aria-label="File drop zone"
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => {
          // Trigger file input when clicking anywhere on the drop zone
          if (!disabled && !isUploading) {
            fileInputRef.current?.click()
          }
        }}
        className={cn(
          'relative flex flex-col items-center justify-center rounded-lg border-2 border-dashed p-6 transition-colors cursor-pointer',
          isDragging
            ? 'border-amber-500 bg-amber-500/10'
            : 'border-zinc-700 bg-zinc-900/50 hover:border-zinc-600 hover:bg-zinc-800/30',
          disabled && 'cursor-not-allowed opacity-50',
        )}
      >
        {isUploading ? (
          <>
            <Loader2 className="h-8 w-8 animate-spin text-amber-500" />
            <p className="mt-2 text-sm text-zinc-400">Uploading...</p>
          </>
        ) : (
          <>
            <Upload className="h-8 w-8 text-zinc-500" />
            <p className="mt-2 text-sm text-zinc-400">
              Drag & drop files here, or{' '}
              <label className="cursor-pointer text-amber-500 hover:text-amber-400">
                browse
                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  accept={allowedExtensions.join(',')}
                  onChange={handleFileSelect}
                  disabled={disabled || isUploading}
                  className="sr-only"
                />
              </label>
            </p>
            <p className="mt-1 text-xs text-zinc-500">
              Images, videos, PDFs, documents up to {maxSizeDisplay}MB
            </p>
          </>
        )}
      </div>

      {/* Error message */}
      {error && <p className="text-sm text-red-400">{error}</p>}

      {/* Uploaded files list */}
      {value.length > 0 && (
        <div className="space-y-2">
          {value.map((file) => {
            const Icon = getFileIcon(file.category)
            return (
              <div
                key={file.id}
                className="flex items-center gap-3 rounded-md border border-zinc-800 bg-zinc-900 p-2"
              >
                {/* Preview for images */}
                {file.category === 'image' ? (
                  <div className="h-10 w-10 shrink-0 overflow-hidden rounded bg-zinc-800">
                    <img
                      src={file.url}
                      alt={file.originalName}
                      className="h-full w-full object-cover"
                    />
                  </div>
                ) : (
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded bg-zinc-800">
                    <Icon className="h-5 w-5 text-zinc-400" />
                  </div>
                )}

                {/* File info */}
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-zinc-200">{file.originalName}</p>
                  <p className="text-xs text-zinc-500">{formatFileSize(file.size)}</p>
                </div>

                {/* Remove button */}
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 shrink-0 text-zinc-500 hover:text-red-400"
                  onClick={() => removeFile(file.id)}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            )
          })}
        </div>
      )}

      {/* File count */}
      {value.length > 0 && (
        <p className="text-xs text-zinc-500">
          {value.length} of {maxFiles} files
        </p>
      )}
    </div>
  )
}

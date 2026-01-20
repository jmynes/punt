'use client'

import {
  closeImageDialog$,
  imageDialogState$,
  insertImage$,
  saveImage$,
  useCellValue,
  usePublisher,
} from '@mdxeditor/editor'
import { Link2, Loader2, Upload } from 'lucide-react'
import React, { useCallback, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'

export function CustomImageDialog() {
  const imageDialogState = useCellValue(imageDialogState$)
  const closeDialog = usePublisher(closeImageDialog$)
  const insertImage = usePublisher(insertImage$)
  const saveImage = usePublisher(saveImage$)

  const [src, setSrc] = useState('')
  const [alt, setAlt] = useState('')
  const [title, setTitle] = useState('')
  const [isUploading, setIsUploading] = useState(false)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const isOpen = imageDialogState.type !== 'inactive'
  const isEditing = imageDialogState.type === 'editing'

  // Initialize form when dialog opens
  React.useEffect(() => {
    if (isOpen) {
      if (isEditing && imageDialogState.type === 'editing') {
        const initial = imageDialogState.initialValues
        setSrc(initial.src || '')
        setAlt(initial.altText || '')
        setTitle(initial.title || '')
      } else {
        setSrc('')
        setAlt('')
        setTitle('')
      }
      setUploadError(null)
    }
  }, [isOpen, isEditing, imageDialogState])

  const handleFileSelect = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    // Validate file type
    if (!file.type.startsWith('image/')) {
      setUploadError('Please select an image file')
      return
    }

    // Validate file size (10MB max)
    if (file.size > 10 * 1024 * 1024) {
      setUploadError('Image must be less than 10MB')
      return
    }

    setIsUploading(true)
    setUploadError(null)

    try {
      const formData = new FormData()
      formData.append('files', file)

      const response = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Upload failed')
      }

      const data = await response.json()
      const uploadedFile = data.files[0]

      setSrc(uploadedFile.url)
      setIsUploading(false)
    } catch (error) {
      setUploadError(error instanceof Error ? error.message : 'Upload failed')
      setIsUploading(false)
    }

    // Reset input
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }, [])

  const handleSubmit = useCallback(() => {
    if (!src.trim()) {
      setUploadError('Please provide an image URL or upload a file')
      return
    }

    const imageParams = {
      src: src.trim(),
      altText: alt.trim() || undefined,
      title: title.trim() || undefined,
    }

    if (isEditing && imageDialogState.type === 'editing') {
      saveImage(imageParams)
    } else {
      insertImage(imageParams)
    }

    closeDialog()
  }, [src, alt, title, isEditing, imageDialogState, insertImage, saveImage, closeDialog])

  const handleClose = useCallback(() => {
    closeDialog()
    setSrc('')
    setAlt('')
    setTitle('')
    setUploadError(null)
  }, [closeDialog])

  if (!isOpen) return null

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-md bg-zinc-900 border-zinc-700">
        <DialogHeader>
          <DialogTitle className="text-zinc-100">
            {isEditing ? 'Edit Image' : 'Insert Image'}
          </DialogTitle>
          <DialogDescription className="text-zinc-400">
            {isEditing ? 'Update the image properties' : 'Upload an image or provide an image URL'}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Upload Section */}
          <div className="space-y-2">
            <Label htmlFor="image-upload" className="text-zinc-300">
              Upload Image
            </Label>
            <div
              onClick={() => !isUploading && fileInputRef.current?.click()}
              onKeyDown={(e) => {
                if ((e.key === 'Enter' || e.key === ' ') && !isUploading) {
                  e.preventDefault()
                  fileInputRef.current?.click()
                }
              }}
              role="button"
              tabIndex={0}
              className={cn(
                'relative flex flex-col items-center justify-center rounded-lg border-2 border-dashed p-6 transition-colors cursor-pointer',
                isUploading
                  ? 'border-amber-500 bg-amber-500/10 cursor-wait'
                  : 'border-zinc-700 bg-zinc-800/50 hover:border-amber-500 hover:bg-amber-500/5',
              )}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleFileSelect}
                disabled={isUploading}
                className="sr-only"
                id="image-upload"
              />
              {isUploading ? (
                <>
                  <Loader2 className="h-8 w-8 animate-spin text-amber-500" />
                  <p className="mt-2 text-sm text-zinc-400">Uploading...</p>
                </>
              ) : (
                <>
                  <Upload className="h-8 w-8 text-zinc-500" />
                  <p className="mt-2 text-sm text-zinc-400">
                    Click to upload or{' '}
                    <span className="text-amber-500 hover:text-amber-400">browse</span>
                  </p>
                  <p className="mt-1 text-xs text-zinc-500">PNG, JPG, GIF up to 10MB</p>
                </>
              )}
            </div>
          </div>

          {/* Divider */}
          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t border-zinc-700" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-zinc-900 px-2 text-zinc-500">Or</span>
            </div>
          </div>

          {/* URL Input */}
          <div className="space-y-2">
            <Label htmlFor="image-url" className="text-zinc-300">
              Image URL
            </Label>
            <div className="relative">
              <Link2 className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-500" />
              <Input
                id="image-url"
                type="url"
                value={src}
                onChange={(e) => setSrc(e.target.value)}
                placeholder="https://example.com/image.jpg"
                className="pl-9 bg-zinc-800 border-zinc-700 text-zinc-100 focus:border-amber-500"
              />
            </div>
          </div>

          {/* Alt Text */}
          <div className="space-y-2">
            <Label htmlFor="image-alt" className="text-zinc-300">
              Alt Text <span className="text-zinc-500 text-xs">(optional)</span>
            </Label>
            <Input
              id="image-alt"
              type="text"
              value={alt}
              onChange={(e) => setAlt(e.target.value)}
              placeholder="Describe the image for accessibility"
              className="bg-zinc-800 border-zinc-700 text-zinc-100 focus:border-amber-500"
            />
          </div>

          {/* Title */}
          <div className="space-y-2">
            <Label htmlFor="image-title" className="text-zinc-300">
              Title <span className="text-zinc-500 text-xs">(optional)</span>
            </Label>
            <Input
              id="image-title"
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Image title"
              className="bg-zinc-800 border-zinc-700 text-zinc-100 focus:border-amber-500"
            />
          </div>

          {/* Error Message */}
          {uploadError && (
            <div className="rounded-md bg-red-900/20 border border-red-800/50 p-3">
              <p className="text-sm text-red-400">{uploadError}</p>
            </div>
          )}

          {/* Preview */}
          {src && !uploadError && (
            <div className="space-y-2">
              <Label className="text-zinc-300">Preview</Label>
              <div className="rounded-lg border border-zinc-700 bg-zinc-800 p-4 flex items-center justify-center">
                <img
                  src={src}
                  alt={alt || 'Preview'}
                  className="max-h-48 max-w-full rounded object-contain"
                  onError={() => setUploadError('Invalid image URL')}
                />
              </div>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-2 pt-4 border-t border-zinc-800">
          <Button
            variant="outline"
            onClick={handleClose}
            className="border-zinc-700 text-zinc-300 hover:bg-zinc-800"
          >
            Cancel
          </Button>
          <Button onClick={handleSubmit} variant="primary" disabled={!src.trim() || isUploading}>
            {isEditing ? 'Update' : 'Insert'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

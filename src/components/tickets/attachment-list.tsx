'use client'

import {
  Download,
  ExternalLink,
  Eye,
  FileImage,
  FileText,
  FileVideo,
  MoreHorizontal,
  Trash2,
} from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { AttachmentPreviewModal } from './attachment-preview-modal'
import type { UploadedFile } from './file-upload'

interface AttachmentListProps {
  attachments: UploadedFile[]
  onRemove?: (fileId: string) => void
  readonly?: boolean
  layout?: 'list' | 'grid'
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

// Check if a file can be previewed in the modal
function canPreview(file: UploadedFile): boolean {
  return (
    file.category === 'image' || file.category === 'video' || file.mimetype === 'application/pdf'
  )
}

export function AttachmentList({
  attachments,
  onRemove,
  readonly = false,
  layout = 'list',
}: AttachmentListProps) {
  const [previewFile, setPreviewFile] = useState<UploadedFile | null>(null)
  const [fileToDelete, setFileToDelete] = useState<UploadedFile | null>(null)
  const deleteButtonRef = useRef<HTMLButtonElement>(null)

  if (attachments.length === 0) {
    return null
  }

  const handleConfirmDelete = () => {
    if (fileToDelete && onRemove) {
      onRemove(fileToDelete.id)
    }
    setFileToDelete(null)
  }

  const handleDownload = (file: UploadedFile) => {
    const link = document.createElement('a')
    link.href = file.url
    link.download = file.originalName
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  const handleOpenExternal = (file: UploadedFile) => {
    window.open(file.url, '_blank')
  }

  const handlePreview = (file: UploadedFile) => {
    if (canPreview(file)) {
      setPreviewFile(file)
    } else {
      handleOpenExternal(file)
    }
  }

  if (layout === 'grid') {
    return (
      <>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4">
          {attachments.map((file) => {
            const Icon = getFileIcon(file.category)
            const isPdf = file.mimetype === 'application/pdf'
            return (
              <div
                key={file.id}
                className="group relative aspect-square overflow-hidden rounded-lg border border-zinc-800 bg-zinc-900"
              >
                {file.category === 'image' ? (
                  <img
                    src={file.url}
                    alt={file.originalName}
                    className="h-full w-full cursor-pointer object-cover transition-transform group-hover:scale-105"
                    onClick={() => handlePreview(file)}
                  />
                ) : file.category === 'video' ? (
                  <video
                    src={file.url}
                    className="h-full w-full cursor-pointer object-cover"
                    onClick={() => handlePreview(file)}
                  >
                    <track kind="captions" />
                  </video>
                ) : (
                  <button
                    type="button"
                    className="flex h-full w-full cursor-pointer flex-col items-center justify-center p-4"
                    onClick={() => handlePreview(file)}
                  >
                    <Icon className="h-8 w-8 text-zinc-500" />
                    <p className="mt-2 truncate text-xs text-zinc-400">{file.originalName}</p>
                    {isPdf && <span className="mt-1 text-xs text-amber-500">Click to preview</span>}
                  </button>
                )}

                {/* Overlay actions */}
                <div className="absolute inset-0 flex items-center justify-center gap-1 bg-black/60 opacity-0 transition-opacity group-hover:opacity-100">
                  {canPreview(file) && (
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-8 w-8 text-white hover:bg-white/20"
                      onClick={() => handlePreview(file)}
                      title="Preview"
                    >
                      <Eye className="h-4 w-4" />
                    </Button>
                  )}
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-8 w-8 text-white hover:bg-white/20"
                    onClick={() => handleDownload(file)}
                    title="Download"
                  >
                    <Download className="h-4 w-4" />
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-8 w-8 text-white hover:bg-white/20"
                    onClick={() => handleOpenExternal(file)}
                    title="Open in new tab"
                  >
                    <ExternalLink className="h-4 w-4" />
                  </Button>
                  {!readonly && onRemove && (
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-8 w-8 text-white hover:bg-red-500/50"
                      onClick={() => setFileToDelete(file)}
                      title="Remove"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </div>
            )
          })}
        </div>

        {/* Enhanced Preview Modal */}
        <AttachmentPreviewModal
          file={previewFile}
          files={attachments}
          onClose={() => setPreviewFile(null)}
          onNavigate={setPreviewFile}
          onDelete={
            onRemove
              ? (file) => {
                  setFileToDelete(file)
                  setPreviewFile(null)
                }
              : undefined
          }
        />

        {/* Delete Confirmation Dialog */}
        <AlertDialog open={!!fileToDelete} onOpenChange={(open) => !open && setFileToDelete(null)}>
          <AlertDialogContent
            className="bg-zinc-900 border-zinc-800"
            onOpenAutoFocus={(e) => {
              e.preventDefault()
              deleteButtonRef.current?.focus()
            }}
          >
            <AlertDialogHeader>
              <AlertDialogTitle>Delete Attachment</AlertDialogTitle>
              <AlertDialogDescription className="text-zinc-400">
                Are you sure you want to delete{' '}
                <span className="font-medium text-zinc-200">{fileToDelete?.originalName}</span>?
                This action can be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel className="bg-zinc-800 border-zinc-700 hover:bg-zinc-700">
                Cancel
              </AlertDialogCancel>
              <AlertDialogAction
                ref={deleteButtonRef}
                onClick={handleConfirmDelete}
                className="bg-red-600 hover:bg-red-700 text-white"
              >
                Delete
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </>
    )
  }

  // List layout
  return (
    <>
      <div className="space-y-2">
        {attachments.map((file) => {
          const Icon = getFileIcon(file.category)
          const isPdf = file.mimetype === 'application/pdf'
          return (
            <div
              key={file.id}
              className="flex items-center gap-3 rounded-md border border-zinc-800 bg-zinc-900 p-2"
            >
              {/* Preview thumbnail */}
              {file.category === 'image' ? (
                <button
                  type="button"
                  className="h-12 w-12 shrink-0 cursor-pointer overflow-hidden rounded bg-zinc-800"
                  onClick={() => handlePreview(file)}
                >
                  <img
                    src={file.url}
                    alt={file.originalName}
                    className="h-full w-full object-cover"
                  />
                </button>
              ) : file.category === 'video' ? (
                <button
                  type="button"
                  className="relative h-12 w-12 shrink-0 cursor-pointer overflow-hidden rounded bg-zinc-800"
                  onClick={() => handlePreview(file)}
                >
                  <video src={file.url} className="h-full w-full object-cover">
                    <track kind="captions" />
                  </video>
                  <div className="absolute inset-0 flex items-center justify-center bg-black/30">
                    <FileVideo className="h-5 w-5 text-white" />
                  </div>
                </button>
              ) : (
                <button
                  type="button"
                  className="flex h-12 w-12 shrink-0 items-center justify-center rounded bg-zinc-800 cursor-pointer hover:bg-zinc-700 transition-colors"
                  onClick={() => handlePreview(file)}
                  title={isPdf ? 'Click to preview PDF' : 'Open file'}
                >
                  <Icon className="h-6 w-6 text-zinc-400" />
                </button>
              )}

              {/* File info */}
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-zinc-200">{file.originalName}</p>
                <p className="text-xs text-zinc-500">{formatFileSize(file.size)}</p>
              </div>

              {/* Actions */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0">
                    <MoreHorizontal className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="bg-zinc-900 border-zinc-800">
                  {canPreview(file) && (
                    <DropdownMenuItem
                      onClick={() => handlePreview(file)}
                      className="cursor-pointer"
                    >
                      <Eye className="mr-2 h-4 w-4" />
                      Preview
                    </DropdownMenuItem>
                  )}
                  <DropdownMenuItem onClick={() => handleDownload(file)} className="cursor-pointer">
                    <Download className="mr-2 h-4 w-4" />
                    Download
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => handleOpenExternal(file)}
                    className="cursor-pointer"
                  >
                    <ExternalLink className="mr-2 h-4 w-4" />
                    Open in new tab
                  </DropdownMenuItem>
                  {!readonly && onRemove && (
                    <DropdownMenuItem
                      onClick={() => setFileToDelete(file)}
                      className="cursor-pointer text-red-400 focus:text-red-400"
                    >
                      <Trash2 className="mr-2 h-4 w-4" />
                      Remove
                    </DropdownMenuItem>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          )
        })}
      </div>

      {/* Enhanced Preview Modal */}
      <AttachmentPreviewModal
        file={previewFile}
        files={attachments}
        onClose={() => setPreviewFile(null)}
        onNavigate={setPreviewFile}
        onDelete={
          onRemove
            ? (file) => {
                setFileToDelete(file)
                setPreviewFile(null)
              }
            : undefined
        }
      />

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!fileToDelete} onOpenChange={(open) => !open && setFileToDelete(null)}>
        <AlertDialogContent
          className="bg-zinc-900 border-zinc-800"
          onOpenAutoFocus={(e) => {
            e.preventDefault()
            deleteButtonRef.current?.focus()
          }}
        >
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Attachment</AlertDialogTitle>
            <AlertDialogDescription className="text-zinc-400">
              Are you sure you want to delete{' '}
              <span className="font-medium text-zinc-200">{fileToDelete?.originalName}</span>? This
              action can be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="bg-zinc-800 border-zinc-700 hover:bg-zinc-700">
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              ref={deleteButtonRef}
              onClick={handleConfirmDelete}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}

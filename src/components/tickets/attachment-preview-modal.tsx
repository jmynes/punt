'use client'

import {
  ChevronLeft,
  ChevronRight,
  Download,
  ExternalLink,
  FileText,
  Maximize2,
  Minimize2,
  RotateCcw,
  Trash2,
  X,
  ZoomIn,
  ZoomOut,
} from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { cn } from '@/lib/utils'
import type { UploadedFile } from './file-upload'

interface AttachmentPreviewModalProps {
  file: UploadedFile | null
  files?: UploadedFile[]
  onClose: () => void
  onNavigate?: (file: UploadedFile) => void
  onDelete?: (file: UploadedFile) => void
}

const MIN_ZOOM = 0.25
const MAX_ZOOM = 4
const ZOOM_STEP = 0.25

export function AttachmentPreviewModal({
  file,
  files = [],
  onClose,
  onNavigate,
  onDelete,
}: AttachmentPreviewModalProps) {
  const [zoom, setZoom] = useState(1)
  const [position, setPosition] = useState({ x: 0, y: 0 })
  const [isDragging, setIsDragging] = useState(false)
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 })
  const [isFullscreen, setIsFullscreen] = useState(false)

  // Find current index for navigation
  const fileId = file?.id
  const currentIndex = files.findIndex((f) => f.id === fileId)
  const hasPrevious = currentIndex > 0
  const hasNext = currentIndex < files.length - 1

  // Reset zoom and position when file changes
  useEffect(() => {
    if (fileId) {
      setZoom(1)
      setPosition({ x: 0, y: 0 })
    }
  }, [fileId])

  const handleZoomIn = useCallback(() => {
    setZoom((z) => Math.min(z + ZOOM_STEP, MAX_ZOOM))
  }, [])

  const handleZoomOut = useCallback(() => {
    setZoom((z) => Math.max(z - ZOOM_STEP, MIN_ZOOM))
  }, [])

  const handleResetZoom = useCallback(() => {
    setZoom(1)
    setPosition({ x: 0, y: 0 })
  }, [])

  const handleDownload = useCallback(() => {
    if (!file) return
    const link = document.createElement('a')
    link.href = file.url
    link.download = file.originalName
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }, [file])

  const handleOpenExternal = useCallback(() => {
    if (!file) return
    window.open(file.url, '_blank')
  }, [file])

  const handlePrevious = useCallback(() => {
    if (hasPrevious && onNavigate) {
      onNavigate(files[currentIndex - 1])
    }
  }, [hasPrevious, onNavigate, files, currentIndex])

  const handleNext = useCallback(() => {
    if (hasNext && onNavigate) {
      onNavigate(files[currentIndex + 1])
    }
  }, [hasNext, onNavigate, files, currentIndex])

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      if (zoom > 1 && file?.category === 'image') {
        setIsDragging(true)
        setDragStart({ x: e.clientX - position.x, y: e.clientY - position.y })
      }
    },
    [zoom, position, file?.category],
  )

  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (isDragging) {
        setPosition({
          x: e.clientX - dragStart.x,
          y: e.clientY - dragStart.y,
        })
      }
    },
    [isDragging, dragStart],
  )

  const handleMouseUp = useCallback(() => {
    setIsDragging(false)
  }, [])

  const handleWheel = useCallback(
    (e: React.WheelEvent) => {
      if (file?.category === 'image') {
        e.preventDefault()
        const delta = e.deltaY > 0 ? -ZOOM_STEP : ZOOM_STEP
        setZoom((z) => Math.min(Math.max(z + delta, MIN_ZOOM), MAX_ZOOM))
      }
    },
    [file?.category],
  )

  // Keyboard navigation
  useEffect(() => {
    if (!file) return

    const handleKeyDown = (e: KeyboardEvent) => {
      switch (e.key) {
        case 'ArrowLeft':
          handlePrevious()
          break
        case 'ArrowRight':
          handleNext()
          break
        case 'Escape':
          onClose()
          break
        case '+':
        case '=':
          handleZoomIn()
          break
        case '-':
          handleZoomOut()
          break
        case '0':
          handleResetZoom()
          break
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [file, handlePrevious, handleNext, onClose, handleZoomIn, handleZoomOut, handleResetZoom])

  const toggleFullscreen = useCallback(() => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen()
      setIsFullscreen(true)
    } else {
      document.exitFullscreen()
      setIsFullscreen(false)
    }
  }, [])

  // Listen for fullscreen changes
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement)
    }
    document.addEventListener('fullscreenchange', handleFullscreenChange)
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange)
  }, [])

  if (!file) return null

  const isPdf = file.mimetype === 'application/pdf'
  const isImage = file.category === 'image'
  const isVideo = file.category === 'video'

  return (
    <Dialog open={!!file} onOpenChange={(open) => !open && onClose()} modal={false}>
      <DialogContent
        className="max-w-[90vw] sm:max-w-[90vw] w-full h-[90vh] border-zinc-800 bg-zinc-950 p-0 flex flex-col"
        showCloseButton={false}
      >
        <DialogHeader className="sr-only">
          <DialogTitle>{file.originalName}</DialogTitle>
          <DialogDescription>File preview</DialogDescription>
        </DialogHeader>

        {/* Toolbar */}
        <div className="flex items-center justify-between border-b border-zinc-800 px-4 py-2 bg-zinc-900/80 flex-shrink-0">
          <div className="flex items-center gap-2 min-w-0">
            <span className="text-sm font-medium text-zinc-200 truncate max-w-[50vw]">
              {file.originalName}
            </span>
            {files.length > 1 && (
              <span className="text-xs text-zinc-500">
                ({currentIndex + 1} / {files.length})
              </span>
            )}
          </div>

          <div className="flex items-center gap-1">
            {/* Zoom controls for images */}
            {isImage && (
              <>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-zinc-400 hover:text-zinc-200"
                  onClick={handleZoomOut}
                  disabled={zoom <= MIN_ZOOM}
                  title="Zoom out (-)"
                >
                  <ZoomOut className="h-4 w-4" />
                </Button>
                <span className="text-xs text-zinc-400 w-12 text-center">
                  {Math.round(zoom * 100)}%
                </span>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-zinc-400 hover:text-zinc-200"
                  onClick={handleZoomIn}
                  disabled={zoom >= MAX_ZOOM}
                  title="Zoom in (+)"
                >
                  <ZoomIn className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-zinc-400 hover:text-zinc-200"
                  onClick={handleResetZoom}
                  title="Reset zoom (0)"
                >
                  <RotateCcw className="h-4 w-4" />
                </Button>
                <div className="w-px h-4 bg-zinc-700 mx-1" />
              </>
            )}

            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-zinc-400 hover:text-zinc-200"
              onClick={handleDownload}
              title="Download"
            >
              <Download className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-zinc-400 hover:text-zinc-200"
              onClick={handleOpenExternal}
              title="Open in new tab"
            >
              <ExternalLink className="h-4 w-4" />
            </Button>
            {onDelete && file && (
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-zinc-400 hover:text-red-400"
                onClick={() => onDelete(file)}
                title="Delete"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            )}
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-zinc-400 hover:text-zinc-200"
              onClick={toggleFullscreen}
              title={isFullscreen ? 'Exit fullscreen' : 'Fullscreen'}
            >
              {isFullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
            </Button>
            <div className="w-px h-4 bg-zinc-700 mx-1" />
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-zinc-400 hover:text-red-400"
              onClick={onClose}
              title="Close (Esc)"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Content area */}
        <div
          className="flex-1 flex items-center justify-center overflow-hidden relative bg-zinc-950/50"
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
          onWheel={handleWheel}
        >
          {/* Navigation arrows */}
          {files.length > 1 && (
            <>
              <Button
                variant="ghost"
                size="icon"
                className={cn(
                  'absolute left-4 z-10 h-10 w-10 rounded-full bg-zinc-900/80 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800',
                  !hasPrevious && 'opacity-50 cursor-not-allowed',
                )}
                onClick={handlePrevious}
                disabled={!hasPrevious}
                title="Previous (Left arrow)"
              >
                <ChevronLeft className="h-6 w-6" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className={cn(
                  'absolute right-4 z-10 h-10 w-10 rounded-full bg-zinc-900/80 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800',
                  !hasNext && 'opacity-50 cursor-not-allowed',
                )}
                onClick={handleNext}
                disabled={!hasNext}
                title="Next (Right arrow)"
              >
                <ChevronRight className="h-6 w-6" />
              </Button>
            </>
          )}

          {/* Image preview with zoom */}
          {isImage && (
            <div
              className={cn(
                'relative transition-transform duration-100',
                zoom > 1 ? 'cursor-grab' : 'cursor-zoom-in',
                isDragging && 'cursor-grabbing',
              )}
              style={{
                transform: `scale(${zoom}) translate(${position.x / zoom}px, ${position.y / zoom}px)`,
              }}
              onDoubleClick={() => {
                if (zoom === 1) {
                  setZoom(2)
                } else {
                  handleResetZoom()
                }
              }}
            >
              <img
                src={file.url}
                alt={file.originalName}
                className="max-h-[calc(90vh-60px)] max-w-full object-contain select-none"
                draggable={false}
              />
            </div>
          )}

          {/* Video preview */}
          {isVideo && (
            <video src={file.url} controls autoPlay className="max-h-[calc(90vh-60px)] max-w-full">
              <track kind="captions" />
            </video>
          )}

          {/* PDF preview */}
          {isPdf && (
            <object
              data={file.url}
              type="application/pdf"
              className="w-full h-full"
              title={file.originalName}
            >
              {/* Fallback for browsers that can't display PDF inline */}
              <div className="flex flex-col items-center justify-center h-full gap-4 p-8">
                <FileText className="h-16 w-16 text-zinc-500" />
                <p className="text-zinc-400 text-center">
                  PDF preview not available in this browser.
                </p>
                <div className="flex gap-2">
                  <Button variant="outline" onClick={handleDownload}>
                    <Download className="h-4 w-4 mr-2" />
                    Download PDF
                  </Button>
                  <Button variant="outline" onClick={handleOpenExternal}>
                    <ExternalLink className="h-4 w-4 mr-2" />
                    Open in new tab
                  </Button>
                </div>
              </div>
            </object>
          )}

          {/* Document fallback */}
          {!isImage && !isVideo && !isPdf && (
            <div className="flex flex-col items-center justify-center gap-4 p-8">
              <FileText className="h-16 w-16 text-zinc-500" />
              <p className="text-zinc-400 text-center">Preview not available for this file type.</p>
              <div className="flex gap-2">
                <Button variant="outline" onClick={handleDownload}>
                  <Download className="h-4 w-4 mr-2" />
                  Download
                </Button>
                <Button variant="outline" onClick={handleOpenExternal}>
                  <ExternalLink className="h-4 w-4 mr-2" />
                  Open in new tab
                </Button>
              </div>
            </div>
          )}
        </div>

        {/* Keyboard shortcuts hint */}
        <div className="flex items-center justify-center gap-4 py-2 text-xs text-zinc-500 bg-zinc-900/50 border-t border-zinc-800 flex-shrink-0">
          {isImage && (
            <>
              <span>Scroll to zoom</span>
              <span className="text-zinc-700">|</span>
              <span>Double-click to toggle zoom</span>
              <span className="text-zinc-700">|</span>
            </>
          )}
          {files.length > 1 && (
            <>
              <span>Arrow keys to navigate</span>
              <span className="text-zinc-700">|</span>
            </>
          )}
          <span>Esc to close</span>
        </div>
      </DialogContent>
    </Dialog>
  )
}

'use client'

import { ZoomIn, ZoomOut } from 'lucide-react'
import { memo, useCallback, useRef, useState } from 'react'
import type { Area, Point } from 'react-easy-crop'
import Cropper from 'react-easy-crop'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

interface ImageCropDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  imageSrc: string
  onCropComplete: (croppedBlob: Blob) => void
}

// Max size for the image in the cropper - larger images are resized down
const MAX_CROPPER_SIZE = 800

async function getCroppedImg(imageSrc: string, pixelCrop: Area): Promise<Blob> {
  const image = new Image()
  image.src = imageSrc
  await new Promise((resolve) => {
    image.onload = resolve
  })

  const canvas = document.createElement('canvas')
  const ctx = canvas.getContext('2d')
  if (!ctx) {
    throw new Error('Could not get canvas context')
  }

  canvas.width = pixelCrop.width
  canvas.height = pixelCrop.height

  ctx.drawImage(
    image,
    pixelCrop.x,
    pixelCrop.y,
    pixelCrop.width,
    pixelCrop.height,
    0,
    0,
    pixelCrop.width,
    pixelCrop.height,
  )

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) {
          resolve(blob)
        } else {
          reject(new Error('Failed to create blob'))
        }
      },
      'image/jpeg',
      0.9,
    )
  })
}

// Resize image to max dimensions before cropping for better performance
export function resizeImageForCropper(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    const url = URL.createObjectURL(file)

    img.onload = () => {
      URL.revokeObjectURL(url)

      // If image is small enough, just return as data URL
      if (img.width <= MAX_CROPPER_SIZE && img.height <= MAX_CROPPER_SIZE) {
        const canvas = document.createElement('canvas')
        canvas.width = img.width
        canvas.height = img.height
        const ctx = canvas.getContext('2d')
        if (!ctx) {
          reject(new Error('Could not get canvas context'))
          return
        }
        ctx.drawImage(img, 0, 0)
        resolve(canvas.toDataURL('image/jpeg', 0.9))
        return
      }

      // Calculate new dimensions maintaining aspect ratio
      let newWidth = img.width
      let newHeight = img.height

      if (newWidth > newHeight) {
        if (newWidth > MAX_CROPPER_SIZE) {
          newHeight = (newHeight * MAX_CROPPER_SIZE) / newWidth
          newWidth = MAX_CROPPER_SIZE
        }
      } else {
        if (newHeight > MAX_CROPPER_SIZE) {
          newWidth = (newWidth * MAX_CROPPER_SIZE) / newHeight
          newHeight = MAX_CROPPER_SIZE
        }
      }

      const canvas = document.createElement('canvas')
      canvas.width = newWidth
      canvas.height = newHeight
      const ctx = canvas.getContext('2d')
      if (!ctx) {
        reject(new Error('Could not get canvas context'))
        return
      }

      ctx.drawImage(img, 0, 0, newWidth, newHeight)
      resolve(canvas.toDataURL('image/jpeg', 0.9))
    }

    img.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error('Failed to load image'))
    }

    img.src = url
  })
}

// Memoized cropper to prevent re-renders from parent state changes
const MemoizedCropper = memo(function MemoizedCropper({
  image,
  crop,
  zoom,
  onCropChange,
  onZoomChange,
  onCropComplete,
}: {
  image: string
  crop: Point
  zoom: number
  onCropChange: (location: Point) => void
  onZoomChange: (zoom: number) => void
  onCropComplete: (croppedArea: Area, croppedAreaPixels: Area) => void
}) {
  return (
    <Cropper
      image={image}
      crop={crop}
      zoom={zoom}
      aspect={1}
      cropShape="round"
      showGrid={false}
      onCropChange={onCropChange}
      onZoomChange={onZoomChange}
      onCropComplete={onCropComplete}
    />
  )
})

export function ImageCropDialog({
  open,
  onOpenChange,
  imageSrc,
  onCropComplete,
}: ImageCropDialogProps) {
  const [crop, setCrop] = useState<Point>({ x: 0, y: 0 })
  const [zoom, setZoom] = useState(1)
  const [isSaving, setIsSaving] = useState(false)

  // Use ref for croppedAreaPixels to avoid re-renders on every crop change
  const croppedAreaPixelsRef = useRef<Area | null>(null)

  const onCropChange = useCallback((location: Point) => {
    setCrop(location)
  }, [])

  const onZoomChange = useCallback((newZoom: number) => {
    setZoom(newZoom)
  }, [])

  // Store in ref instead of state - no re-render needed
  const onCropAreaChange = useCallback((_croppedArea: Area, croppedAreaPixels: Area) => {
    croppedAreaPixelsRef.current = croppedAreaPixels
  }, [])

  const handleZoomSlider = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setZoom(Number(e.target.value))
  }, [])

  const handleSave = useCallback(async () => {
    if (!croppedAreaPixelsRef.current) return

    setIsSaving(true)
    try {
      const croppedBlob = await getCroppedImg(imageSrc, croppedAreaPixelsRef.current)
      onCropComplete(croppedBlob)
      onOpenChange(false)
    } catch (error) {
      console.error('Failed to crop image:', error)
    } finally {
      setIsSaving(false)
    }
  }, [imageSrc, onCropComplete, onOpenChange])

  const handleCancel = useCallback(() => {
    onOpenChange(false)
  }, [onOpenChange])

  const handleOpenChange = useCallback(
    (newOpen: boolean) => {
      if (newOpen) {
        setCrop({ x: 0, y: 0 })
        setZoom(1)
        croppedAreaPixelsRef.current = null
      }
      onOpenChange(newOpen)
    },
    [onOpenChange],
  )

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md bg-zinc-900 border-zinc-800">
        <DialogHeader>
          <DialogTitle className="text-zinc-100">Crop Image</DialogTitle>
          <DialogDescription className="text-zinc-400">
            Drag to reposition and use the slider to zoom
          </DialogDescription>
        </DialogHeader>

        <div className="relative w-full h-64 bg-zinc-950 rounded-lg overflow-hidden">
          <MemoizedCropper
            image={imageSrc}
            crop={crop}
            zoom={zoom}
            onCropChange={onCropChange}
            onZoomChange={onZoomChange}
            onCropComplete={onCropAreaChange}
          />
        </div>

        <div className="flex items-center gap-3 px-2">
          <ZoomOut className="h-4 w-4 text-zinc-500 shrink-0" />
          <input
            type="range"
            min={1}
            max={3}
            step={0.1}
            value={zoom}
            onChange={handleZoomSlider}
            className="w-full h-2 bg-zinc-700 rounded-lg appearance-none cursor-pointer accent-amber-500"
          />
          <ZoomIn className="h-4 w-4 text-zinc-500 shrink-0" />
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={handleCancel}
            disabled={isSaving}
            className="border-zinc-700 hover:bg-zinc-800"
          >
            Cancel
          </Button>
          <Button variant="primary" onClick={handleSave} disabled={isSaving}>
            {isSaving ? 'Saving...' : 'Save'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

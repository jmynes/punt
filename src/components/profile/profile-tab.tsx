'use client'

import { Camera, Palette, Shield, User } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import { ImageCropDialog, resizeImageForCropper } from '@/components/profile/image-crop-dialog'
import { ColorPickerBody } from '@/components/tickets/label-select'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { getTabId } from '@/hooks/use-realtime'
import { getAvatarColor, getInitials } from '@/lib/utils'

interface UserData {
  id: string
  name: string
  email: string | null
  avatar: string | null
  avatarColor: string | null
  isSystemAdmin: boolean
}

interface ProfileTabProps {
  user: UserData
  isDemo: boolean
  onUserUpdate: (updates: Partial<UserData>) => void
  onSessionUpdate: () => Promise<void>
}

export function ProfileTab({
  user,
  isDemo: _isDemo,
  onUserUpdate,
  onSessionUpdate,
}: ProfileTabProps) {
  // Profile form state
  const [name, setName] = useState(user.name)
  const [profileLoading, setProfileLoading] = useState(false)

  // Sync name input with user when it changes (from SSE), but only if not editing
  const nameInputRef = useRef<HTMLInputElement>(null)
  useEffect(() => {
    if (user.name && !profileLoading && document.activeElement !== nameInputRef.current) {
      setName(user.name)
    }
  }, [user.name, profileLoading])

  // Avatar state
  const [avatarLoading, setAvatarLoading] = useState(false)
  const [optimisticAvatar, setOptimisticAvatar] = useState<string | null | 'pending'>(null)
  const blobUrlRef = useRef<string | null>(null)

  // Crop dialog state
  const [cropDialogOpen, setCropDialogOpen] = useState(false)
  const [selectedImageSrc, setSelectedImageSrc] = useState<string | null>(null)
  const selectedFileRef = useRef<File | null>(null)

  // Avatar color state
  const [avatarColorLoading, setAvatarColorLoading] = useState(false)
  const [customAvatarColor, setCustomAvatarColor] = useState('')

  // Cleanup blob URLs on unmount
  useEffect(() => {
    return () => {
      if (blobUrlRef.current) {
        URL.revokeObjectURL(blobUrlRef.current)
      }
    }
  }, [])

  // Determine which avatar to display
  const getDisplayAvatar = useCallback((): string | null => {
    if (avatarLoading && optimisticAvatar === 'pending') {
      return null
    }
    if (optimisticAvatar && optimisticAvatar !== 'pending') {
      return optimisticAvatar
    }
    return user.avatar ?? null
  }, [avatarLoading, optimisticAvatar, user.avatar])

  const displayAvatar = getDisplayAvatar()
  const displayName = name || user.name || ''

  const handleProfileUpdate = async (e: React.FormEvent) => {
    e.preventDefault()
    setProfileLoading(true)

    try {
      const res = await fetch('/api/me', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'x-tab-id': getTabId(),
        },
        body: JSON.stringify({ name }),
      })

      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error || 'Failed to update profile')
      }

      onUserUpdate({ name })
      await onSessionUpdate()
      toast.success('Display name updated')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to update profile')
    } finally {
      setProfileLoading(false)
    }
  }

  const handleAvatarSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    e.target.value = ''
    selectedFileRef.current = file

    try {
      const resizedImageSrc = await resizeImageForCropper(file)
      setSelectedImageSrc(resizedImageSrc)
      setCropDialogOpen(true)
    } catch (error) {
      console.error('Failed to load image:', error)
      toast.error('Failed to load image')
    }
  }

  const handleCroppedImage = async (croppedBlob: Blob) => {
    setSelectedImageSrc(null)

    if (blobUrlRef.current) {
      URL.revokeObjectURL(blobUrlRef.current)
      blobUrlRef.current = null
    }

    setAvatarLoading(true)

    const previewUrl = URL.createObjectURL(croppedBlob)
    blobUrlRef.current = previewUrl
    setOptimisticAvatar(previewUrl)

    try {
      const originalFile = selectedFileRef.current
      const fileName = originalFile?.name || 'avatar.jpg'
      const croppedFile = new File([croppedBlob], fileName, { type: 'image/jpeg' })

      const formData = new FormData()
      formData.append('avatar', croppedFile)

      const res = await fetch('/api/me/avatar', {
        method: 'POST',
        headers: {
          'x-tab-id': getTabId(),
        },
        body: formData,
      })

      const data = await res.json()

      if (!res.ok) {
        setOptimisticAvatar(null)
        throw new Error(data.error || 'Failed to upload avatar')
      }

      const serverUrl = data.avatar
      setOptimisticAvatar(serverUrl)
      onUserUpdate({ avatar: serverUrl })

      if (blobUrlRef.current) {
        URL.revokeObjectURL(blobUrlRef.current)
        blobUrlRef.current = null
      }

      await onSessionUpdate()
      toast.success('Avatar updated')
    } catch (error) {
      if (blobUrlRef.current) {
        URL.revokeObjectURL(blobUrlRef.current)
        blobUrlRef.current = null
      }
      toast.error(error instanceof Error ? error.message : 'Failed to upload avatar')
    } finally {
      setAvatarLoading(false)
      selectedFileRef.current = null
    }
  }

  const handleCropDialogClose = (open: boolean) => {
    if (!open) {
      setSelectedImageSrc(null)
      selectedFileRef.current = null
    }
    setCropDialogOpen(open)
  }

  const handleAvatarRemove = async () => {
    const previousAvatar = user.avatar
    setAvatarLoading(true)
    setOptimisticAvatar('pending')
    onUserUpdate({ avatar: null })

    try {
      const res = await fetch('/api/me/avatar', {
        method: 'DELETE',
        headers: {
          'x-tab-id': getTabId(),
        },
      })
      const data = await res.json()

      if (!res.ok) {
        setOptimisticAvatar(null)
        onUserUpdate({ avatar: previousAvatar })
        throw new Error(data.error || 'Failed to remove avatar')
      }

      setOptimisticAvatar(null)
      await onSessionUpdate()
      toast.success('Avatar removed')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to remove avatar')
    } finally {
      setAvatarLoading(false)
    }
  }

  const handleAvatarColorChange = async (color: string | null) => {
    const previousColor = user.avatarColor
    setAvatarColorLoading(true)
    onUserUpdate({ avatarColor: color })

    try {
      const res = await fetch('/api/me', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'x-tab-id': getTabId(),
        },
        body: JSON.stringify({ avatarColor: color }),
      })

      const data = await res.json()

      if (!res.ok) {
        onUserUpdate({ avatarColor: previousColor })
        throw new Error(data.error || 'Failed to update avatar color')
      }

      await onSessionUpdate()
      toast.success(color ? 'Avatar color updated' : 'Avatar color reset to default')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to update avatar color')
    } finally {
      setAvatarColorLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* Avatar Section */}
      <Card className="border-zinc-800 bg-zinc-900/50 overflow-hidden">
        <CardHeader className="pb-4">
          <div className="flex items-center gap-2">
            <Camera className="h-5 w-5 text-amber-500" />
            <CardTitle className="text-zinc-100">Profile Picture</CardTitle>
          </div>
          <CardDescription className="text-zinc-500">
            Upload a photo to personalize your account
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-6">
            <div className="relative group">
              <Avatar className="h-24 w-24 ring-4 ring-zinc-800 transition-all group-hover:ring-amber-500/50">
                <AvatarImage src={displayAvatar || undefined} alt={displayName} />
                <AvatarFallback
                  className="text-2xl font-semibold text-white"
                  style={{
                    backgroundColor: user.avatarColor || getAvatarColor(user.id),
                  }}
                >
                  {getInitials(displayName)}
                </AvatarFallback>
              </Avatar>
              {avatarLoading && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/50 rounded-full">
                  <div className="h-6 w-6 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
                </div>
              )}
            </div>
            <div className="flex flex-col gap-2">
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="border-zinc-700 hover:bg-zinc-800 hover:border-amber-500/50"
                  disabled={avatarLoading}
                  asChild
                >
                  <label className="cursor-pointer">
                    <Camera className="h-4 w-4 mr-2" />
                    Upload
                    <input
                      type="file"
                      accept="image/jpeg,image/png,image/gif,image/webp"
                      className="hidden"
                      onChange={handleAvatarSelect}
                      disabled={avatarLoading}
                    />
                  </label>
                </Button>
                {(displayAvatar || user.avatar) && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-zinc-400 hover:text-red-400"
                    onClick={handleAvatarRemove}
                    disabled={avatarLoading}
                  >
                    Remove
                  </Button>
                )}
              </div>
              <p className="text-xs text-zinc-500">JPG, PNG, GIF or WebP. Max 5MB.</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Avatar Color */}
      <Card className="border-zinc-800 bg-zinc-900/50">
        <CardHeader className="pb-4">
          <div className="flex items-center gap-2">
            <Palette className="h-5 w-5 text-amber-500" />
            <CardTitle className="text-zinc-100">Avatar Color</CardTitle>
          </div>
          <CardDescription className="text-zinc-500">
            Choose a background color for your fallback avatar (shown when no photo is uploaded)
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {/* Color preview */}
            <div className="flex items-center gap-4">
              <Avatar className="h-16 w-16 ring-2 ring-zinc-700">
                <AvatarFallback
                  className="text-xl font-semibold text-white"
                  style={{
                    backgroundColor: user.avatarColor || getAvatarColor(user.id),
                  }}
                >
                  {getInitials(displayName)}
                </AvatarFallback>
              </Avatar>
              <div className="text-sm text-zinc-400">
                {user.avatarColor ? (
                  <span>
                    Custom color: <code className="text-amber-400">{user.avatarColor}</code>
                  </span>
                ) : (
                  <span>Using default color based on your ID</span>
                )}
              </div>
            </div>

            {/* Color picker */}
            <ColorPickerBody
              activeColor={customAvatarColor || user.avatarColor || getAvatarColor(user.id)}
              onColorChange={setCustomAvatarColor}
              onApply={(color) => {
                if (/^#[0-9A-Fa-f]{6}$/i.test(color)) {
                  handleAvatarColorChange(color)
                }
              }}
              isDisabled={avatarColorLoading}
            />

            {/* Reset button */}
            {user.avatarColor && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setCustomAvatarColor('')
                  handleAvatarColorChange(null)
                }}
                disabled={avatarColorLoading}
                className="text-zinc-400 hover:text-zinc-200"
              >
                Reset to default
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Display Name */}
      <Card className="border-zinc-800 bg-zinc-900/50">
        <CardHeader className="pb-4">
          <div className="flex items-center gap-2">
            <User className="h-5 w-5 text-amber-500" />
            <CardTitle className="text-zinc-100">Display Name</CardTitle>
          </div>
          <CardDescription className="text-zinc-500">
            This is how other users will see you
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleProfileUpdate} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name" className="text-zinc-300">
                Name
              </Label>
              <Input
                ref={nameInputRef}
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Your name"
                className="bg-zinc-900 border-zinc-700 focus:border-amber-500 max-w-md"
              />
            </div>

            {user.isSystemAdmin && (
              <div className="flex items-center gap-2 px-3 py-2 bg-amber-500/10 border border-amber-500/20 rounded-lg max-w-md">
                <Shield className="h-4 w-4 text-amber-500" />
                <span className="text-sm text-amber-400">Super Admin</span>
              </div>
            )}

            <div className="flex justify-end max-w-md">
              <Button type="submit" variant="primary" disabled={profileLoading || !name.trim()}>
                {profileLoading ? 'Saving...' : 'Save'}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {/* Image Crop Dialog */}
      {selectedImageSrc && (
        <ImageCropDialog
          open={cropDialogOpen}
          onOpenChange={handleCropDialogClose}
          imageSrc={selectedImageSrc}
          onCropComplete={handleCroppedImage}
        />
      )}
    </div>
  )
}

'use client'

import { Camera, KeyRound, Mail, Shield, Trash2, User } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { signOut, useSession } from 'next-auth/react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import { ImageCropDialog, resizeImageForCropper } from '@/components/profile/image-crop-dialog'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import { getTabId } from '@/hooks/use-realtime'
import { getAvatarColor, getInitials } from '@/lib/utils'

// Stable user data type
interface UserData {
  id: string
  name: string
  email: string | null
  avatar: string | null
  isSystemAdmin: boolean
}

export default function ProfilePage() {
  const { data: session, status, update: updateSession } = useSession()
  const _router = useRouter()

  // Store stable user data that persists during session refresh
  const [stableUser, setStableUser] = useState<UserData | null>(null)

  // Track if we're in the middle of a session update to prevent flashing
  const isUpdatingRef = useRef(false)

  // Update stable user when session changes (but not during our own updates)
  useEffect(() => {
    if (session?.user?.id && !isUpdatingRef.current) {
      setStableUser({
        id: session.user.id,
        name: session.user.name,
        email: session.user.email,
        avatar: session.user.avatar,
        isSystemAdmin: session.user.isSystemAdmin,
      })
    }
  }, [
    session?.user?.id,
    session?.user?.name,
    session?.user?.email,
    session?.user?.avatar,
    session?.user?.isSystemAdmin,
  ])

  // Profile form state
  const [name, setName] = useState('')
  const [profileLoading, setProfileLoading] = useState(false)

  // Sync name input with session when it changes (from SSE), but only if not editing
  const nameInputRef = useRef<HTMLInputElement>(null)
  useEffect(() => {
    if (stableUser?.name && !profileLoading && document.activeElement !== nameInputRef.current) {
      setName(stableUser.name)
    }
  }, [stableUser?.name, profileLoading])

  // Initialize name on first load
  useEffect(() => {
    if (stableUser?.name && !name) {
      setName(stableUser.name)
    }
  }, [stableUser?.name, name])

  // Email change state
  const [newEmail, setNewEmail] = useState('')
  const [emailPassword, setEmailPassword] = useState('')
  const [emailLoading, setEmailLoading] = useState(false)

  // Password form state
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [passwordLoading, setPasswordLoading] = useState(false)

  // Avatar state - simple optimistic URL tracking
  const [avatarLoading, setAvatarLoading] = useState(false)
  const [optimisticAvatar, setOptimisticAvatar] = useState<string | null | 'pending'>(null)
  const blobUrlRef = useRef<string | null>(null)

  // Crop dialog state
  const [cropDialogOpen, setCropDialogOpen] = useState(false)
  const [selectedImageSrc, setSelectedImageSrc] = useState<string | null>(null)
  const selectedFileRef = useRef<File | null>(null)

  // Clear optimistic avatar when session catches up
  useEffect(() => {
    if (optimisticAvatar !== 'pending' && optimisticAvatar !== null) {
      // We have an optimistic URL, check if session has caught up
      if (session?.user?.avatar === optimisticAvatar) {
        setOptimisticAvatar(null)
      }
    } else if (
      optimisticAvatar === null &&
      session?.user?.avatar === null &&
      stableUser?.avatar !== null
    ) {
      // Session shows null (avatar removed), update stable user
      // This handles the case where we removed avatar and session caught up
    }
  }, [session?.user?.avatar, optimisticAvatar, stableUser?.avatar])

  // Delete account state
  const [deletePassword, setDeletePassword] = useState('')
  const [deleteConfirmation, setDeleteConfirmation] = useState('')
  const [deleteLoading, setDeleteLoading] = useState(false)

  // Cleanup blob URLs on unmount
  useEffect(() => {
    return () => {
      if (blobUrlRef.current) {
        URL.revokeObjectURL(blobUrlRef.current)
      }
    }
  }, [])

  // Debounced session update to prevent race conditions
  const pendingUpdateRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const debouncedUpdateSession = useCallback(async () => {
    // Clear any pending update
    if (pendingUpdateRef.current) {
      clearTimeout(pendingUpdateRef.current)
    }

    // Delay slightly to allow multiple rapid changes to coalesce
    return new Promise<void>((resolve) => {
      pendingUpdateRef.current = setTimeout(async () => {
        isUpdatingRef.current = true
        try {
          await updateSession()
        } finally {
          // Give session time to propagate before allowing new stable user updates
          setTimeout(() => {
            isUpdatingRef.current = false
          }, 100)
          resolve()
        }
      }, 50)
    })
  }, [updateSession])

  // Determine which avatar to display
  const getDisplayAvatar = (): string | null => {
    if (avatarLoading && optimisticAvatar === 'pending') {
      // During removal, show nothing (will show fallback)
      return null
    }
    if (optimisticAvatar && optimisticAvatar !== 'pending') {
      return optimisticAvatar
    }
    return stableUser?.avatar ?? null
  }

  const displayAvatar = getDisplayAvatar()
  const displayName = name || stableUser?.name || ''

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

      // Update stable user immediately for responsiveness
      if (stableUser) {
        setStableUser({ ...stableUser, name })
      }

      await debouncedUpdateSession()
      toast.success('Display name updated')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to update profile')
    } finally {
      setProfileLoading(false)
    }
  }

  const handleEmailChange = async (e: React.FormEvent) => {
    e.preventDefault()
    setEmailLoading(true)

    try {
      const res = await fetch('/api/me/email', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'x-tab-id': getTabId(),
        },
        body: JSON.stringify({ email: newEmail, password: emailPassword }),
      })

      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error || 'Failed to change email')
      }

      // Update stable user immediately
      if (stableUser) {
        setStableUser({ ...stableUser, email: newEmail })
      }

      await debouncedUpdateSession()
      setNewEmail('')
      setEmailPassword('')
      toast.success('Email address updated')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to change email')
    } finally {
      setEmailLoading(false)
    }
  }

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault()

    if (newPassword !== confirmPassword) {
      toast.error('New passwords do not match')
      return
    }

    setPasswordLoading(true)

    try {
      const res = await fetch('/api/me/password', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentPassword, newPassword }),
      })

      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error || 'Failed to change password')
      }

      setCurrentPassword('')
      setNewPassword('')
      setConfirmPassword('')
      toast.success('Password changed successfully')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to change password')
    } finally {
      setPasswordLoading(false)
    }
  }

  const handleAvatarSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    // Reset the input immediately so the same file can be selected again
    e.target.value = ''

    // Store file reference
    selectedFileRef.current = file

    try {
      // Resize large images for better cropper performance
      const resizedImageSrc = await resizeImageForCropper(file)
      setSelectedImageSrc(resizedImageSrc)
      setCropDialogOpen(true)
    } catch (error) {
      console.error('Failed to load image:', error)
      toast.error('Failed to load image')
    }
  }

  const handleCroppedImage = async (croppedBlob: Blob) => {
    // Clear selected image (data URL, no need to revoke)
    setSelectedImageSrc(null)

    // Clean up previous blob URL if any
    if (blobUrlRef.current) {
      URL.revokeObjectURL(blobUrlRef.current)
      blobUrlRef.current = null
    }

    setAvatarLoading(true)

    // Create optimistic preview URL from cropped blob
    const previewUrl = URL.createObjectURL(croppedBlob)
    blobUrlRef.current = previewUrl
    setOptimisticAvatar(previewUrl)

    try {
      // Create a File from the cropped Blob
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
        // Revert optimistic update on error
        setOptimisticAvatar(null)
        throw new Error(data.error || 'Failed to upload avatar')
      }

      // Update to real URL from server
      const serverUrl = data.avatar
      setOptimisticAvatar(serverUrl)

      // Update stable user immediately
      if (stableUser) {
        setStableUser({ ...stableUser, avatar: serverUrl })
      }

      // Clean up blob URL now that we have server URL
      if (blobUrlRef.current) {
        URL.revokeObjectURL(blobUrlRef.current)
        blobUrlRef.current = null
      }

      await debouncedUpdateSession()
      toast.success('Avatar updated')
    } catch (error) {
      // Clean up blob URL on error
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
    const previousAvatar = stableUser?.avatar
    setAvatarLoading(true)

    // Mark as pending removal (show fallback immediately)
    setOptimisticAvatar('pending')

    // Update stable user immediately for responsiveness
    if (stableUser) {
      setStableUser({ ...stableUser, avatar: null })
    }

    try {
      const res = await fetch('/api/me/avatar', {
        method: 'DELETE',
        headers: {
          'x-tab-id': getTabId(),
        },
      })
      const data = await res.json()

      if (!res.ok) {
        // Revert optimistic update on error
        setOptimisticAvatar(null)
        if (stableUser) {
          setStableUser({ ...stableUser, avatar: previousAvatar ?? null })
        }
        throw new Error(data.error || 'Failed to remove avatar')
      }

      // Clear optimistic state - stable user already updated
      setOptimisticAvatar(null)

      await debouncedUpdateSession()
      toast.success('Avatar removed')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to remove avatar')
    } finally {
      setAvatarLoading(false)
    }
  }

  const handleDeleteAccount = async () => {
    if (deleteConfirmation !== 'DELETE MY ACCOUNT') {
      toast.error('Please type "DELETE MY ACCOUNT" to confirm')
      return
    }

    setDeleteLoading(true)

    try {
      const res = await fetch('/api/me/account', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          password: deletePassword,
          confirmation: deleteConfirmation,
        }),
      })

      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error || 'Failed to delete account')
      }

      toast.success('Account deleted. Signing out...')
      await signOut({ callbackUrl: '/login' })
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to delete account')
      setDeleteLoading(false)
    }
  }

  // Show loading only during initial session load, not during updates
  if (status === 'loading' && !stableUser) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="animate-pulse text-zinc-500">Loading...</div>
      </div>
    )
  }

  if (status === 'unauthenticated') {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-zinc-500">Please sign in to view your profile.</div>
      </div>
    )
  }

  // Use stable user for rendering - this won't flicker during session updates
  if (!stableUser) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="animate-pulse text-zinc-500">Loading profile...</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-zinc-950">
      {/* Header with gradient accent */}
      <div className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-amber-500/10 via-orange-500/5 to-transparent" />
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-amber-500/5 rounded-full blur-3xl" />
        <div className="absolute top-20 right-1/4 w-64 h-64 bg-orange-500/5 rounded-full blur-3xl" />

        <div className="relative max-w-3xl mx-auto px-6 py-12">
          <div className="flex items-center gap-2 text-amber-500 mb-2">
            <User className="h-5 w-5" />
            <span className="text-sm font-medium uppercase tracking-wider">Profile</span>
          </div>
          <h1 className="text-3xl font-bold text-zinc-100 mb-2">Account Settings</h1>
          <p className="text-zinc-400">Manage your profile, security, and preferences</p>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-6 pb-16 space-y-8">
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
                    style={{ backgroundColor: getAvatarColor(stableUser.id) }}
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
                  {(displayAvatar || stableUser.avatar) && (
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

              {stableUser.isSystemAdmin && (
                <div className="flex items-center gap-2 px-3 py-2 bg-amber-500/10 border border-amber-500/20 rounded-lg max-w-md">
                  <Shield className="h-4 w-4 text-amber-500" />
                  <span className="text-sm text-amber-400">System Administrator</span>
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

        {/* Email Address */}
        <Card className="border-zinc-800 bg-zinc-900/50">
          <CardHeader className="pb-4">
            <div className="flex items-center gap-2">
              <Mail className="h-5 w-5 text-amber-500" />
              <CardTitle className="text-zinc-100">Email Address</CardTitle>
            </div>
            <CardDescription className="text-zinc-500">
              Your current email is{' '}
              <span className="text-zinc-300">{stableUser.email || 'not set'}</span>
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleEmailChange} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="newEmail" className="text-zinc-300">
                  New Email Address
                </Label>
                <Input
                  id="newEmail"
                  type="email"
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  placeholder="your@email.com"
                  className="bg-zinc-900 border-zinc-700 focus:border-amber-500 max-w-md"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="emailPassword" className="text-zinc-300">
                  Confirm with Password
                </Label>
                <Input
                  id="emailPassword"
                  type="password"
                  value={emailPassword}
                  onChange={(e) => setEmailPassword(e.target.value)}
                  placeholder="Enter your password"
                  className="bg-zinc-900 border-zinc-700 focus:border-amber-500 max-w-md"
                />
              </div>
              <div className="flex justify-end max-w-md">
                <Button
                  type="submit"
                  variant="primary"
                  disabled={emailLoading || !newEmail.trim() || !emailPassword}
                >
                  {emailLoading ? 'Updating...' : 'Change Email'}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>

        {/* Password Section */}
        <Card className="border-zinc-800 bg-zinc-900/50">
          <CardHeader className="pb-4">
            <div className="flex items-center gap-2">
              <KeyRound className="h-5 w-5 text-amber-500" />
              <CardTitle className="text-zinc-100">Change Password</CardTitle>
            </div>
            <CardDescription className="text-zinc-500">
              Update your password to keep your account secure
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handlePasswordChange} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="currentPassword" className="text-zinc-300">
                  Current Password
                </Label>
                <Input
                  id="currentPassword"
                  type="password"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  placeholder="Enter current password"
                  className="bg-zinc-900 border-zinc-700 focus:border-amber-500"
                />
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="newPassword" className="text-zinc-300">
                    New Password
                  </Label>
                  <Input
                    id="newPassword"
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Enter new password"
                    className="bg-zinc-900 border-zinc-700 focus:border-amber-500"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="confirmPassword" className="text-zinc-300">
                    Confirm New Password
                  </Label>
                  <Input
                    id="confirmPassword"
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Confirm new password"
                    className="bg-zinc-900 border-zinc-700 focus:border-amber-500"
                  />
                </div>
              </div>
              <div className="bg-zinc-800/50 rounded-lg p-3 text-xs text-zinc-400 space-y-1">
                <p className="font-medium text-zinc-300">Password requirements:</p>
                <ul className="list-disc list-inside space-y-0.5">
                  <li>At least 12 characters long</li>
                  <li>At least one uppercase letter</li>
                  <li>At least one lowercase letter</li>
                  <li>At least one number</li>
                </ul>
              </div>
              <div className="flex justify-end">
                <Button
                  type="submit"
                  variant="primary"
                  disabled={passwordLoading || !currentPassword || !newPassword || !confirmPassword}
                >
                  {passwordLoading ? 'Updating...' : 'Update Password'}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>

        <Separator className="bg-zinc-800" />

        {/* Danger Zone */}
        <Card className="border-red-900/50 bg-red-950/10">
          <CardHeader className="pb-4">
            <div className="flex items-center gap-2">
              <Trash2 className="h-5 w-5 text-red-500" />
              <CardTitle className="text-red-400">Danger Zone</CardTitle>
            </div>
            <CardDescription className="text-red-400/70">
              Irreversible actions that will permanently affect your account
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between p-4 bg-red-950/20 border border-red-900/30 rounded-lg">
              <div>
                <h4 className="font-medium text-zinc-100">Delete Account</h4>
                <p className="text-sm text-zinc-400">
                  Permanently delete your account and all associated data
                </p>
              </div>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="destructive" className="bg-red-600 hover:bg-red-700">
                    <Trash2 className="h-4 w-4 mr-2" />
                    Delete Account
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent className="bg-zinc-900 border-zinc-800">
                  <AlertDialogHeader>
                    <AlertDialogTitle className="text-zinc-100">
                      Are you absolutely sure?
                    </AlertDialogTitle>
                    <AlertDialogDescription className="text-zinc-400">
                      This action cannot be undone. Your account will be permanently deactivated and
                      you will lose access to all your data.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <div className="space-y-4 py-4">
                    <div className="space-y-2">
                      <Label htmlFor="deletePassword" className="text-zinc-300">
                        Enter your password
                      </Label>
                      <Input
                        id="deletePassword"
                        type="password"
                        value={deletePassword}
                        onChange={(e) => setDeletePassword(e.target.value)}
                        placeholder="Your password"
                        className="bg-zinc-900 border-zinc-700"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="deleteConfirmation" className="text-zinc-300">
                        Type <span className="font-mono text-red-400">DELETE MY ACCOUNT</span> to
                        confirm
                      </Label>
                      <Input
                        id="deleteConfirmation"
                        value={deleteConfirmation}
                        onChange={(e) => setDeleteConfirmation(e.target.value)}
                        placeholder="DELETE MY ACCOUNT"
                        className="bg-zinc-900 border-zinc-700 font-mono"
                      />
                    </div>
                  </div>
                  <AlertDialogFooter>
                    <AlertDialogCancel className="border-zinc-700 text-zinc-300 hover:bg-zinc-800">
                      Cancel
                    </AlertDialogCancel>
                    <AlertDialogAction
                      onClick={handleDeleteAccount}
                      disabled={
                        deleteLoading ||
                        !deletePassword ||
                        deleteConfirmation !== 'DELETE MY ACCOUNT'
                      }
                      className="bg-red-600 hover:bg-red-700 text-white"
                    >
                      {deleteLoading ? 'Deleting...' : 'Delete Account'}
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          </CardContent>
        </Card>
      </div>

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

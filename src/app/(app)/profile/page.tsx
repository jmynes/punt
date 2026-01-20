'use client'

import { Camera, KeyRound, Mail, Shield, Trash2, User } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { signOut, useSession } from 'next-auth/react'
import { useState } from 'react'
import { toast } from 'sonner'
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
import { getAvatarColor, getInitials } from '@/lib/utils'

export default function ProfilePage() {
  const { data: session, update: updateSession } = useSession()
  const _router = useRouter()
  const user = session?.user

  // Profile form state
  const [name, setName] = useState(user?.name || '')
  const [email, setEmail] = useState(user?.email || '')
  const [profileLoading, setProfileLoading] = useState(false)

  // Password form state
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [passwordLoading, setPasswordLoading] = useState(false)

  // Avatar state
  const [avatarLoading, setAvatarLoading] = useState(false)

  // Delete account state
  const [deletePassword, setDeletePassword] = useState('')
  const [deleteConfirmation, setDeleteConfirmation] = useState('')
  const [deleteLoading, setDeleteLoading] = useState(false)

  const handleProfileUpdate = async (e: React.FormEvent) => {
    e.preventDefault()
    setProfileLoading(true)

    try {
      const res = await fetch('/api/me', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email }),
      })

      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error || 'Failed to update profile')
      }

      await updateSession()
      toast.success('Profile updated successfully')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to update profile')
    } finally {
      setProfileLoading(false)
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

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setAvatarLoading(true)

    try {
      const formData = new FormData()
      formData.append('avatar', file)

      const res = await fetch('/api/me/avatar', {
        method: 'POST',
        body: formData,
      })

      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error || 'Failed to upload avatar')
      }

      await updateSession()
      toast.success('Avatar updated successfully')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to upload avatar')
    } finally {
      setAvatarLoading(false)
    }
  }

  const handleAvatarRemove = async () => {
    setAvatarLoading(true)

    try {
      const res = await fetch('/api/me/avatar', { method: 'DELETE' })
      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error || 'Failed to remove avatar')
      }

      await updateSession()
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
      // Sign out to clear the session cookie and redirect to login
      await signOut({ callbackUrl: '/login' })
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to delete account')
      setDeleteLoading(false)
    }
  }

  if (!user) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="animate-pulse text-zinc-500">Loading...</div>
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
                  <AvatarImage src={user.avatar || undefined} alt={user.name} />
                  <AvatarFallback
                    className="text-2xl font-semibold text-white"
                    style={{ backgroundColor: getAvatarColor(user.id || user.name) }}
                  >
                    {getInitials(user.name)}
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
                        onChange={handleAvatarUpload}
                        disabled={avatarLoading}
                      />
                    </label>
                  </Button>
                  {user.avatar && (
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

        {/* Profile Information */}
        <Card className="border-zinc-800 bg-zinc-900/50">
          <CardHeader className="pb-4">
            <div className="flex items-center gap-2">
              <Mail className="h-5 w-5 text-amber-500" />
              <CardTitle className="text-zinc-100">Profile Information</CardTitle>
            </div>
            <CardDescription className="text-zinc-500">
              Update your personal details
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleProfileUpdate} className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="name" className="text-zinc-300">
                    Display Name
                  </Label>
                  <Input
                    id="name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Your name"
                    className="bg-zinc-900 border-zinc-700 focus:border-amber-500"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email" className="text-zinc-300">
                    Email Address
                  </Label>
                  <Input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="your@email.com"
                    className="bg-zinc-900 border-zinc-700 focus:border-amber-500"
                  />
                </div>
              </div>

              {user.isSystemAdmin && (
                <div className="flex items-center gap-2 px-3 py-2 bg-amber-500/10 border border-amber-500/20 rounded-lg">
                  <Shield className="h-4 w-4 text-amber-500" />
                  <span className="text-sm text-amber-400">System Administrator</span>
                </div>
              )}

              <div className="flex justify-end">
                <Button
                  type="submit"
                  disabled={profileLoading}
                  className="bg-amber-600 hover:bg-amber-700 text-white"
                >
                  {profileLoading ? 'Saving...' : 'Save Changes'}
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
                  disabled={passwordLoading || !currentPassword || !newPassword || !confirmPassword}
                  className="bg-amber-600 hover:bg-amber-700 text-white"
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
    </div>
  )
}

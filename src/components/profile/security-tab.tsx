'use client'

import { Eye, EyeOff, KeyRound, Mail, Trash2 } from 'lucide-react'
import { signOut } from 'next-auth/react'
import { useState } from 'react'
import { ReauthDialog } from '@/components/profile/reauth-dialog'
import { TwoFactorSection } from '@/components/profile/two-factor-section'
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { getTabId } from '@/hooks/use-realtime'
import { showToast } from '@/lib/toast'

interface UserData {
  id: string
  name: string
  email: string | null
  avatar: string | null
  avatarColor: string | null
  isSystemAdmin: boolean
}

interface SecurityTabProps {
  user: UserData
  isDemo: boolean
  onUserUpdate: (updates: Partial<UserData>) => void
  onSessionUpdate: () => Promise<void>
}

export function SecurityTab({ user, isDemo, onUserUpdate, onSessionUpdate }: SecurityTabProps) {
  // Email change state
  const [newEmail, setNewEmail] = useState('')
  const [showEmailReauthDialog, setShowEmailReauthDialog] = useState(false)

  // Password form state
  const [newPassword, setNewPassword] = useState('')
  const [showNewPassword, setShowNewPassword] = useState(false)
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [showPasswordReauthDialog, setShowPasswordReauthDialog] = useState(false)

  // Delete account state
  const [deleteConfirmation, setDeleteConfirmation] = useState('')
  const [showDeleteAlertDialog, setShowDeleteAlertDialog] = useState(false)
  const [showDeleteReauthDialog, setShowDeleteReauthDialog] = useState(false)

  const handleEmailChange = (e: React.FormEvent) => {
    e.preventDefault()
    setShowEmailReauthDialog(true)
  }

  const handleEmailReauthConfirm = async (
    password: string,
    totpCode?: string,
    isRecoveryCode?: boolean,
  ) => {
    const res = await fetch('/api/me/email', {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'x-tab-id': getTabId(),
      },
      body: JSON.stringify({ email: newEmail, password, totpCode, isRecoveryCode }),
    })

    const data = await res.json()

    if (!res.ok) {
      throw new Error(data.error || 'Failed to change email')
    }

    onUserUpdate({ email: newEmail })
    await onSessionUpdate()
    setNewEmail('')
    showToast.success('Email address updated')
  }

  const handlePasswordChange = (e: React.FormEvent) => {
    e.preventDefault()
    if (newPassword !== confirmPassword) {
      showToast.error('New passwords do not match')
      return
    }
    setShowPasswordReauthDialog(true)
  }

  const handlePasswordReauthConfirm = async (
    password: string,
    totpCode?: string,
    isRecoveryCode?: boolean,
  ) => {
    const res = await fetch('/api/me/password', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ currentPassword: password, newPassword, totpCode, isRecoveryCode }),
    })

    const data = await res.json()

    if (!res.ok) {
      throw new Error(data.error || 'Failed to change password')
    }

    setNewPassword('')
    setConfirmPassword('')
    showToast.success('Password changed successfully')
  }

  const handleDeleteReauthConfirm = async (
    password: string,
    totpCode?: string,
    isRecoveryCode?: boolean,
  ) => {
    if (isDemo) {
      throw new Error('Account deletion is not available in demo mode')
    }

    const res = await fetch('/api/me/account', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        password,
        confirmation: deleteConfirmation,
        totpCode,
        isRecoveryCode,
      }),
    })

    const data = await res.json()

    if (!res.ok) {
      throw new Error(data.error || 'Failed to delete account')
    }

    showToast.success('Account deleted. Signing out...')
    await signOut({ callbackUrl: '/login' })
  }

  return (
    <div className="space-y-6">
      {/* Email Address */}
      <Card className="border-zinc-800 bg-zinc-900/50">
        <CardHeader className="pb-4">
          <div className="flex items-center gap-2">
            <Mail className="h-5 w-5 text-amber-500" />
            <CardTitle className="text-zinc-100">Email Address</CardTitle>
          </div>
          <CardDescription className="text-zinc-500">
            Your current email is <span className="text-zinc-300">{user.email || 'not set'}</span>
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
            <div className="flex justify-end max-w-md">
              <Button type="submit" variant="primary" disabled={!newEmail.trim()}>
                Change Email
              </Button>
            </div>
          </form>

          <ReauthDialog
            open={showEmailReauthDialog}
            onOpenChange={setShowEmailReauthDialog}
            title="Confirm Email Change"
            description="Enter your credentials to change your email address."
            actionLabel="Change Email"
            onConfirm={handleEmailReauthConfirm}
          />
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
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="newPassword" className="text-zinc-300">
                  New Password
                </Label>
                <div className="relative">
                  <Input
                    id="newPassword"
                    type={showNewPassword ? 'text' : 'password'}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Enter new password"
                    className="bg-zinc-900 border-zinc-700 focus:border-amber-500 pr-10"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="absolute right-0 top-0 h-full w-10 text-zinc-500 hover:text-zinc-300 hover:bg-transparent"
                    onClick={() => setShowNewPassword(!showNewPassword)}
                  >
                    {showNewPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </Button>
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="confirmPassword" className="text-zinc-300">
                  Confirm New Password
                </Label>
                <div className="relative">
                  <Input
                    id="confirmPassword"
                    type={showConfirmPassword ? 'text' : 'password'}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Confirm new password"
                    className="bg-zinc-900 border-zinc-700 focus:border-amber-500 pr-10"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="absolute right-0 top-0 h-full w-10 text-zinc-500 hover:text-zinc-300 hover:bg-transparent"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  >
                    {showConfirmPassword ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </Button>
                </div>
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
              <Button type="submit" variant="primary" disabled={!newPassword || !confirmPassword}>
                Update Password
              </Button>
            </div>
          </form>

          <ReauthDialog
            open={showPasswordReauthDialog}
            onOpenChange={setShowPasswordReauthDialog}
            title="Confirm Password Change"
            description="Enter your current credentials to change your password."
            actionLabel="Update Password"
            onConfirm={handlePasswordReauthConfirm}
          />
        </CardContent>
      </Card>

      {/* Two-Factor Authentication */}
      <TwoFactorSection isDemo={isDemo} />

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
            <Button
              variant="destructive"
              className="bg-red-600 hover:bg-red-700"
              onClick={() => setShowDeleteAlertDialog(true)}
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Delete Account
            </Button>

            <AlertDialog open={showDeleteAlertDialog} onOpenChange={setShowDeleteAlertDialog}>
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
                  <Button
                    onClick={() => {
                      setShowDeleteAlertDialog(false)
                      setShowDeleteReauthDialog(true)
                    }}
                    disabled={deleteConfirmation !== 'DELETE MY ACCOUNT'}
                    className="bg-red-600 hover:bg-red-700 text-white"
                  >
                    Delete Account
                  </Button>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>

            <ReauthDialog
              open={showDeleteReauthDialog}
              onOpenChange={setShowDeleteReauthDialog}
              title="Confirm Account Deletion"
              description="Enter your credentials to permanently delete your account."
              actionLabel="Delete Account"
              actionVariant="destructive"
              onConfirm={handleDeleteReauthConfirm}
            />
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

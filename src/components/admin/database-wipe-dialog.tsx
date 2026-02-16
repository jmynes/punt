'use client'

import { AlertTriangle, Eye, EyeOff, Loader2, Lock, Shield, Trash2, User } from 'lucide-react'
import { useState } from 'react'
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
import { useWipeDatabase } from '@/hooks/queries/use-database-backup'

interface DatabaseWipeDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

type Step = 'warning' | 'verify' | 'credentials' | 'confirm' | 'wiping'

export function DatabaseWipeDialog({ open, onOpenChange }: DatabaseWipeDialogProps) {
  const [step, setStep] = useState<Step>('warning')
  const [currentPassword, setCurrentPassword] = useState('')
  const [showCurrentPassword, setShowCurrentPassword] = useState(false)
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [confirmText, setConfirmText] = useState('')
  const [verifying, setVerifying] = useState(false)
  const [verifyError, setVerifyError] = useState<string | null>(null)

  const wipeMutation = useWipeDatabase()

  const resetState = () => {
    setStep('warning')
    setCurrentPassword('')
    setShowCurrentPassword(false)
    setUsername('')
    setPassword('')
    setShowPassword(false)
    setConfirmText('')
    setVerifyError(null)
  }

  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen) {
      resetState()
    }
    onOpenChange(newOpen)
  }

  const handleWipe = async () => {
    setStep('wiping')
    try {
      await wipeMutation.mutateAsync({
        currentPassword,
        username,
        password,
        confirmText,
      })
      // Success will redirect to login via the mutation's onSuccess
    } catch {
      // Error shown via toast, return to confirm step
      setStep('confirm')
    }
  }

  const handleVerify = async () => {
    setVerifying(true)
    setVerifyError(null)
    try {
      const res = await fetch('/api/auth/verify-credentials', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: currentPassword }),
      })
      if (!res.ok) {
        const data = await res.json()
        setVerifyError(data.error || 'Invalid password')
        return
      }
      setStep('credentials')
    } catch {
      setVerifyError('Failed to verify credentials')
    } finally {
      setVerifying(false)
    }
  }

  const canProceedFromCredentials = username.length >= 3 && password.length >= 12

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md bg-zinc-900 border-zinc-800">
        <DialogHeader>
          <DialogTitle className="text-zinc-100 flex items-center gap-2">
            <Trash2 className="h-5 w-5 text-red-400" />
            Wipe Database
          </DialogTitle>
          <DialogDescription className="text-zinc-400">
            {step === 'warning' && 'This will permanently delete all data.'}
            {step === 'verify' && 'Verify your identity to continue.'}
            {step === 'credentials' && 'Set up the new admin account.'}
            {step === 'confirm' && 'Confirm the wipe operation.'}
            {step === 'wiping' && 'Wiping database...'}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {step === 'warning' && (
            <>
              <div className="flex items-start gap-3 p-4 bg-red-900/30 border border-red-800 rounded-lg">
                <AlertTriangle className="h-5 w-5 text-red-400 flex-shrink-0 mt-0.5" />
                <div className="text-sm space-y-2">
                  <p className="font-medium text-red-400">Irreversible Action</p>
                  <ul className="text-red-300/80 space-y-1 list-disc list-inside">
                    <li>All users will be deleted</li>
                    <li>All projects and tickets will be deleted</li>
                    <li>All settings will be reset to defaults</li>
                    <li>Uploaded files will remain but become orphaned</li>
                  </ul>
                  <p className="text-red-300/80 font-medium mt-3">
                    Make sure you have exported a backup if you need to preserve any data.
                  </p>
                </div>
              </div>

              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => handleOpenChange(false)}>
                  Cancel
                </Button>
                <Button variant="destructive" onClick={() => setStep('verify')}>
                  I Understand, Continue
                </Button>
              </div>
            </>
          )}

          {step === 'verify' && (
            <>
              <div className="flex items-start gap-3 p-4 bg-amber-900/20 border border-amber-800 rounded-lg">
                <Shield className="h-5 w-5 text-amber-400 flex-shrink-0 mt-0.5" />
                <div className="text-sm">
                  <p className="font-medium text-amber-400">Identity Verification Required</p>
                  <p className="text-amber-300/80 mt-1">
                    Enter your current password to authorize this destructive action.
                  </p>
                </div>
              </div>

              {verifyError && (
                <div className="p-3 bg-red-900/30 border border-red-800 rounded-lg">
                  <p className="text-sm text-red-300">{verifyError}</p>
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="current-password" className="text-zinc-300">
                  Your Current Password
                </Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-500" />
                  <Input
                    id="current-password"
                    name="admin-confirm-password"
                    type="text"
                    autoComplete="off"
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && currentPassword && !verifying) {
                        e.preventDefault()
                        handleVerify()
                      }
                    }}
                    placeholder="Enter your password"
                    className={`bg-zinc-800 border-zinc-700 text-zinc-100 pl-10 pr-10 ${!showCurrentPassword ? 'password-mask' : ''}`}
                  />
                  <button
                    type="button"
                    onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300"
                  >
                    {showCurrentPassword ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </button>
                </div>
              </div>

              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setStep('warning')}>
                  Back
                </Button>
                <Button
                  variant="destructive"
                  onClick={handleVerify}
                  disabled={!currentPassword || verifying}
                >
                  {verifying ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                  Continue
                </Button>
              </div>
            </>
          )}

          {step === 'credentials' && (
            <>
              <p className="text-sm text-zinc-400">
                Enter the username and password for the new admin account that will be created after
                wiping.
              </p>

              <div className="space-y-3">
                <div className="space-y-2">
                  <Label htmlFor="wipe-username" className="text-zinc-300">
                    New Admin Username
                  </Label>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-500" />
                    <Input
                      id="wipe-username"
                      type="text"
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      placeholder="admin"
                      className="bg-zinc-800 border-zinc-700 text-zinc-100 pl-10"
                      autoComplete="off"
                    />
                  </div>
                  <p className="text-xs text-zinc-500">
                    3-30 characters, letters, numbers, underscores, hyphens only
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="wipe-password" className="text-zinc-300">
                    New Admin Password
                  </Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-500" />
                    <Input
                      id="wipe-password"
                      name="new-admin-password"
                      type={showPassword ? 'text' : 'password'}
                      autoComplete="new-password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Minimum 12 characters"
                      className="bg-zinc-800 border-zinc-700 text-zinc-100 pl-10 pr-10"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300"
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                  <p className="text-xs text-zinc-500">
                    Min 12 chars, 1 uppercase, 1 lowercase, 1 number
                  </p>
                </div>
              </div>

              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setStep('verify')}>
                  Back
                </Button>
                <Button
                  variant="destructive"
                  onClick={() => setStep('confirm')}
                  disabled={!canProceedFromCredentials}
                >
                  Continue
                </Button>
              </div>
            </>
          )}

          {step === 'confirm' && (
            <>
              <div className="space-y-3">
                <p className="text-sm text-zinc-400">
                  To confirm, type <span className="font-mono text-red-400">WIPE ALL DATA</span>{' '}
                  below:
                </p>
                <Input
                  type="text"
                  value={confirmText}
                  onChange={(e) => setConfirmText(e.target.value)}
                  placeholder="Type WIPE ALL DATA"
                  className="bg-zinc-800 border-zinc-700 text-zinc-100 font-mono"
                  autoComplete="off"
                />
              </div>

              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setStep('credentials')}>
                  Back
                </Button>
                <Button
                  variant="destructive"
                  onClick={handleWipe}
                  disabled={confirmText !== 'WIPE ALL DATA'}
                >
                  <Trash2 className="h-4 w-4" />
                  Wipe Database
                </Button>
              </div>
            </>
          )}

          {step === 'wiping' && (
            <div className="flex flex-col items-center justify-center py-8 gap-4">
              <Loader2 className="h-8 w-8 animate-spin text-red-400" />
              <p className="text-zinc-400">Wiping database and creating admin account...</p>
              <p className="text-xs text-zinc-500">Do not close this window</p>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}

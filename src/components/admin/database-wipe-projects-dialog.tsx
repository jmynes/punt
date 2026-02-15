'use client'

import { AlertTriangle, Eye, EyeOff, FolderX, Loader2, Lock, Shield } from 'lucide-react'
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
import { useWipeProjects } from '@/hooks/queries/use-database-backup'
import { showToast } from '@/lib/toast'

interface DatabaseWipeProjectsDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

type Step = 'warning' | 'verify' | 'confirm' | 'wiping' | 'success'

const REQUIRED_CONFIRMATION = 'DELETE ALL PROJECTS'

export function DatabaseWipeProjectsDialog({
  open,
  onOpenChange,
}: DatabaseWipeProjectsDialogProps) {
  const [step, setStep] = useState<Step>('warning')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [confirmText, setConfirmText] = useState('')
  const [result, setResult] = useState<{ projects: number; tickets: number } | null>(null)
  const [verifying, setVerifying] = useState(false)
  const [verifyError, setVerifyError] = useState<string | null>(null)

  const wipeMutation = useWipeProjects()

  const resetState = () => {
    setStep('warning')
    setConfirmPassword('')
    setShowPassword(false)
    setConfirmText('')
    setResult(null)
    setVerifyError(null)
  }

  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen && step !== 'wiping') {
      resetState()
    }
    onOpenChange(newOpen)
  }

  const handleWipe = async () => {
    setStep('wiping')
    try {
      const res = await wipeMutation.mutateAsync({
        confirmPassword,
        confirmText,
      })
      setResult({ projects: res.counts.projects, tickets: res.counts.tickets })
      setStep('success')
      showToast.success('All projects wiped successfully')
    } catch {
      // Error shown via toast, return to confirm step
      setStep('confirm')
    }
  }

  const handleDone = () => {
    resetState()
    onOpenChange(false)
    // Reload to reflect changes
    window.location.href = '/admin/settings?tab=database'
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md bg-zinc-900 border-zinc-800">
        <DialogHeader>
          <DialogTitle className="text-zinc-100 flex items-center gap-2">
            <FolderX className="h-5 w-5 text-amber-400" />
            Wipe All Projects
          </DialogTitle>
          <DialogDescription className="text-zinc-400">
            {step === 'warning' && 'This will delete all projects and their data.'}
            {step === 'verify' && 'Verify your identity to continue.'}
            {step === 'confirm' && 'Confirm the wipe operation.'}
            {step === 'wiping' && 'Wiping projects...'}
            {step === 'success' && 'Projects wiped successfully.'}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {step === 'warning' && (
            <>
              <div className="flex items-start gap-3 p-4 bg-amber-900/30 border border-amber-800 rounded-lg">
                <AlertTriangle className="h-5 w-5 text-amber-400 flex-shrink-0 mt-0.5" />
                <div className="text-sm space-y-2">
                  <p className="font-medium text-amber-400">This action will delete:</p>
                  <ul className="text-amber-300/80 space-y-1 list-disc list-inside">
                    <li>All projects</li>
                    <li>All tickets, comments, and attachments</li>
                    <li>All sprints and labels</li>
                    <li>All project memberships and roles</li>
                  </ul>
                  <p className="text-green-400 font-medium mt-3">What will be preserved:</p>
                  <ul className="text-green-300/80 space-y-1 list-disc list-inside">
                    <li>All user accounts and passwords</li>
                    <li>System admin privileges</li>
                    <li>System settings</li>
                  </ul>
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
                    Enter your password to authorize this action.
                  </p>
                </div>
              </div>

              {verifyError && (
                <div className="p-3 bg-red-900/30 border border-red-800 rounded-lg">
                  <p className="text-sm text-red-300">{verifyError}</p>
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="wipe-projects-password" className="text-zinc-300">
                  Your Password
                </Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-500" />
                  <Input
                    id="wipe-projects-password"
                    name="admin-confirm-password"
                    type="text"
                    autoComplete="off"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Enter your password"
                    className={`bg-zinc-800 border-zinc-700 text-zinc-100 pl-10 pr-10 ${!showPassword ? 'password-mask' : ''}`}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300"
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setStep('warning')}>
                  Back
                </Button>
                <Button
                  variant="destructive"
                  onClick={async () => {
                    setVerifying(true)
                    setVerifyError(null)
                    try {
                      const res = await fetch('/api/auth/verify-credentials', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ password: confirmPassword }),
                      })
                      if (!res.ok) {
                        const data = await res.json()
                        setVerifyError(data.error || 'Invalid password')
                        return
                      }
                      setStep('confirm')
                    } catch {
                      setVerifyError('Failed to verify credentials')
                    } finally {
                      setVerifying(false)
                    }
                  }}
                  disabled={!confirmPassword || verifying}
                >
                  {verifying ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                  Continue
                </Button>
              </div>
            </>
          )}

          {step === 'confirm' && (
            <>
              <div className="space-y-3">
                <p className="text-sm text-zinc-400">
                  To confirm, type{' '}
                  <span className="font-mono text-amber-400">{REQUIRED_CONFIRMATION}</span> below:
                </p>
                <Input
                  type="text"
                  value={confirmText}
                  onChange={(e) => setConfirmText(e.target.value)}
                  placeholder={`Type ${REQUIRED_CONFIRMATION}`}
                  className="bg-zinc-800 border-zinc-700 text-zinc-100 font-mono"
                  autoComplete="off"
                />
              </div>

              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setStep('verify')}>
                  Back
                </Button>
                <Button
                  variant="destructive"
                  onClick={handleWipe}
                  disabled={confirmText !== REQUIRED_CONFIRMATION}
                >
                  <FolderX className="h-4 w-4" />
                  Wipe All Projects
                </Button>
              </div>
            </>
          )}

          {step === 'wiping' && (
            <div className="flex flex-col items-center justify-center py-8 gap-4">
              <Loader2 className="h-8 w-8 animate-spin text-amber-400" />
              <p className="text-zinc-400">Wiping all projects...</p>
              <p className="text-xs text-zinc-500">Do not close this window</p>
            </div>
          )}

          {step === 'success' && result && (
            <>
              <div className="flex items-start gap-3 p-4 bg-green-900/30 border border-green-800 rounded-lg">
                <FolderX className="h-5 w-5 text-green-400 flex-shrink-0 mt-0.5" />
                <div className="text-sm space-y-2">
                  <p className="font-medium text-green-400">Projects Wiped Successfully</p>
                  <p className="text-green-300/80">
                    Deleted {result.projects} project{result.projects !== 1 ? 's' : ''} and{' '}
                    {result.tickets} ticket{result.tickets !== 1 ? 's' : ''}.
                  </p>
                  <p className="text-green-300/80">All user accounts have been preserved.</p>
                </div>
              </div>

              <div className="flex justify-end">
                <Button variant="primary" onClick={handleDone}>
                  Done
                </Button>
              </div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}

'use client'

import { AlertTriangle, FolderX, Loader2 } from 'lucide-react'
import { useState } from 'react'
import { ReauthDialog } from '@/components/profile/reauth-dialog'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { useWipeProjects } from '@/hooks/queries/use-database-backup'
import { showToast } from '@/lib/toast'

interface DatabaseWipeProjectsDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

type Step = 'warning' | 'confirm' | 'wiping' | 'success'

const REQUIRED_CONFIRMATION = 'DELETE ALL PROJECTS'

export function DatabaseWipeProjectsDialog({
  open,
  onOpenChange,
}: DatabaseWipeProjectsDialogProps) {
  const [step, setStep] = useState<Step>('warning')
  const [confirmText, setConfirmText] = useState('')
  const [result, setResult] = useState<{ projects: number; tickets: number } | null>(null)
  const [showReauthDialog, setShowReauthDialog] = useState(false)

  const wipeMutation = useWipeProjects()

  const resetState = () => {
    setStep('warning')
    setConfirmText('')
    setResult(null)
    setShowReauthDialog(false)
  }

  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen && step !== 'wiping') {
      resetState()
    }
    onOpenChange(newOpen)
  }

  const handleWipe = async (password: string, totpCode?: string, isRecoveryCode?: boolean) => {
    setStep('wiping')
    try {
      const res = await wipeMutation.mutateAsync({
        confirmPassword: password,
        confirmText,
        totpCode,
        isRecoveryCode,
      })
      setResult({ projects: res.counts.projects, tickets: res.counts.tickets })
      setStep('success')
      showToast.success('All projects wiped successfully')
    } catch {
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
                <Button variant="destructive" onClick={() => setStep('confirm')}>
                  I Understand, Continue
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
                <Button variant="outline" onClick={() => setStep('warning')}>
                  Back
                </Button>
                <Button
                  variant="destructive"
                  onClick={() => setShowReauthDialog(true)}
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

        <ReauthDialog
          open={showReauthDialog}
          onOpenChange={setShowReauthDialog}
          title="Confirm Wipe All Projects"
          description="Enter your credentials to authorize wiping all projects."
          actionLabel="Wipe All Projects"
          actionVariant="destructive"
          onConfirm={handleWipe}
        />
      </DialogContent>
    </Dialog>
  )
}

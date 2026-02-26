'use client'

import { Archive, ChevronRight, FileImage, Loader2, Lock, Paperclip } from 'lucide-react'
import { useState } from 'react'
import { ReauthDialog } from '@/components/profile/reauth-dialog'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  type ExportOptions,
  useDatabaseStats,
  useExportDatabase,
} from '@/hooks/queries/use-database-backup'

interface DatabaseExportDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  exportOptions: Omit<ExportOptions, 'confirmPassword' | 'totpCode' | 'isRecoveryCode'>
  onComplete: () => void
}

type Step = 'summary' | 'exporting'

export function DatabaseExportDialog({
  open,
  onOpenChange,
  exportOptions,
  onComplete,
}: DatabaseExportDialogProps) {
  const [step, setStep] = useState<Step>('summary')
  const [showReauthDialog, setShowReauthDialog] = useState(false)

  const { data: stats, isLoading: statsLoading } = useDatabaseStats()
  const exportMutation = useExportDatabase()

  const handleClose = () => {
    if (exportMutation.isPending) return
    setStep('summary')
    setShowReauthDialog(false)
    onOpenChange(false)
  }

  const handleReauthConfirm = async (
    password: string,
    totpCode?: string,
    isRecoveryCode?: boolean,
  ) => {
    setStep('exporting')
    try {
      await exportMutation.mutateAsync({
        ...exportOptions,
        confirmPassword: password,
        totpCode,
        isRecoveryCode,
      })
      handleClose()
      onComplete()
    } catch (err) {
      setStep('summary')
      throw err
    }
  }

  const willBeZip = exportOptions.includeAttachments || exportOptions.includeAvatars

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md" showCloseButton={step !== 'exporting'}>
        {/* Step 1: Summary */}
        {step === 'summary' && (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Archive className="h-5 w-5 text-blue-400" />
                Export Summary
              </DialogTitle>
              <DialogDescription>Review what will be included in the export.</DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-4">
              {/* Database counts */}
              <div className="bg-zinc-800 rounded-lg p-4 space-y-2">
                <p className="text-sm font-medium text-zinc-300">Records to export:</p>
                {statsLoading ? (
                  <div className="flex items-center gap-2 text-sm text-zinc-400">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Loading stats...
                  </div>
                ) : stats ? (
                  <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
                    {stats.users > 0 && (
                      <>
                        <span className="text-zinc-400">Users:</span>
                        <span className="text-zinc-200">{stats.users}</span>
                      </>
                    )}
                    {stats.projects > 0 && (
                      <>
                        <span className="text-zinc-400">Projects:</span>
                        <span className="text-zinc-200">{stats.projects}</span>
                      </>
                    )}
                    {stats.tickets > 0 && (
                      <>
                        <span className="text-zinc-400">Tickets:</span>
                        <span className="text-zinc-200">{stats.tickets}</span>
                      </>
                    )}
                    {stats.sprints > 0 && (
                      <>
                        <span className="text-zinc-400">Sprints:</span>
                        <span className="text-zinc-200">{stats.sprints}</span>
                      </>
                    )}
                    {stats.labels > 0 && (
                      <>
                        <span className="text-zinc-400">Labels:</span>
                        <span className="text-zinc-200">{stats.labels}</span>
                      </>
                    )}
                    {stats.columns > 0 && (
                      <>
                        <span className="text-zinc-400">Columns:</span>
                        <span className="text-zinc-200">{stats.columns}</span>
                      </>
                    )}
                    {stats.comments > 0 && (
                      <>
                        <span className="text-zinc-400">Comments:</span>
                        <span className="text-zinc-200">{stats.comments}</span>
                      </>
                    )}
                    {stats.attachments > 0 && (
                      <>
                        <span className="text-zinc-400">Attachments:</span>
                        <span className="text-zinc-200">{stats.attachments}</span>
                      </>
                    )}
                  </div>
                ) : null}
              </div>

              {/* Export options */}
              <div className="bg-zinc-800 rounded-lg p-4 space-y-2">
                <p className="text-sm font-medium text-zinc-300">Export options:</p>
                <div className="space-y-1.5 text-sm">
                  <div className="flex items-center gap-2 text-zinc-400">
                    {willBeZip ? (
                      <>
                        <Archive className="h-4 w-4 text-blue-400" />
                        <span className="text-zinc-200">ZIP archive</span>
                      </>
                    ) : (
                      <>
                        <Archive className="h-4 w-4" />
                        <span>JSON file</span>
                      </>
                    )}
                  </div>
                  <div className="flex items-center gap-2 text-zinc-400">
                    {exportOptions.includeAttachments ? (
                      <>
                        <Paperclip className="h-4 w-4 text-green-400" />
                        <span className="text-zinc-200">Including attachments</span>
                      </>
                    ) : (
                      <>
                        <Paperclip className="h-4 w-4" />
                        <span>No attachments</span>
                      </>
                    )}
                  </div>
                  <div className="flex items-center gap-2 text-zinc-400">
                    {exportOptions.includeAvatars ? (
                      <>
                        <FileImage className="h-4 w-4 text-green-400" />
                        <span className="text-zinc-200">Including profile pictures</span>
                      </>
                    ) : (
                      <>
                        <FileImage className="h-4 w-4" />
                        <span>No profile pictures</span>
                      </>
                    )}
                  </div>
                  <div className="flex items-center gap-2 text-zinc-400">
                    {exportOptions.password ? (
                      <>
                        <Lock className="h-4 w-4 text-amber-400" />
                        <span className="text-zinc-200">Encrypted with password</span>
                      </>
                    ) : (
                      <>
                        <Lock className="h-4 w-4" />
                        <span>Not encrypted</span>
                      </>
                    )}
                  </div>
                </div>
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={handleClose}>
                Cancel
              </Button>
              <Button variant="primary" onClick={() => setShowReauthDialog(true)}>
                Continue
                <ChevronRight className="h-4 w-4" />
              </Button>
            </DialogFooter>
          </>
        )}

        {/* Step 2: Exporting */}
        {step === 'exporting' && (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Loader2 className="h-5 w-5 animate-spin text-amber-500" />
                Exporting Database
              </DialogTitle>
              <DialogDescription>Please wait while the backup is being created.</DialogDescription>
            </DialogHeader>

            <div className="py-8 flex flex-col items-center justify-center gap-4">
              <Loader2 className="h-12 w-12 animate-spin text-amber-500" />
              <p className="text-sm text-zinc-400">
                {willBeZip ? 'Creating ZIP archive with files...' : 'Creating JSON backup...'}
              </p>
            </div>
          </>
        )}
      </DialogContent>

      <ReauthDialog
        open={showReauthDialog}
        onOpenChange={setShowReauthDialog}
        title="Confirm Database Export"
        description="Enter your password to authorize the database export."
        actionLabel="Export Database"
        onConfirm={handleReauthConfirm}
      />
    </Dialog>
  )
}

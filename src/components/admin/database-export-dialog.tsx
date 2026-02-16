'use client'

import {
  Archive,
  ChevronRight,
  Download,
  Eye,
  EyeOff,
  FileImage,
  Loader2,
  Lock,
  Paperclip,
  Shield,
} from 'lucide-react'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  type ExportOptions,
  useDatabaseStats,
  useExportDatabase,
} from '@/hooks/queries/use-database-backup'

interface DatabaseExportDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  exportOptions: Omit<ExportOptions, 'confirmPassword'>
  onComplete: () => void
}

type Step = 'summary' | 'credentials' | 'exporting'

export function DatabaseExportDialog({
  open,
  onOpenChange,
  exportOptions,
  onComplete,
}: DatabaseExportDialogProps) {
  const [step, setStep] = useState<Step>('summary')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)

  const { data: stats, isLoading: statsLoading } = useDatabaseStats()
  const exportMutation = useExportDatabase()

  const handleClose = () => {
    if (exportMutation.isPending) return
    setStep('summary')
    setConfirmPassword('')
    setShowPassword(false)
    onOpenChange(false)
  }

  const handleExport = async () => {
    setStep('exporting')
    try {
      await exportMutation.mutateAsync({
        ...exportOptions,
        confirmPassword,
      })
      handleClose()
      onComplete()
    } catch {
      setStep('credentials')
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
              <Button variant="primary" onClick={() => setStep('credentials')}>
                Continue
                <ChevronRight className="h-4 w-4" />
              </Button>
            </DialogFooter>
          </>
        )}

        {/* Step 2: Credentials */}
        {step === 'credentials' && (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Shield className="h-5 w-5 text-amber-500" />
                Verify Your Identity
              </DialogTitle>
              <DialogDescription>
                Enter your password to authorize the database export.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="confirmPassword" className="text-zinc-300">
                  Your Password
                </Label>
                <div className="relative">
                  <Input
                    id="confirmPassword"
                    name="admin-confirm-password"
                    type="text"
                    autoComplete="off"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && confirmPassword) {
                        e.preventDefault()
                        handleExport()
                      }
                    }}
                    placeholder="Enter your password"
                    className={`bg-zinc-800 border-zinc-700 text-zinc-100 pr-10 ${!showPassword ? 'password-mask' : ''}`}
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
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setStep('summary')}>
                Back
              </Button>
              <Button variant="primary" onClick={handleExport} disabled={!confirmPassword}>
                <Download className="h-4 w-4" />
                Export Database
              </Button>
            </DialogFooter>
          </>
        )}

        {/* Step 3: Exporting */}
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
    </Dialog>
  )
}

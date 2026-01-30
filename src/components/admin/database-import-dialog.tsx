'use client'

import {
  AlertTriangle,
  Archive,
  Check,
  ChevronRight,
  Eye,
  EyeOff,
  FileWarning,
  Loader2,
  Lock,
  Shield,
  Trash2,
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
import { type ImportDatabaseParams, useImportDatabase } from '@/hooks/queries/use-database-backup'
import type { ImportResult } from '@/lib/database-import'

interface DatabaseImportDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  fileContent: string // Base64 encoded
  isZip: boolean
  isEncrypted: boolean
  onComplete: () => void
}

type Step = 'warning' | 'credentials' | 'confirm' | 'importing' | 'success' | 'error'

const REQUIRED_CONFIRMATION = 'DELETE ALL DATA'

export function DatabaseImportDialog({
  open,
  onOpenChange,
  fileContent,
  isZip,
  isEncrypted: initialIsEncrypted,
  onComplete,
}: DatabaseImportDialogProps) {
  const [step, setStep] = useState<Step>('warning')
  const [decryptionPassword, setDecryptionPassword] = useState('')
  const [showDecryptionPassword, setShowDecryptionPassword] = useState(false)
  const [needsPassword, setNeedsPassword] = useState(initialIsEncrypted)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [confirmText, setConfirmText] = useState('')
  const [result, setResult] = useState<ImportResult | null>(null)
  const [error, setError] = useState<string | null>(null)

  const importMutation = useImportDatabase()

  const handleNext = () => {
    if (step === 'warning') {
      setStep('credentials')
    } else if (step === 'credentials') {
      setStep('confirm')
    }
  }

  const handleBack = () => {
    if (step === 'credentials') {
      setStep('warning')
    } else if (step === 'confirm') {
      setStep('credentials')
    }
  }

  const handleImport = async () => {
    if (confirmText !== REQUIRED_CONFIRMATION) return

    setStep('importing')
    setError(null)

    try {
      const params: ImportDatabaseParams = {
        content: fileContent,
        decryptionPassword: needsPassword ? decryptionPassword : undefined,
        email,
        password,
        confirmText,
      }

      const importResult = await importMutation.mutateAsync(params)
      setResult(importResult)
      setStep('success')
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Import failed'
      // Check if it's an encryption error
      if (errorMessage.includes('encrypted') || errorMessage.includes('password')) {
        setNeedsPassword(true)
        setStep('warning')
        setError(errorMessage)
      } else {
        setError(errorMessage)
        setStep('error')
      }
    }
  }

  const handleClose = () => {
    if (step === 'importing') return // Don't allow closing during import

    onOpenChange(false)

    if (step === 'success') {
      onComplete()
      // Reload the page to reflect new data
      window.location.href = '/admin/settings?tab=database'
    }

    // Reset state
    setStep('warning')
    setDecryptionPassword('')
    setEmail('')
    setPassword('')
    setConfirmText('')
    setResult(null)
    setError(null)
    setNeedsPassword(initialIsEncrypted)
  }

  const isConfirmValid = confirmText === REQUIRED_CONFIRMATION

  const totalFilesRestored = result
    ? result.files.attachmentsRestored + result.files.avatarsRestored
    : 0
  const totalFilesMissing = result
    ? result.files.attachmentsMissing + result.files.avatarsMissing
    : 0

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md" showCloseButton={step !== 'importing'}>
        {/* Step 1: Warning */}
        {step === 'warning' && (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-red-400">
                <AlertTriangle className="h-5 w-5" />
                Danger Zone
              </DialogTitle>
              <DialogDescription>
                You are about to import a database backup. Please read carefully.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-4">
              {error && (
                <div className="p-3 bg-red-900/30 border border-red-800 rounded-lg">
                  <p className="text-sm text-red-300">{error}</p>
                </div>
              )}

              <div className="p-4 bg-red-900/20 border border-red-800 rounded-lg space-y-2">
                <p className="text-sm text-red-300 font-medium">This action will:</p>
                <ul className="text-sm text-red-300/80 space-y-1 ml-4 list-disc">
                  <li>Permanently delete ALL existing data</li>
                  <li>Replace it with data from the backup file</li>
                  <li>Log out all users (sessions will be invalidated)</li>
                  <li>Cannot be undone</li>
                </ul>
              </div>

              {isZip && (
                <div className="flex items-center gap-2 text-sm text-blue-400">
                  <Archive className="h-4 w-4" />
                  This backup includes files (attachments and/or avatars)
                </div>
              )}

              {(needsPassword || initialIsEncrypted) && (
                <div className="space-y-2">
                  <Label htmlFor="decryptionPassword" className="text-zinc-300">
                    Backup Password
                  </Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-500" />
                    <Input
                      id="decryptionPassword"
                      type="text"
                      value={decryptionPassword}
                      onChange={(e) => setDecryptionPassword(e.target.value)}
                      placeholder="Enter the backup encryption password"
                      className={`bg-zinc-800 border-zinc-700 text-zinc-100 pl-10 pr-10 ${!showDecryptionPassword ? 'password-mask' : ''}`}
                    />
                    <button
                      type="button"
                      onClick={() => setShowDecryptionPassword(!showDecryptionPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300"
                    >
                      {showDecryptionPassword ? (
                        <EyeOff className="h-4 w-4" />
                      ) : (
                        <Eye className="h-4 w-4" />
                      )}
                    </button>
                  </div>
                </div>
              )}
            </div>

            <DialogFooter className="gap-2 sm:gap-0">
              <Button variant="outline" onClick={handleClose}>
                Cancel
              </Button>
              <Button
                variant="destructive"
                onClick={handleNext}
                disabled={needsPassword && !decryptionPassword}
              >
                I Understand
                <ChevronRight className="h-4 w-4" />
              </Button>
            </DialogFooter>
          </>
        )}

        {/* Step 2: Credential Verification */}
        {step === 'credentials' && (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Shield className="h-5 w-5 text-amber-500" />
                Verify Your Identity
              </DialogTitle>
              <DialogDescription>
                Re-enter your admin credentials to confirm this action.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="email" className="text-zinc-300">
                  Email
                </Label>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="your@email.com"
                  className="bg-zinc-800 border-zinc-700 text-zinc-100"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="password" className="text-zinc-300">
                  Password
                </Label>
                <div className="relative">
                  <Input
                    id="password"
                    type="text"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Your password"
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

            <DialogFooter className="gap-2 sm:gap-0">
              <Button variant="outline" onClick={handleBack}>
                Back
              </Button>
              <Button variant="destructive" onClick={handleNext} disabled={!email || !password}>
                Continue
                <ChevronRight className="h-4 w-4" />
              </Button>
            </DialogFooter>
          </>
        )}

        {/* Step 3: Type Confirmation */}
        {step === 'confirm' && (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-red-400">
                <Trash2 className="h-5 w-5" />
                Final Confirmation
              </DialogTitle>
              <DialogDescription>
                Type <span className="font-mono text-red-400">{REQUIRED_CONFIRMATION}</span> to
                proceed.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="confirmText" className="text-zinc-300">
                  Type the confirmation text
                </Label>
                <Input
                  id="confirmText"
                  type="text"
                  value={confirmText}
                  onChange={(e) => setConfirmText(e.target.value)}
                  placeholder={REQUIRED_CONFIRMATION}
                  className="bg-zinc-800 border-zinc-700 text-zinc-100 font-mono"
                  autoComplete="off"
                />
                {confirmText && !isConfirmValid && (
                  <p className="text-xs text-red-400">Text does not match</p>
                )}
              </div>
            </div>

            <DialogFooter className="gap-2 sm:gap-0">
              <Button variant="outline" onClick={handleBack}>
                Back
              </Button>
              <Button variant="destructive" onClick={handleImport} disabled={!isConfirmValid}>
                <Trash2 className="h-4 w-4" />
                Import and Replace All Data
              </Button>
            </DialogFooter>
          </>
        )}

        {/* Step 4: Importing */}
        {step === 'importing' && (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Loader2 className="h-5 w-5 animate-spin text-amber-500" />
                Importing Database
              </DialogTitle>
              <DialogDescription>
                Please wait while the backup is being imported. This may take a while for large
                backups.
              </DialogDescription>
            </DialogHeader>

            <div className="py-8 flex flex-col items-center justify-center gap-4">
              <Loader2 className="h-12 w-12 animate-spin text-amber-500" />
              <p className="text-sm text-zinc-400">Do not close this window...</p>
            </div>
          </>
        )}

        {/* Step 5: Success */}
        {step === 'success' && result && (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-green-400">
                <Check className="h-5 w-5" />
                Import Complete
              </DialogTitle>
              <DialogDescription>
                The database has been successfully restored from the backup.
              </DialogDescription>
            </DialogHeader>

            <div className="py-4 space-y-4">
              <div className="bg-zinc-800 rounded-lg p-4 space-y-2">
                <p className="text-sm font-medium text-zinc-300">Records imported:</p>
                <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
                  {result.counts.users > 0 && (
                    <>
                      <span className="text-zinc-400">Users:</span>
                      <span className="text-zinc-200">{result.counts.users}</span>
                    </>
                  )}
                  {result.counts.projects > 0 && (
                    <>
                      <span className="text-zinc-400">Projects:</span>
                      <span className="text-zinc-200">{result.counts.projects}</span>
                    </>
                  )}
                  {result.counts.tickets > 0 && (
                    <>
                      <span className="text-zinc-400">Tickets:</span>
                      <span className="text-zinc-200">{result.counts.tickets}</span>
                    </>
                  )}
                  {result.counts.sprints > 0 && (
                    <>
                      <span className="text-zinc-400">Sprints:</span>
                      <span className="text-zinc-200">{result.counts.sprints}</span>
                    </>
                  )}
                  {result.counts.labels > 0 && (
                    <>
                      <span className="text-zinc-400">Labels:</span>
                      <span className="text-zinc-200">{result.counts.labels}</span>
                    </>
                  )}
                  {result.counts.comments > 0 && (
                    <>
                      <span className="text-zinc-400">Comments:</span>
                      <span className="text-zinc-200">{result.counts.comments}</span>
                    </>
                  )}
                  {result.counts.attachments > 0 && (
                    <>
                      <span className="text-zinc-400">Attachments:</span>
                      <span className="text-zinc-200">{result.counts.attachments}</span>
                    </>
                  )}
                </div>
              </div>

              {/* Files Summary */}
              {(totalFilesRestored > 0 || totalFilesMissing > 0) && (
                <div className="bg-zinc-800 rounded-lg p-4 space-y-2">
                  <p className="text-sm font-medium text-zinc-300">Files:</p>
                  <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
                    {result.files.attachmentsRestored > 0 && (
                      <>
                        <span className="text-zinc-400">Attachments restored:</span>
                        <span className="text-green-400">{result.files.attachmentsRestored}</span>
                      </>
                    )}
                    {result.files.avatarsRestored > 0 && (
                      <>
                        <span className="text-zinc-400">Avatars restored:</span>
                        <span className="text-green-400">{result.files.avatarsRestored}</span>
                      </>
                    )}
                  </div>
                </div>
              )}

              {/* Missing Files Warning */}
              {totalFilesMissing > 0 && (
                <div className="p-3 bg-amber-900/20 border border-amber-800 rounded-lg">
                  <div className="flex items-start gap-2">
                    <FileWarning className="h-4 w-4 text-amber-400 flex-shrink-0 mt-0.5" />
                    <div className="text-sm">
                      <p className="font-medium text-amber-400">
                        {totalFilesMissing} file{totalFilesMissing > 1 ? 's' : ''} missing from
                        backup
                      </p>
                      <p className="text-amber-300/70 mt-1">
                        Some files referenced in the backup were not included. Affected attachments
                        or profile pictures will show as broken.
                      </p>
                      {result.files.missingFiles.length > 0 &&
                        result.files.missingFiles.length <= 5 && (
                          <ul className="mt-2 text-xs text-amber-300/60 space-y-0.5">
                            {result.files.missingFiles.map((file) => (
                              <li key={file} className="truncate">
                                {file}
                              </li>
                            ))}
                          </ul>
                        )}
                      {result.files.missingFiles.length > 5 && (
                        <p className="mt-2 text-xs text-amber-300/60">
                          And {result.files.missingFiles.length - 5} more...
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              )}

              <p className="text-sm text-amber-500">You will be redirected to log in again.</p>
            </div>

            <DialogFooter>
              <Button variant="primary" onClick={handleClose}>
                <Check className="h-4 w-4" />
                Done
              </Button>
            </DialogFooter>
          </>
        )}

        {/* Step 6: Error */}
        {step === 'error' && (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-red-400">
                <AlertTriangle className="h-5 w-5" />
                Import Failed
              </DialogTitle>
              <DialogDescription>
                The import could not be completed. Your existing data has not been modified.
              </DialogDescription>
            </DialogHeader>

            <div className="py-4">
              <div className="p-4 bg-red-900/20 border border-red-800 rounded-lg">
                <p className="text-sm text-red-300">{error}</p>
              </div>
            </div>

            <DialogFooter className="gap-2 sm:gap-0">
              <Button variant="outline" onClick={handleClose}>
                Close
              </Button>
              <Button variant="destructive" onClick={() => setStep('warning')}>
                Try Again
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}

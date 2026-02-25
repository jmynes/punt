'use client'

import {
  AlertTriangle,
  Archive,
  Check,
  ChevronRight,
  Eye,
  EyeOff,
  FileImage,
  FileWarning,
  Loader2,
  Lock,
  Paperclip,
  Shield,
  Trash2,
} from 'lucide-react'
import { signOut } from 'next-auth/react'
import { useEffect, useRef, useState } from 'react'
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
  type ImportDatabaseParams,
  type ImportPreview,
  useImportDatabase,
  usePreviewDatabase,
} from '@/hooks/queries/use-database-backup'
import { suppressDatabaseWipeSignOut } from '@/hooks/use-realtime-projects'
import type { ImportResult } from '@/lib/database-import'

interface DatabaseImportDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  fileContent: string // Base64 encoded
  // isZip is kept for backwards compatibility but no longer used
  // (preview response includes this info)
  isZip?: boolean
  isEncrypted: boolean
  onComplete: () => void
}

type Step =
  | 'loading'
  | 'preview'
  | 'warning'
  | 'credentials'
  | 'confirm'
  | 'importing'
  | 'success'
  | 'error'

const REQUIRED_CONFIRMATION = 'DELETE ALL DATA'

export function DatabaseImportDialog({
  open,
  onOpenChange,
  fileContent,
  isEncrypted: initialIsEncrypted,
  onComplete,
}: DatabaseImportDialogProps) {
  const [step, setStep] = useState<Step>('loading')
  const [decryptionPassword, setDecryptionPassword] = useState('')
  const [showDecryptionPassword, setShowDecryptionPassword] = useState(false)
  const [needsPassword, setNeedsPassword] = useState(initialIsEncrypted)
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [confirmText, setConfirmText] = useState('')
  const [preview, setPreview] = useState<ImportPreview | null>(null)
  const [result, setResult] = useState<ImportResult | null>(null)
  const [error, setError] = useState<string | null>(null)

  const previewMutation = usePreviewDatabase()
  const importMutation = useImportDatabase()
  const [verifying, setVerifying] = useState(false)
  const [credentialError, setCredentialError] = useState<string | null>(null)

  // Use refs to prevent infinite re-renders from mutation state changes
  const isLoadingRef = useRef(false)
  const previewMutateRef = useRef(previewMutation.mutateAsync)
  previewMutateRef.current = previewMutation.mutateAsync

  // Load preview when dialog opens or when retrying with password
  useEffect(() => {
    if (!open || step !== 'loading') {
      isLoadingRef.current = false
      return
    }

    // Prevent duplicate calls
    if (isLoadingRef.current) return
    isLoadingRef.current = true

    let cancelled = false

    const loadPreview = async () => {
      setError(null)
      try {
        const previewResult = await previewMutateRef.current({
          content: fileContent,
          decryptionPassword: needsPassword ? decryptionPassword : undefined,
        })
        if (cancelled) return
        setPreview(previewResult)
        setStep('preview')
      } catch (err) {
        if (cancelled) return
        const errorMessage = err instanceof Error ? err.message : 'Failed to preview backup'
        // Check if it's an encryption error
        if (errorMessage.includes('encrypted') || errorMessage.includes('password')) {
          setNeedsPassword(true)
          setStep('preview') // Show preview step with password input
          setError(errorMessage)
        } else {
          setError(errorMessage)
          setStep('error')
        }
      } finally {
        if (!cancelled) {
          isLoadingRef.current = false
        }
      }
    }

    loadPreview()

    return () => {
      cancelled = true
      isLoadingRef.current = false
    }
  }, [open, step, fileContent, needsPassword, decryptionPassword])

  const handleRetryPreview = () => {
    if (!decryptionPassword && needsPassword) return
    setStep('loading') // useEffect will trigger loadPreview when step is 'loading'
  }

  const handleNext = async () => {
    if (step === 'preview') {
      setStep('warning')
    } else if (step === 'warning') {
      setStep('credentials')
    } else if (step === 'credentials') {
      setVerifying(true)
      setCredentialError(null)
      try {
        const res = await fetch('/api/auth/verify-credentials', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username, password }),
        })
        if (!res.ok) {
          const data = await res.json()
          setCredentialError(data.error || 'Invalid credentials')
          return
        }
        setStep('confirm')
      } catch {
        setCredentialError('Failed to verify credentials')
      } finally {
        setVerifying(false)
      }
    }
  }

  const handleBack = () => {
    if (step === 'warning') {
      setStep('preview')
    } else if (step === 'credentials') {
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
        username,
        password,
        confirmText,
      }

      // Suppress SSE-triggered sign-out so the success modal stays visible
      suppressDatabaseWipeSignOut(true)
      const importResult = await importMutation.mutateAsync(params)
      setResult(importResult)
      setStep('success')
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Import failed'
      // Check if it's an encryption error
      if (errorMessage.includes('encrypted') || errorMessage.includes('password')) {
        setNeedsPassword(true)
        setStep('preview')
        setError(errorMessage)
      } else {
        setError(errorMessage)
        setStep('error')
      }
    }
  }

  const handleClose = () => {
    if (step === 'importing' || step === 'loading') return // Don't allow closing during import/loading

    if (step === 'success') {
      onOpenChange(false)
      onComplete()
      // Sign out to clear the session cookie and redirect to login
      // The imported database has different users, so current session is invalid
      signOut({ callbackUrl: '/login' })
      return
    }

    onOpenChange(false)

    // Reset state
    setStep('loading')
    setDecryptionPassword('')
    setUsername('')
    setPassword('')
    setConfirmText('')
    setPreview(null)
    setResult(null)
    setError(null)
    setCredentialError(null)
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
      <DialogContent
        className="sm:max-w-md"
        showCloseButton={step !== 'importing' && step !== 'loading' && step !== 'success'}
      >
        {/* Step 0: Loading Preview */}
        {step === 'loading' && (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Loader2 className="h-5 w-5 animate-spin text-amber-500" />
                Analyzing Backup
              </DialogTitle>
              <DialogDescription>Parsing and validating the backup file...</DialogDescription>
            </DialogHeader>

            <div className="py-8 flex flex-col items-center justify-center gap-4">
              <Loader2 className="h-12 w-12 animate-spin text-amber-500" />
              <p className="text-sm text-zinc-400">This may take a moment for large backups...</p>
            </div>
          </>
        )}

        {/* Step 1: Preview */}
        {step === 'preview' && (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Archive className="h-5 w-5 text-blue-400" />
                Import Preview
              </DialogTitle>
              <DialogDescription>
                Review what will be imported from this backup file.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-4">
              {error && (
                <div className="p-3 bg-red-900/30 border border-red-800 rounded-lg">
                  <p className="text-sm text-red-300">{error}</p>
                </div>
              )}

              {/* Password input if needed */}
              {needsPassword && !preview && (
                <div className="space-y-2">
                  <Label htmlFor="decryptionPassword" className="text-zinc-300">
                    Backup Password
                  </Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-500" />
                    <Input
                      id="decryptionPassword"
                      name="backup-decryption-password"
                      type="text"
                      autoComplete="off"
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

              {/* Preview data */}
              {preview && (
                <>
                  <div className="bg-zinc-800 rounded-lg p-4 space-y-3">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-zinc-400">Exported:</span>
                      <span className="text-zinc-200">
                        {new Date(preview.exportedAt).toLocaleString()}
                      </span>
                    </div>
                    {preview.isZip && (
                      <div className="flex items-center gap-2 text-sm text-blue-400">
                        <Archive className="h-4 w-4" />
                        ZIP archive with files
                      </div>
                    )}
                    {preview.includesAttachments && (
                      <div className="flex items-center gap-2 text-sm text-green-400">
                        <Paperclip className="h-4 w-4" />
                        Includes ticket attachments
                      </div>
                    )}
                    {preview.includesAvatars && (
                      <div className="flex items-center gap-2 text-sm text-green-400">
                        <FileImage className="h-4 w-4" />
                        Includes profile pictures
                      </div>
                    )}
                  </div>

                  <div className="bg-zinc-800 rounded-lg p-4 space-y-2">
                    <p className="text-sm font-medium text-zinc-300">Records to import:</p>
                    <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
                      {preview.counts.users > 0 && (
                        <>
                          <span className="text-zinc-400">Users:</span>
                          <span className="text-zinc-200">{preview.counts.users}</span>
                        </>
                      )}
                      {preview.counts.projects > 0 && (
                        <>
                          <span className="text-zinc-400">Projects:</span>
                          <span className="text-zinc-200">{preview.counts.projects}</span>
                        </>
                      )}
                      {preview.counts.tickets > 0 && (
                        <>
                          <span className="text-zinc-400">Tickets:</span>
                          <span className="text-zinc-200">{preview.counts.tickets}</span>
                        </>
                      )}
                      {preview.counts.sprints > 0 && (
                        <>
                          <span className="text-zinc-400">Sprints:</span>
                          <span className="text-zinc-200">{preview.counts.sprints}</span>
                        </>
                      )}
                      {preview.counts.labels > 0 && (
                        <>
                          <span className="text-zinc-400">Labels:</span>
                          <span className="text-zinc-200">{preview.counts.labels}</span>
                        </>
                      )}
                      {preview.counts.columns > 0 && (
                        <>
                          <span className="text-zinc-400">Columns:</span>
                          <span className="text-zinc-200">{preview.counts.columns}</span>
                        </>
                      )}
                      {preview.counts.comments > 0 && (
                        <>
                          <span className="text-zinc-400">Comments:</span>
                          <span className="text-zinc-200">{preview.counts.comments}</span>
                        </>
                      )}
                      {preview.counts.attachments > 0 && (
                        <>
                          <span className="text-zinc-400">Attachments:</span>
                          <span className="text-zinc-200">{preview.counts.attachments}</span>
                        </>
                      )}
                    </div>
                  </div>
                </>
              )}
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={handleClose}>
                Cancel
              </Button>
              {needsPassword && !preview ? (
                <Button
                  variant="primary"
                  onClick={handleRetryPreview}
                  disabled={!decryptionPassword || previewMutation.isPending}
                >
                  {previewMutation.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                  Decrypt & Preview
                </Button>
              ) : (
                <Button variant="destructive" onClick={handleNext} disabled={!preview}>
                  Continue to Import
                  <ChevronRight className="h-4 w-4" />
                </Button>
              )}
            </DialogFooter>
          </>
        )}

        {/* Step 2: Warning */}
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
              <div className="p-4 bg-red-900/20 border border-red-800 rounded-lg space-y-2">
                <p className="text-sm text-red-300 font-medium">This action will:</p>
                <ul className="text-sm text-red-300/80 space-y-1 ml-4 list-disc">
                  <li>Permanently delete ALL existing data</li>
                  <li>Replace it with data from the backup file</li>
                  <li>Log out all users (sessions will be invalidated)</li>
                  <li>Cannot be undone</li>
                </ul>
              </div>

              {preview && (
                <div className="bg-zinc-800 rounded-lg p-3 text-sm">
                  <span className="text-zinc-400">Importing: </span>
                  <span className="text-zinc-200">
                    {preview.counts.users} users, {preview.counts.projects} projects,{' '}
                    {preview.counts.tickets} tickets
                  </span>
                </div>
              )}
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={handleBack}>
                Back
              </Button>
              <Button variant="destructive" onClick={handleNext}>
                I Understand
                <ChevronRight className="h-4 w-4" />
              </Button>
            </DialogFooter>
          </>
        )}

        {/* Step 3: Credential Verification */}
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
                <Label htmlFor="username" className="text-zinc-300">
                  Username
                </Label>
                <Input
                  id="username"
                  name="admin-verify-username"
                  type="text"
                  autoComplete="off"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && username && password && !verifying) {
                      e.preventDefault()
                      handleNext()
                    }
                  }}
                  placeholder="Your username"
                  className="bg-zinc-800 border-zinc-700 text-zinc-100"
                />
              </div>

              {credentialError && (
                <div className="p-3 bg-red-900/30 border border-red-800 rounded-lg">
                  <p className="text-sm text-red-300">{credentialError}</p>
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="password" className="text-zinc-300">
                  Password
                </Label>
                <div className="relative">
                  <Input
                    id="password"
                    name="admin-verify-password"
                    type="text"
                    autoComplete="off"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && username && password && !verifying) {
                        e.preventDefault()
                        handleNext()
                      }
                    }}
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

            <DialogFooter>
              <Button variant="outline" onClick={handleBack}>
                Back
              </Button>
              <Button
                variant="destructive"
                onClick={handleNext}
                disabled={!username || !password || verifying}
              >
                {verifying ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                Continue
                <ChevronRight className="h-4 w-4" />
              </Button>
            </DialogFooter>
          </>
        )}

        {/* Step 4: Type Confirmation */}
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

            <DialogFooter>
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

        {/* Step 5: Importing */}
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

        {/* Step 6: Success */}
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

              <p className="text-sm text-amber-500">
                You will be signed out when you close this dialog.
              </p>
            </div>

            <DialogFooter>
              <Button variant="primary" onClick={handleClose}>
                <Check className="h-4 w-4" />
                Done
              </Button>
            </DialogFooter>
          </>
        )}

        {/* Step 7: Error */}
        {step === 'error' && (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-red-400">
                <AlertTriangle className="h-5 w-5" />
                {preview ? 'Import Failed' : 'Preview Failed'}
              </DialogTitle>
              <DialogDescription>
                {preview
                  ? 'The import could not be completed. Your existing data has not been modified.'
                  : 'Could not parse the backup file.'}
              </DialogDescription>
            </DialogHeader>

            <div className="py-4">
              <div className="p-4 bg-red-900/20 border border-red-800 rounded-lg">
                <p className="text-sm text-red-300">{error}</p>
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={handleClose}>
                Close
              </Button>
              <Button
                variant="destructive"
                onClick={() => setStep(preview ? 'warning' : 'loading')}
              >
                Try Again
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}

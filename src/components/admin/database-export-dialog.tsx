'use client'

import { Download, Eye, EyeOff, Loader2, Shield } from 'lucide-react'
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
import { type ExportOptions, useExportDatabase } from '@/hooks/queries/use-database-backup'

interface DatabaseExportDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  exportOptions: Omit<ExportOptions, 'confirmPassword'>
  onComplete: () => void
}

export function DatabaseExportDialog({
  open,
  onOpenChange,
  exportOptions,
  onComplete,
}: DatabaseExportDialogProps) {
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)

  const exportMutation = useExportDatabase()

  const handleClose = () => {
    if (exportMutation.isPending) return
    setConfirmPassword('')
    setShowPassword(false)
    onOpenChange(false)
  }

  const handleExport = async () => {
    try {
      await exportMutation.mutateAsync({
        ...exportOptions,
        confirmPassword,
      })
      handleClose()
      onComplete()
    } catch {
      // Error is shown via toast
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md" showCloseButton={!exportMutation.isPending}>
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
                placeholder="Enter your password"
                className={`bg-zinc-800 border-zinc-700 text-zinc-100 pr-10 ${!showPassword ? 'password-mask' : ''}`}
                disabled={exportMutation.isPending}
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
          <Button variant="outline" onClick={handleClose} disabled={exportMutation.isPending}>
            Cancel
          </Button>
          <Button
            variant="primary"
            onClick={handleExport}
            disabled={!confirmPassword || exportMutation.isPending}
          >
            {exportMutation.isPending ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Exporting...
              </>
            ) : (
              <>
                <Download className="h-4 w-4" />
                Export Database
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

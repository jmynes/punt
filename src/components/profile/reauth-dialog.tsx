'use client'

import { Eye, EyeOff, Loader2 } from 'lucide-react'
import { useEffect, useState } from 'react'
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
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

interface ReauthDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  description: string
  actionLabel: string
  actionVariant?: 'default' | 'destructive'
  onConfirm: (password: string, totpCode?: string, isRecoveryCode?: boolean) => Promise<void>
}

export function ReauthDialog({
  open,
  onOpenChange,
  title,
  description,
  actionLabel,
  actionVariant = 'default',
  onConfirm,
}: ReauthDialogProps) {
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [totpCode, setTotpCode] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [requires2fa, setRequires2fa] = useState(false)
  const [useRecoveryCode, setUseRecoveryCode] = useState(false)

  // Reset state when dialog closes
  useEffect(() => {
    if (!open) {
      setPassword('')
      setShowPassword(false)
      setTotpCode('')
      setError(null)
      setRequires2fa(false)
      setUseRecoveryCode(false)
    }
  }, [open])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setLoading(true)

    try {
      await onConfirm(password, totpCode || undefined, useRecoveryCode || undefined)
      onOpenChange(false)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'An error occurred'
      // Check if 2FA is required
      if (message.includes('2FA') || message.includes('requires2fa')) {
        setRequires2fa(true)
        setError('Please enter your 2FA code')
      } else {
        setError(message)
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="bg-zinc-900 border-zinc-800">
        <form onSubmit={handleSubmit}>
          <AlertDialogHeader>
            <AlertDialogTitle className="text-zinc-100">{title}</AlertDialogTitle>
            <AlertDialogDescription className="text-zinc-400">{description}</AlertDialogDescription>
          </AlertDialogHeader>

          <div className="space-y-4 py-4">
            {/* Password field */}
            <div className="space-y-2">
              <Label htmlFor="reauth-password" className="text-zinc-300">
                Password
              </Label>
              <div className="relative">
                <Input
                  id="reauth-password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="bg-zinc-800 border-zinc-700 text-zinc-100 pr-10"
                  placeholder="Enter your password"
                  autoComplete="current-password"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-200"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            {/* 2FA code field - shown if required */}
            {requires2fa && (
              <div className="space-y-2">
                <Label htmlFor="reauth-totp" className="text-zinc-300">
                  {useRecoveryCode ? 'Recovery Code' : '2FA Code'}
                </Label>
                <Input
                  id="reauth-totp"
                  type="text"
                  inputMode={useRecoveryCode ? 'text' : 'numeric'}
                  maxLength={useRecoveryCode ? 11 : 6}
                  value={totpCode}
                  onChange={(e) =>
                    setTotpCode(
                      useRecoveryCode ? e.target.value : e.target.value.replace(/\D/g, ''),
                    )
                  }
                  className="bg-zinc-800 border-zinc-700 text-zinc-100 font-mono"
                  placeholder={useRecoveryCode ? 'XXXXX-XXXXX' : 'Enter 6-digit code'}
                  autoComplete="one-time-code"
                  autoFocus
                />
                <button
                  type="button"
                  onClick={() => {
                    setUseRecoveryCode(!useRecoveryCode)
                    setTotpCode('')
                    setError(null)
                  }}
                  className="text-xs text-amber-500 hover:text-amber-400 font-medium transition-colors"
                >
                  {useRecoveryCode ? 'Use authenticator app instead' : 'Use a recovery code'}
                </button>
              </div>
            )}

            {/* Error message */}
            {error && !requires2fa && <p className="text-sm text-red-400">{error}</p>}
          </div>

          <AlertDialogFooter>
            <AlertDialogCancel
              type="button"
              className="border-zinc-700 text-zinc-300 hover:bg-zinc-800"
              disabled={loading}
            >
              Cancel
            </AlertDialogCancel>
            <Button
              type="submit"
              disabled={loading || !password}
              className={
                actionVariant === 'destructive'
                  ? 'bg-red-600 hover:bg-red-700 text-white'
                  : 'bg-amber-600 hover:bg-amber-700 text-white'
              }
            >
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {actionLabel}
            </Button>
          </AlertDialogFooter>
        </form>
      </AlertDialogContent>
    </AlertDialog>
  )
}

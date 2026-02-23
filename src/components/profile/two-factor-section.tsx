'use client'

import {
  Check,
  Copy,
  Download,
  Eye,
  EyeOff,
  Loader2,
  RefreshCw,
  Shield,
  ShieldCheck,
  ShieldOff,
} from 'lucide-react'
import { useCallback, useState } from 'react'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { showToast } from '@/lib/toast'

type SetupStep = 'idle' | 'qr' | 'verify' | 'codes' | 'complete' | 'regenerating'

interface TwoFactorSectionProps {
  isDemo: boolean
}

export function TwoFactorSection({ isDemo }: TwoFactorSectionProps) {
  // 2FA status
  const [enabled, setEnabled] = useState<boolean | null>(null)
  const [recoveryCodesRemaining, setRecoveryCodesRemaining] = useState(0)
  const [statusLoading, setStatusLoading] = useState(true)

  // Setup state
  const [setupStep, setSetupStep] = useState<SetupStep>('idle')
  const [qrCodeUrl, setQrCodeUrl] = useState('')
  const [manualEntryKey, setManualEntryKey] = useState('')
  const [verifyCode, setVerifyCode] = useState('')
  const [recoveryCodes, setRecoveryCodes] = useState<string[]>([])
  const [codesAcknowledged, setCodesAcknowledged] = useState(false)
  const [copiedCodes, setCopiedCodes] = useState(false)
  const [setupLoading, setSetupLoading] = useState(false)

  // Disable state
  const [showDisableDialog, setShowDisableDialog] = useState(false)
  const [disablePassword, setDisablePassword] = useState('')
  const [showDisablePassword, setShowDisablePassword] = useState(false)
  const [disableTotpCode, setDisableTotpCode] = useState('')
  const [disableLoading, setDisableLoading] = useState(false)

  // Regenerate state
  const [showRegenerateDialog, setShowRegenerateDialog] = useState(false)
  const [regeneratePassword, setRegeneratePassword] = useState('')
  const [showRegeneratePassword, setShowRegeneratePassword] = useState(false)
  const [regenerateTotpCode, setRegenerateTotpCode] = useState('')

  // Fetch 2FA status on mount
  const fetchStatus = useCallback(async () => {
    try {
      const res = await fetch('/api/me/2fa/status')
      if (res.ok) {
        const data = await res.json()
        setEnabled(data.enabled)
        setRecoveryCodesRemaining(data.recoveryCodesRemaining)
      }
    } catch {
      // Silently fail - status will show as loading
    } finally {
      setStatusLoading(false)
    }
  }, [])

  // Fetch on first render
  useState(() => {
    fetchStatus()
  })

  // Start 2FA setup
  const handleStartSetup = async () => {
    setSetupLoading(true)
    try {
      const res = await fetch('/api/me/2fa/setup', { method: 'POST' })
      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error ?? 'Failed to start 2FA setup')
      }

      setQrCodeUrl(data.qrCodeUrl)
      setManualEntryKey(data.manualEntryKey)
      setSetupStep('qr')
    } catch (error) {
      showToast.error(error instanceof Error ? error.message : 'Failed to start 2FA setup')
    } finally {
      setSetupLoading(false)
    }
  }

  // Verify TOTP code and enable 2FA
  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault()
    setSetupLoading(true)

    try {
      const res = await fetch('/api/me/2fa/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: verifyCode }),
      })

      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error ?? 'Verification failed')
      }

      setRecoveryCodes(data.recoveryCodes)
      setSetupStep('codes')
      setEnabled(true)
    } catch (error) {
      showToast.error(error instanceof Error ? error.message : 'Verification failed')
    } finally {
      setSetupLoading(false)
    }
  }

  // Copy recovery codes to clipboard
  const handleCopyCodes = async (codes: string[]) => {
    try {
      await navigator.clipboard.writeText(codes.join('\n'))
      setCopiedCodes(true)
      showToast.success('Recovery codes copied to clipboard')
      setTimeout(() => setCopiedCodes(false), 3000)
    } catch {
      showToast.error('Failed to copy codes')
    }
  }

  // Download recovery codes as text file
  const handleDownloadCodes = (codes: string[]) => {
    const content = `PUNT Recovery Codes
Generated: ${new Date().toISOString()}

Keep these codes in a safe place. Each code can only be used once.

${codes.join('\n')}
`
    const blob = new Blob([content], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `punt-recovery-codes-${Date.now()}.txt`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
    showToast.success('Recovery codes downloaded')
  }

  // Complete setup
  const handleCompleteSetup = () => {
    setSetupStep('idle')
    setRecoveryCodes([])
    setVerifyCode('')
    setCodesAcknowledged(false)
    setCopiedCodes(false)
    setRecoveryCodesRemaining(8)
    fetchStatus()
  }

  // Disable 2FA
  const handleDisable = async () => {
    setDisableLoading(true)
    try {
      const res = await fetch('/api/me/2fa/disable', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: disablePassword, totpCode: disableTotpCode }),
      })

      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error ?? 'Failed to disable 2FA')
      }

      setEnabled(false)
      setRecoveryCodesRemaining(0)
      setShowDisableDialog(false)
      setDisablePassword('')
      setDisableTotpCode('')
      showToast.success('Two-factor authentication has been disabled')
    } catch (error) {
      showToast.error(error instanceof Error ? error.message : 'Failed to disable 2FA')
    } finally {
      setDisableLoading(false)
    }
  }

  // Regenerate recovery codes
  const handleRegenerate = async () => {
    const password = regeneratePassword
    const totpCode = regenerateTotpCode

    // Close dialog and show loading spinner in the main card
    setShowRegenerateDialog(false)
    setRegeneratePassword('')
    setRegenerateTotpCode('')
    setSetupStep('regenerating')

    try {
      const res = await fetch('/api/me/2fa/recovery-codes/regenerate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password, totpCode }),
      })

      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error ?? 'Failed to regenerate codes')
      }

      setRecoveryCodes(data.recoveryCodes)
      setCodesAcknowledged(false)
      setCopiedCodes(false)
      setSetupStep('codes')
      showToast.success('Recovery codes regenerated successfully')
    } catch (error) {
      showToast.error(error instanceof Error ? error.message : 'Failed to regenerate codes')
      setSetupStep('idle')
    }
  }

  const handleCloseRegenerateDialog = () => {
    setShowRegenerateDialog(false)
    setRegeneratePassword('')
    setRegenerateTotpCode('')
  }

  if (statusLoading) {
    return (
      <Card className="border-zinc-800 bg-zinc-900/50">
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="h-5 w-5 animate-spin text-zinc-500" />
        </CardContent>
      </Card>
    )
  }

  // Regenerating recovery codes - loading state
  if (setupStep === 'regenerating') {
    return (
      <Card className="border-zinc-800 bg-zinc-900/50">
        <CardHeader className="pb-4">
          <div className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-amber-500" />
            <CardTitle className="text-zinc-100">Two-Factor Authentication</CardTitle>
            <Badge className="bg-emerald-500/10 text-emerald-400 border-emerald-500/20">
              Enabled
            </Badge>
          </div>
          <CardDescription className="text-zinc-500">
            Your account is protected with two-factor authentication.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex items-center justify-center py-8">
          <div className="flex items-center gap-3 text-zinc-400">
            <Loader2 className="h-5 w-5 animate-spin" />
            <span className="text-sm">Regenerating recovery codes...</span>
          </div>
        </CardContent>
      </Card>
    )
  }

  // Setup flow - QR code display
  if (setupStep === 'qr') {
    return (
      <Card className="border-zinc-800 bg-zinc-900/50">
        <CardHeader className="pb-4">
          <div className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-amber-500" />
            <CardTitle className="text-zinc-100">Set Up Two-Factor Authentication</CardTitle>
          </div>
          <CardDescription className="text-zinc-500">
            Scan the QR code with your authenticator app (Google Authenticator, Authy, etc.)
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* QR Code */}
          <div className="flex justify-center">
            <div className="bg-white p-4 rounded-lg">
              <img src={qrCodeUrl} alt="2FA QR Code" width={256} height={256} />
            </div>
          </div>

          {/* Manual entry key */}
          <div className="space-y-2">
            <Label className="text-zinc-300 text-sm">Or enter this key manually:</Label>
            <div className="flex items-center gap-2">
              <code className="flex-1 px-3 py-2 bg-zinc-800 rounded border border-zinc-700 text-zinc-100 font-mono text-sm tracking-wider select-all">
                {manualEntryKey}
              </code>
              <Button
                type="button"
                variant="outline"
                size="icon"
                className="shrink-0 border-zinc-700 hover:bg-zinc-800"
                onClick={() => {
                  navigator.clipboard.writeText(manualEntryKey.replace(/\s/g, ''))
                  showToast.success('Key copied to clipboard')
                }}
              >
                <Copy className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* Verify step */}
          <form onSubmit={handleVerify} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="verifyCode" className="text-zinc-300">
                Enter the 6-digit code from your app to verify
              </Label>
              <Input
                id="verifyCode"
                type="text"
                inputMode="numeric"
                maxLength={6}
                placeholder="000000"
                value={verifyCode}
                onChange={(e) => setVerifyCode(e.target.value.replace(/\D/g, ''))}
                autoFocus
                className="bg-zinc-900 border-zinc-700 focus:border-amber-500 font-mono text-center text-lg tracking-widest max-w-xs mx-auto"
              />
            </div>
            <div className="flex gap-3 justify-end">
              <Button
                type="button"
                variant="outline"
                className="border-zinc-700 hover:bg-zinc-800"
                onClick={() => {
                  setSetupStep('idle')
                  setVerifyCode('')
                }}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                variant="primary"
                disabled={setupLoading || verifyCode.length !== 6}
              >
                {setupLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Verifying...
                  </>
                ) : (
                  'Verify & Enable'
                )}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    )
  }

  // Setup flow - Recovery codes display
  if (setupStep === 'codes') {
    return (
      <Card className="border-zinc-800 bg-zinc-900/50">
        <CardHeader className="pb-4">
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-emerald-500" />
            <CardTitle className="text-zinc-100">Save Your Recovery Codes</CardTitle>
          </div>
          <CardDescription className="text-zinc-500">
            Store these codes in a safe place. Each code can only be used once. You will need them
            if you lose access to your authenticator app.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="bg-zinc-800/50 rounded-lg p-4 border border-zinc-700">
            <div className="grid grid-cols-2 gap-2">
              {recoveryCodes.map((code) => (
                <code
                  key={code}
                  className="px-3 py-1.5 text-sm font-mono text-zinc-100 bg-zinc-900 rounded text-center"
                >
                  {code}
                </code>
              ))}
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Button
              type="button"
              variant="outline"
              className="border-zinc-700 hover:bg-zinc-800"
              onClick={() => handleCopyCodes(recoveryCodes)}
            >
              {copiedCodes ? (
                <>
                  <Check className="mr-2 h-4 w-4 text-emerald-500" />
                  Copied
                </>
              ) : (
                <>
                  <Copy className="mr-2 h-4 w-4" />
                  Copy codes
                </>
              )}
            </Button>
            <Button
              type="button"
              variant="outline"
              className="border-zinc-700 hover:bg-zinc-800"
              onClick={() => handleDownloadCodes(recoveryCodes)}
            >
              <Download className="mr-2 h-4 w-4" />
              Download
            </Button>
          </div>

          <div className="bg-amber-950/30 border border-amber-900/30 rounded-lg p-3">
            <label className="flex items-start gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={codesAcknowledged}
                onChange={(e) => setCodesAcknowledged(e.target.checked)}
                className="mt-1 rounded border-zinc-600"
              />
              <span className="text-sm text-amber-200/80">
                I have saved these recovery codes in a secure location. I understand that I will not
                be able to see them again.
              </span>
            </label>
          </div>

          <div className="flex justify-end">
            <Button
              type="button"
              variant="primary"
              disabled={!codesAcknowledged}
              onClick={handleCompleteSetup}
            >
              Done
            </Button>
          </div>
        </CardContent>
      </Card>
    )
  }

  // Main view - 2FA status
  return (
    <>
      <Card className="border-zinc-800 bg-zinc-900/50">
        <CardHeader className="pb-4">
          <div className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-amber-500" />
            <CardTitle className="text-zinc-100">Two-Factor Authentication</CardTitle>
            {enabled != null && (
              <Badge
                variant={enabled ? 'default' : 'outline'}
                className={
                  enabled
                    ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                    : 'text-zinc-500 border-zinc-700'
                }
              >
                {enabled ? 'Enabled' : 'Disabled'}
              </Badge>
            )}
          </div>
          <CardDescription className="text-zinc-500">
            {enabled
              ? 'Your account is protected with two-factor authentication.'
              : 'Add an extra layer of security to your account using a TOTP authenticator app.'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {enabled ? (
            <div className="space-y-4">
              {/* Recovery codes info */}
              <div className="flex items-center justify-between p-3 bg-zinc-800/50 rounded-lg border border-zinc-700/50">
                <div>
                  <p className="text-sm text-zinc-300">Recovery codes remaining</p>
                  <p className="text-xs text-zinc-500">
                    {recoveryCodesRemaining === 0
                      ? 'No recovery codes remaining. Regenerate new ones.'
                      : `${recoveryCodesRemaining} of 8 codes available`}
                  </p>
                </div>
                <Badge
                  variant="outline"
                  className={
                    recoveryCodesRemaining <= 2
                      ? 'text-red-400 border-red-500/20'
                      : 'text-zinc-400 border-zinc-600'
                  }
                >
                  {recoveryCodesRemaining} / 8
                </Badge>
              </div>

              <div className="flex gap-3">
                <Button
                  type="button"
                  variant="outline"
                  className="border-zinc-700 hover:bg-zinc-800"
                  onClick={() => setShowRegenerateDialog(true)}
                >
                  <RefreshCw className="mr-2 h-4 w-4" />
                  Regenerate codes
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  className="border-red-900/50 text-red-400 hover:bg-red-950/20 hover:text-red-300"
                  onClick={() => setShowDisableDialog(true)}
                >
                  <ShieldOff className="mr-2 h-4 w-4" />
                  Disable 2FA
                </Button>
              </div>
            </div>
          ) : (
            <Button
              type="button"
              variant="primary"
              onClick={handleStartSetup}
              disabled={setupLoading || isDemo}
            >
              {setupLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Setting up...
                </>
              ) : (
                <>
                  <ShieldCheck className="mr-2 h-4 w-4" />
                  Enable Two-Factor Authentication
                </>
              )}
            </Button>
          )}
        </CardContent>
      </Card>

      {/* Disable 2FA Dialog */}
      <AlertDialog open={showDisableDialog} onOpenChange={setShowDisableDialog}>
        <AlertDialogContent className="bg-zinc-900 border-zinc-800">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-zinc-100">
              Disable Two-Factor Authentication?
            </AlertDialogTitle>
            <AlertDialogDescription className="text-zinc-400">
              This will remove the extra security from your account. You can re-enable it at any
              time.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="disablePassword" className="text-zinc-300">
                Confirm with your password
              </Label>
              <div className="relative">
                <Input
                  id="disablePassword"
                  type={showDisablePassword ? 'text' : 'password'}
                  value={disablePassword}
                  onChange={(e) => setDisablePassword(e.target.value)}
                  placeholder="Enter your password"
                  className="bg-zinc-900 border-zinc-700 pr-10"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="absolute right-0 top-0 h-full w-10 text-zinc-500 hover:text-zinc-300 hover:bg-transparent"
                  onClick={() => setShowDisablePassword(!showDisablePassword)}
                >
                  {showDisablePassword ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </Button>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="disableTotpCode" className="text-zinc-300">
                2FA code or recovery code
              </Label>
              <Input
                id="disableTotpCode"
                type="text"
                placeholder="000000 or XXXXX-XXXXX"
                value={disableTotpCode}
                onChange={(e) => setDisableTotpCode(e.target.value)}
                className="bg-zinc-900 border-zinc-700 font-mono tracking-widest"
              />
            </div>
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel
              className="border-zinc-700 text-zinc-300 hover:bg-zinc-800"
              onClick={() => {
                setDisablePassword('')
                setShowDisablePassword(false)
                setDisableTotpCode('')
              }}
            >
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDisable}
              disabled={disableLoading || !disablePassword || !disableTotpCode}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              {disableLoading ? 'Disabling...' : 'Disable 2FA'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Regenerate Recovery Codes Dialog */}
      <AlertDialog
        open={showRegenerateDialog}
        onOpenChange={(open) => {
          if (!open) handleCloseRegenerateDialog()
        }}
      >
        <AlertDialogContent className="bg-zinc-900 border-zinc-800 max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-zinc-100">Regenerate Recovery Codes</AlertDialogTitle>
            <AlertDialogDescription className="text-zinc-400">
              This will invalidate all existing recovery codes and generate new ones.
            </AlertDialogDescription>
          </AlertDialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="regeneratePassword" className="text-zinc-300">
                Confirm with your password
              </Label>
              <div className="relative">
                <Input
                  id="regeneratePassword"
                  type={showRegeneratePassword ? 'text' : 'password'}
                  value={regeneratePassword}
                  onChange={(e) => setRegeneratePassword(e.target.value)}
                  placeholder="Enter your password"
                  className="bg-zinc-900 border-zinc-700 pr-10"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="absolute right-0 top-0 h-full w-10 text-zinc-500 hover:text-zinc-300 hover:bg-transparent"
                  onClick={() => setShowRegeneratePassword(!showRegeneratePassword)}
                >
                  {showRegeneratePassword ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </Button>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="regenerateTotpCode" className="text-zinc-300">
                2FA code or recovery code
              </Label>
              <Input
                id="regenerateTotpCode"
                type="text"
                placeholder="000000 or XXXXX-XXXXX"
                value={regenerateTotpCode}
                onChange={(e) => setRegenerateTotpCode(e.target.value)}
                className="bg-zinc-900 border-zinc-700 font-mono tracking-widest"
              />
            </div>
            <AlertDialogFooter>
              <AlertDialogCancel
                className="border-zinc-700 text-zinc-300 hover:bg-zinc-800"
                onClick={() => {
                  setRegeneratePassword('')
                  setShowRegeneratePassword(false)
                  setRegenerateTotpCode('')
                }}
              >
                Cancel
              </AlertDialogCancel>
              <AlertDialogAction
                onClick={handleRegenerate}
                disabled={!regeneratePassword || !regenerateTotpCode}
                className="bg-amber-600 hover:bg-amber-700 text-white"
              >
                Regenerate
              </AlertDialogAction>
            </AlertDialogFooter>
          </div>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}

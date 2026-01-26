'use client'

import { AlertTriangle, Loader2, Mail, X } from 'lucide-react'
import { useSession } from 'next-auth/react'
import { useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { useEmailVerificationStatus } from '@/hooks/queries/use-email-verification'
import { isDemoMode } from '@/lib/demo'

/**
 * Wrapper that skips email verification banner in demo mode
 */
export function EmailVerificationBanner() {
  if (isDemoMode()) {
    return null
  }
  return <EmailVerificationBannerInner />
}

function EmailVerificationBannerInner() {
  const { data: session, status: sessionStatus } = useSession()
  const { data: verificationData, isLoading } = useEmailVerificationStatus()
  const [isDismissed, setIsDismissed] = useState(false)
  const [isSending, setIsSending] = useState(false)

  // Don't show if:
  // - Session is loading
  // - User is not logged in
  // - Verification data is loading
  // - Email verification is disabled
  // - User has no email
  // - Email is already verified
  // - Banner is dismissed
  if (
    sessionStatus === 'loading' ||
    !session?.user ||
    isLoading ||
    !verificationData?.emailVerificationEnabled ||
    !verificationData?.email ||
    verificationData?.emailVerified ||
    isDismissed
  ) {
    return null
  }

  const handleResend = async () => {
    setIsSending(true)
    try {
      const res = await fetch('/api/auth/send-verification', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      })

      const data = await res.json()

      if (!res.ok) {
        if (res.status === 429) {
          toast.error('Too many requests. Please try again later.')
        } else {
          toast.error(data.error || 'Failed to send verification email')
        }
        return
      }

      if (data.alreadyVerified) {
        toast.success('Email is already verified')
      } else {
        toast.success('Verification email sent!')
      }
    } catch {
      toast.error('Failed to send verification email')
    } finally {
      setIsSending(false)
    }
  }

  return (
    <div className="bg-amber-950/50 border-b border-amber-900/50 px-4 py-2">
      <div className="flex items-center justify-between gap-4 max-w-7xl mx-auto">
        <div className="flex items-center gap-2 text-sm text-amber-200">
          <AlertTriangle className="h-4 w-4 text-amber-400 flex-shrink-0" />
          <span>Please verify your email address ({verificationData.email}).</span>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={handleResend}
            disabled={isSending}
            className="text-amber-200 hover:text-amber-100 hover:bg-amber-900/50 h-7 text-xs"
          >
            {isSending ? (
              <Loader2 className="h-3 w-3 mr-1 animate-spin" />
            ) : (
              <Mail className="h-3 w-3 mr-1" />
            )}
            Resend email
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setIsDismissed(true)}
            className="text-amber-200 hover:text-amber-100 hover:bg-amber-900/50 h-7 w-7"
          >
            <X className="h-4 w-4" />
            <span className="sr-only">Dismiss</span>
          </Button>
        </div>
      </div>
    </div>
  )
}

'use client'

import { CheckCircle2, Loader2, XCircle } from 'lucide-react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'

type VerificationStatus = 'loading' | 'verifying' | 'success' | 'invalid' | 'expired' | 'error'

export function VerifyEmailForm() {
  const searchParams = useSearchParams()
  const token = searchParams.get('token')

  const [status, setStatus] = useState<VerificationStatus>('loading')
  const [email, setEmail] = useState<string | null>(null)
  const [emailUpdated, setEmailUpdated] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  useEffect(() => {
    async function verifyEmail() {
      if (!token) {
        setStatus('invalid')
        return
      }

      // First validate the token
      try {
        const validateRes = await fetch(`/api/auth/verify-email?token=${encodeURIComponent(token)}`)
        const validateData = await validateRes.json()

        if (!validateRes.ok) {
          if (validateData.error?.includes('expired')) {
            setStatus('expired')
          } else {
            setStatus('invalid')
          }
          return
        }

        setEmail(validateData.email)
        setStatus('verifying')

        // Now complete the verification
        const verifyRes = await fetch('/api/auth/verify-email', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token }),
        })

        const verifyData = await verifyRes.json()

        if (!verifyRes.ok) {
          setErrorMessage(verifyData.error || 'Failed to verify email')
          setStatus('error')
          return
        }

        setEmailUpdated(verifyData.emailUpdated)
        setStatus('success')
      } catch {
        setStatus('error')
        setErrorMessage('An unexpected error occurred')
      }
    }

    verifyEmail()
  }, [token])

  // Loading state
  if (status === 'loading' || status === 'verifying') {
    return (
      <div className="rounded-lg border border-zinc-800 bg-zinc-900/50 backdrop-blur-sm p-6">
        <div className="flex items-center justify-center space-x-2">
          <Loader2 className="h-5 w-5 animate-spin text-zinc-400" />
          <span className="text-zinc-400">
            {status === 'loading' ? 'Validating...' : 'Verifying your email...'}
          </span>
        </div>
      </div>
    )
  }

  // Success state
  if (status === 'success') {
    return (
      <div className="rounded-lg border border-zinc-800 bg-zinc-900/50 backdrop-blur-sm p-6 space-y-4">
        <div className="flex justify-center">
          <div className="rounded-full bg-green-950/50 p-3">
            <CheckCircle2 className="h-6 w-6 text-green-400" />
          </div>
        </div>
        <div className="text-center space-y-2">
          <h2 className="text-lg font-semibold text-zinc-100">Email verified!</h2>
          <p className="text-sm text-zinc-400">
            {emailUpdated
              ? `Your email has been updated to ${email}.`
              : `Your email address (${email}) has been verified.`}
          </p>
        </div>
        <div className="pt-2">
          <Link href="/">
            <Button variant="primary" className="w-full">
              Go to Dashboard
            </Button>
          </Link>
        </div>
      </div>
    )
  }

  // Error states
  const messages: Record<
    Exclude<VerificationStatus, 'loading' | 'verifying' | 'success'>,
    { title: string; description: string }
  > = {
    invalid: {
      title: 'Invalid verification link',
      description: 'This verification link is invalid or has already been used.',
    },
    expired: {
      title: 'Verification link expired',
      description: 'This verification link has expired. Please request a new one.',
    },
    error: {
      title: 'Verification failed',
      description: errorMessage || 'An error occurred while verifying your email.',
    },
  }

  const { title, description } = messages[status]

  return (
    <div className="rounded-lg border border-zinc-800 bg-zinc-900/50 backdrop-blur-sm p-6 space-y-4">
      <div className="flex justify-center">
        <div className="rounded-full bg-red-950/50 p-3">
          <XCircle className="h-6 w-6 text-red-400" />
        </div>
      </div>
      <div className="text-center space-y-2">
        <h2 className="text-lg font-semibold text-zinc-100">{title}</h2>
        <p className="text-sm text-zinc-400">{description}</p>
      </div>
      <div className="pt-2 space-y-2">
        <Link href="/profile">
          <Button variant="primary" className="w-full">
            Go to Profile
          </Button>
        </Link>
        <Link href="/">
          <Button variant="outline" className="w-full">
            Go to Dashboard
          </Button>
        </Link>
      </div>
    </div>
  )
}

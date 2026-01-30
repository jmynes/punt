'use client'

import { ArrowLeft, CheckCircle2, Eye, EyeOff, Loader2, XCircle } from 'lucide-react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { useEffect, useState } from 'react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

type TokenStatus = 'loading' | 'valid' | 'invalid' | 'expired' | 'used'

export function ResetPasswordForm() {
  const searchParams = useSearchParams()
  const token = searchParams.get('token')

  const [tokenStatus, setTokenStatus] = useState<TokenStatus>('loading')
  const [email, setEmail] = useState<string | null>(null)
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [isSuccess, setIsSuccess] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Validate token on mount
  useEffect(() => {
    async function validateToken() {
      if (!token) {
        setTokenStatus('invalid')
        return
      }

      try {
        const response = await fetch(`/api/auth/reset-password?token=${encodeURIComponent(token)}`)
        const data = await response.json()

        if (!response.ok) {
          if (data.error?.includes('expired')) {
            setTokenStatus('expired')
          } else if (data.error?.includes('already been used')) {
            setTokenStatus('used')
          } else {
            setTokenStatus('invalid')
          }
          return
        }

        setEmail(data.email)
        setTokenStatus('valid')
      } catch {
        setTokenStatus('invalid')
      }
    }

    validateToken()
  }, [token])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    if (password !== confirmPassword) {
      setError('Passwords do not match')
      return
    }

    setIsLoading(true)

    try {
      const response = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, password }),
      })

      const data = await response.json()

      if (!response.ok) {
        if (response.status === 429) {
          setError('Too many requests. Please try again later.')
        } else if (data.details) {
          setError(data.details.join('. '))
        } else {
          setError(data.error || 'Failed to reset password')
        }
        setIsLoading(false)
        return
      }

      setIsSuccess(true)
    } catch {
      setError('An unexpected error occurred. Please try again.')
      setIsLoading(false)
    }
  }

  // Loading state
  if (tokenStatus === 'loading') {
    return (
      <div className="rounded-lg border border-zinc-800 bg-zinc-900/50 backdrop-blur-sm p-6">
        <div className="flex items-center justify-center space-x-2">
          <Loader2 className="h-5 w-5 animate-spin text-zinc-400" />
          <span className="text-zinc-400">Validating reset link...</span>
        </div>
      </div>
    )
  }

  // Invalid/expired/used token
  if (tokenStatus !== 'valid') {
    const messages: Record<
      Exclude<TokenStatus, 'loading' | 'valid'>,
      { title: string; description: string }
    > = {
      invalid: {
        title: 'Invalid reset link',
        description: 'This password reset link is invalid or has been tampered with.',
      },
      expired: {
        title: 'Reset link expired',
        description: 'This password reset link has expired. Please request a new one.',
      },
      used: {
        title: 'Link already used',
        description: 'This password reset link has already been used.',
      },
    }

    const { title, description } = messages[tokenStatus]

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
          <Link href="/forgot-password">
            <Button variant="primary" className="w-full">
              Request new reset link
            </Button>
          </Link>
          <Link href="/login">
            <Button variant="outline" className="w-full">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to login
            </Button>
          </Link>
        </div>
      </div>
    )
  }

  // Success state
  if (isSuccess) {
    return (
      <div className="rounded-lg border border-zinc-800 bg-zinc-900/50 backdrop-blur-sm p-6 space-y-4">
        <div className="flex justify-center">
          <div className="rounded-full bg-green-950/50 p-3">
            <CheckCircle2 className="h-6 w-6 text-green-400" />
          </div>
        </div>
        <div className="text-center space-y-2">
          <h2 className="text-lg font-semibold text-zinc-100">Password reset successful</h2>
          <p className="text-sm text-zinc-400">
            Your password has been reset. You can now sign in with your new password.
          </p>
        </div>
        <div className="pt-2">
          <Link href="/login">
            <Button variant="primary" className="w-full">
              Sign in
            </Button>
          </Link>
        </div>
      </div>
    )
  }

  // Password reset form
  return (
    <div className="rounded-lg border border-zinc-800 bg-zinc-900/50 backdrop-blur-sm">
      <form onSubmit={handleSubmit}>
        <div className="p-6 space-y-5">
          {error && (
            <div className="px-4 py-3 rounded-md bg-red-950/50 border border-red-900/50 text-red-400 text-sm font-medium">
              {error}
            </div>
          )}

          {email && (
            <div className="px-4 py-3 rounded-md bg-zinc-800/50 border border-zinc-700 text-sm">
              <span className="text-zinc-400">Resetting password for: </span>
              <span className="text-zinc-200 font-medium">{email}</span>
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="password" className="text-sm font-medium text-zinc-300 tracking-wide">
              New password
            </Label>
            <div className="relative">
              <Input
                id="password"
                type={showPassword ? 'text' : 'password'}
                placeholder="Enter new password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoFocus
                className="h-11 border-zinc-700 bg-zinc-800/50 text-zinc-100 placeholder:text-zinc-500 pr-11 focus:border-amber-600 focus:ring-amber-600/20 transition-colors"
              />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="absolute right-0 top-0 h-11 w-11 text-zinc-500 hover:text-zinc-300 hover:bg-transparent"
                onClick={() => setShowPassword(!showPassword)}
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </Button>
            </div>
            <p className="text-xs text-zinc-500">
              At least 12 characters with uppercase, lowercase, and a number.
            </p>
          </div>

          <div className="space-y-2">
            <Label
              htmlFor="confirmPassword"
              className="text-sm font-medium text-zinc-300 tracking-wide"
            >
              Confirm new password
            </Label>
            <div className="relative">
              <Input
                id="confirmPassword"
                type={showConfirmPassword ? 'text' : 'password'}
                placeholder="Confirm new password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                className="h-11 border-zinc-700 bg-zinc-800/50 text-zinc-100 placeholder:text-zinc-500 pr-11 focus:border-amber-600 focus:ring-amber-600/20 transition-colors"
              />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="absolute right-0 top-0 h-11 w-11 text-zinc-500 hover:text-zinc-300 hover:bg-transparent"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
              >
                {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </Button>
            </div>
          </div>
        </div>

        <div className="px-6 pb-6 pt-2">
          <Button
            type="submit"
            variant="primary"
            className="w-full h-11 font-medium tracking-wide"
            disabled={isLoading}
          >
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Resetting password...
              </>
            ) : (
              'Reset password'
            )}
          </Button>
        </div>
      </form>
    </div>
  )
}

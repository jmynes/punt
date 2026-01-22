'use client'

import { ArrowLeft, Loader2, Mail } from 'lucide-react'
import Link from 'next/link'
import { useState } from 'react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

export function ForgotPasswordForm() {
  const [email, setEmail] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [isSubmitted, setIsSubmitted] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setIsLoading(true)

    try {
      const response = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      })

      if (response.status === 429) {
        setError('Too many requests. Please try again later.')
        setIsLoading(false)
        return
      }

      // Always show success to prevent email enumeration
      setIsSubmitted(true)
    } catch {
      setError('An unexpected error occurred. Please try again.')
    } finally {
      setIsLoading(false)
    }
  }

  if (isSubmitted) {
    return (
      <div className="rounded-lg border border-zinc-800 bg-zinc-900/50 backdrop-blur-sm p-6 space-y-4">
        <div className="flex justify-center">
          <div className="rounded-full bg-green-950/50 p-3">
            <Mail className="h-6 w-6 text-green-400" />
          </div>
        </div>
        <div className="text-center space-y-2">
          <h2 className="text-lg font-semibold text-zinc-100">Check your email</h2>
          <p className="text-sm text-zinc-400">
            If an account exists with that email, we&apos;ve sent you a link to reset your password.
            The link will expire in 1 hour.
          </p>
        </div>
        <div className="pt-2">
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

  return (
    <div className="rounded-lg border border-zinc-800 bg-zinc-900/50 backdrop-blur-sm">
      <form onSubmit={handleSubmit}>
        <div className="p-6 space-y-5">
          {error && (
            <div className="px-4 py-3 rounded-md bg-red-950/50 border border-red-900/50 text-red-400 text-sm font-medium">
              {error}
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="email" className="text-sm font-medium text-zinc-300 tracking-wide">
              Email address
            </Label>
            <Input
              id="email"
              type="email"
              placeholder="Enter your email address"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
              autoFocus
              className="h-11 border-zinc-700 bg-zinc-800/50 text-zinc-100 placeholder:text-zinc-500 focus:border-amber-600 focus:ring-amber-600/20 transition-colors"
            />
            <p className="text-xs text-zinc-500">
              We&apos;ll send you a link to reset your password.
            </p>
          </div>
        </div>

        <div className="px-6 pb-6 pt-2 space-y-3">
          <Button
            type="submit"
            variant="primary"
            className="w-full h-11 font-medium tracking-wide"
            disabled={isLoading}
          >
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Sending...
              </>
            ) : (
              'Send reset link'
            )}
          </Button>
        </div>
      </form>
    </div>
  )
}

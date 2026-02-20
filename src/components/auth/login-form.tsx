'use client'

import { ArrowLeft, Eye, EyeOff, Loader2, Shield } from 'lucide-react'
import { useRouter, useSearchParams } from 'next/navigation'
import { signIn } from 'next-auth/react'
import { useRef, useState } from 'react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { getSafeRedirectUrl } from '@/lib/url-validation'

type LoginStep = 'credentials' | '2fa'

export function LoginForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const callbackUrl = getSafeRedirectUrl(searchParams.get('callbackUrl'))

  // Use refs to capture autofilled values that don't trigger onChange
  const usernameRef = useRef<HTMLInputElement>(null)
  const passwordRef = useRef<HTMLInputElement>(null)
  const totpRef = useRef<HTMLInputElement>(null)

  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // 2FA state
  const [step, setStep] = useState<LoginStep>('credentials')
  const [totpCode, setTotpCode] = useState('')
  const [useRecoveryCode, setUseRecoveryCode] = useState(false)

  // Store credentials for 2FA step
  const [savedUsername, setSavedUsername] = useState('')
  const [savedPassword, setSavedPassword] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setIsLoading(true)

    if (step === 'credentials') {
      // Read from refs to capture autofilled values that bypass onChange
      const submittedUsername = usernameRef.current?.value || username
      const submittedPassword = passwordRef.current?.value || password

      try {
        // First check if 2FA is required (also validates credentials)
        const checkRes = await fetch('/api/auth/check-2fa', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            username: submittedUsername,
            password: submittedPassword,
          }),
        })

        if (!checkRes.ok) {
          setError('Invalid username or password')
          setIsLoading(false)
          return
        }

        const checkData = await checkRes.json()

        if (checkData.requires2FA) {
          // Save credentials and switch to 2FA step
          setSavedUsername(submittedUsername)
          setSavedPassword(submittedPassword)
          setStep('2fa')
          setIsLoading(false)
          return
        }

        // No 2FA - proceed with normal sign-in
        const result = await signIn('credentials', {
          username: submittedUsername,
          password: submittedPassword,
          redirect: false,
        })

        if (result?.error) {
          setError('Invalid username or password')
          setIsLoading(false)
          return
        }

        router.push(callbackUrl)
        router.refresh()
      } catch {
        setError('An unexpected error occurred')
        setIsLoading(false)
      }
    } else {
      // 2FA verification step
      const submittedCode = totpRef.current?.value || totpCode

      if (!submittedCode) {
        setError('Please enter a verification code')
        setIsLoading(false)
        return
      }

      try {
        const result = await signIn('credentials', {
          username: savedUsername,
          password: savedPassword,
          totpCode: submittedCode,
          isRecoveryCode: useRecoveryCode ? 'true' : undefined,
          redirect: false,
        })

        if (result?.error) {
          setError(
            useRecoveryCode
              ? 'Invalid recovery code'
              : 'Invalid verification code. Please try again.',
          )
          setIsLoading(false)
          return
        }

        router.push(callbackUrl)
        router.refresh()
      } catch {
        setError('An unexpected error occurred')
        setIsLoading(false)
      }
    }
  }

  function handleBackToCredentials() {
    setStep('credentials')
    setTotpCode('')
    setError(null)
    setUseRecoveryCode(false)
  }

  function toggleRecoveryCode() {
    setUseRecoveryCode(!useRecoveryCode)
    setTotpCode('')
    setError(null)
  }

  // 2FA verification form
  if (step === '2fa') {
    return (
      <div className="rounded-lg border border-zinc-800 bg-zinc-900/50 backdrop-blur-sm">
        <form onSubmit={handleSubmit}>
          <div className="p-6 space-y-5">
            <div className="flex items-center gap-3 mb-2">
              <div className="flex items-center justify-center w-10 h-10 rounded-full bg-amber-500/10 border border-amber-500/20">
                <Shield className="h-5 w-5 text-amber-500" />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-zinc-100">Two-Factor Authentication</h3>
                <p className="text-xs text-zinc-500">
                  {useRecoveryCode
                    ? 'Enter one of your recovery codes'
                    : 'Enter the code from your authenticator app'}
                </p>
              </div>
            </div>

            {error && (
              <div className="px-4 py-3 rounded-md bg-red-950/50 border border-red-900/50 text-red-400 text-sm font-medium">
                {error}
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="totpCode" className="text-sm font-medium text-zinc-300 tracking-wide">
                {useRecoveryCode ? 'Recovery Code' : 'Verification Code'}
              </Label>
              <Input
                ref={totpRef}
                id="totpCode"
                type="text"
                inputMode={useRecoveryCode ? 'text' : 'numeric'}
                placeholder={useRecoveryCode ? 'XXXXX-XXXXX' : '000000'}
                value={totpCode}
                onChange={(e) => setTotpCode(e.target.value)}
                required
                autoComplete="one-time-code"
                autoFocus
                maxLength={useRecoveryCode ? 11 : 6}
                className="h-11 border-zinc-700 bg-zinc-800/50 text-zinc-100 placeholder:text-zinc-500 focus:border-amber-600 focus:ring-amber-600/20 transition-colors font-mono text-center text-lg tracking-widest"
              />
            </div>

            <button
              type="button"
              onClick={toggleRecoveryCode}
              className="text-xs text-amber-500 hover:text-amber-400 font-medium transition-colors"
            >
              {useRecoveryCode ? 'Use authenticator app instead' : 'Use a recovery code'}
            </button>
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
                  Verifying...
                </>
              ) : (
                'Verify'
              )}
            </Button>

            <Button
              type="button"
              variant="ghost"
              className="w-full text-zinc-400 hover:text-zinc-300"
              onClick={handleBackToCredentials}
              disabled={isLoading}
            >
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to sign in
            </Button>
          </div>
        </form>
      </div>
    )
  }

  // Credentials form (step 1)
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
            <Label htmlFor="username" className="text-sm font-medium text-zinc-300 tracking-wide">
              Username
            </Label>
            <Input
              ref={usernameRef}
              id="username"
              type="text"
              placeholder="Enter your username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              onInput={(e) => setUsername((e.target as HTMLInputElement).value)}
              required
              autoComplete="username"
              autoFocus
              className="h-11 border-zinc-700 bg-zinc-800/50 text-zinc-100 placeholder:text-zinc-500 focus:border-amber-600 focus:ring-amber-600/20 transition-colors"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="password" className="text-sm font-medium text-zinc-300 tracking-wide">
              Password
            </Label>
            <div className="relative">
              <Input
                ref={passwordRef}
                id="password"
                type={showPassword ? 'text' : 'password'}
                placeholder="Enter your password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onInput={(e) => setPassword((e.target as HTMLInputElement).value)}
                onCut={(e) => {
                  // When password is hidden, copy empty string but still clear the field
                  if (!showPassword) {
                    e.preventDefault()
                    e.clipboardData?.setData('text/plain', '')
                    setPassword('')
                  }
                }}
                required
                autoComplete="current-password"
                className="h-11 border-zinc-700 bg-zinc-800/50 text-zinc-100 placeholder:text-zinc-500 pr-11 focus:border-amber-600 focus:ring-amber-600/20 transition-colors"
              />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="absolute right-0 top-0 h-11 w-11 text-zinc-500 hover:text-zinc-300 hover:bg-transparent"
                onClick={() => {
                  // Sync autofilled value to state before toggling visibility
                  if (passwordRef.current) {
                    setPassword(passwordRef.current.value)
                  }
                  setShowPassword(!showPassword)
                }}
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
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
                Signing in...
              </>
            ) : (
              'Sign in'
            )}
          </Button>
        </div>
      </form>
    </div>
  )
}

'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { signIn } from 'next-auth/react'
import { Eye, EyeOff, Loader2, Check, X } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

interface PasswordRequirement {
  label: string
  test: (password: string) => boolean
}

const passwordRequirements: PasswordRequirement[] = [
  { label: 'At least 12 characters', test: (p) => p.length >= 12 },
  { label: 'One uppercase letter', test: (p) => /[A-Z]/.test(p) },
  { label: 'One lowercase letter', test: (p) => /[a-z]/.test(p) },
  { label: 'One number', test: (p) => /[0-9]/.test(p) },
]

export function RegisterForm() {
  const router = useRouter()

  const [username, setUsername] = useState('')
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const isValidUsername = /^[a-zA-Z0-9_-]{3,30}$/.test(username)
  const isValidEmail = !email || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
  const passwordsMatch = password === confirmPassword && confirmPassword.length > 0
  const allRequirementsMet = passwordRequirements.every((req) => req.test(password))
  const canSubmit = username && isValidUsername && name && password && passwordsMatch && allRequirementsMet && isValidEmail

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    if (!isValidUsername) {
      setError('Username must be 3-30 characters and can only contain letters, numbers, underscores, and hyphens')
      return
    }

    if (!passwordsMatch) {
      setError('Passwords do not match')
      return
    }

    if (!allRequirementsMet) {
      setError('Password does not meet all requirements')
      return
    }

    setIsLoading(true)

    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, name, email: email || undefined, password }),
      })

      const data = await res.json()

      if (!res.ok) {
        setError(data.error || 'Registration failed')
        setIsLoading(false)
        return
      }

      // Auto sign in after successful registration
      const signInResult = await signIn('credentials', {
        username,
        password,
        redirect: false,
      })

      if (signInResult?.error) {
        // Registration succeeded but sign-in failed, redirect to login
        router.push('/login?registered=true')
        return
      }

      router.push('/')
      router.refresh()
    } catch {
      setError('An unexpected error occurred')
      setIsLoading(false)
    }
  }

  return (
    <div className="rounded-lg border border-zinc-800 bg-zinc-900/50 backdrop-blur-sm">
      <form onSubmit={handleSubmit}>
        <div className="p-6 space-y-6">
          {error && (
            <div className="px-4 py-3 rounded-md bg-red-950/50 border border-red-900/50 text-red-400 text-sm font-medium">
              {error}
            </div>
          )}

          {/* Account Information */}
          <div className="space-y-5">
            <div className="space-y-2">
              <Label
                htmlFor="username"
                className="text-sm font-medium text-zinc-300 tracking-wide"
              >
                Username<span className="text-amber-500 ml-0.5 align-top text-xs">*</span>
              </Label>
              <Input
                id="username"
                type="text"
                placeholder="johndoe"
                value={username}
                onChange={(e) => setUsername(e.target.value.toLowerCase())}
                required
                autoComplete="username"
                autoFocus
                className={`h-11 border-zinc-700 bg-zinc-800/50 text-zinc-100 placeholder:text-zinc-500 focus:border-amber-600 focus:ring-amber-600/20 transition-colors ${
                  username && !isValidUsername ? 'border-red-600 focus:border-red-600' : ''
                }`}
              />
              {username && !isValidUsername && (
                <p className="text-xs text-red-400 mt-1.5">
                  3-30 characters, letters, numbers, underscores, and hyphens only
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label
                htmlFor="name"
                className="text-sm font-medium text-zinc-300 tracking-wide"
              >
                Display Name<span className="text-amber-500 ml-0.5 align-top text-xs">*</span>
              </Label>
              <Input
                id="name"
                type="text"
                placeholder="John Doe"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                autoComplete="name"
                className="h-11 border-zinc-700 bg-zinc-800/50 text-zinc-100 placeholder:text-zinc-500 focus:border-amber-600 focus:ring-amber-600/20 transition-colors"
              />
            </div>

            <div className="space-y-2">
              <Label
                htmlFor="email"
                className="text-sm font-medium text-zinc-300 tracking-wide"
              >
                Email
                <span className="ml-2 text-xs font-normal text-zinc-500">(optional)</span>
              </Label>
              <Input
                id="email"
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
                className={`h-11 border-zinc-700 bg-zinc-800/50 text-zinc-100 placeholder:text-zinc-500 focus:border-amber-600 focus:ring-amber-600/20 transition-colors ${
                  email && !isValidEmail ? 'border-red-600 focus:border-red-600' : ''
                }`}
              />
              {email && !isValidEmail && (
                <p className="text-xs text-red-400 mt-1.5">Please enter a valid email address</p>
              )}
            </div>
          </div>

          {/* Divider */}
          <div className="border-t border-zinc-800" />

          {/* Security */}
          <div className="space-y-5">
            <div className="space-y-2">
              <Label
                htmlFor="password"
                className="text-sm font-medium text-zinc-300 tracking-wide"
              >
                Password<span className="text-amber-500 ml-0.5 align-top text-xs">*</span>
              </Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Create a password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  autoComplete="new-password"
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

              {/* Password requirements */}
              {password && (
                <div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1.5">
                  {passwordRequirements.map((req, index) => {
                    const met = req.test(password)
                    return (
                      <div
                        key={index}
                        className={`flex items-center gap-1.5 text-xs transition-colors ${
                          met ? 'text-emerald-400' : 'text-zinc-500'
                        }`}
                      >
                        {met ? (
                          <Check className="h-3 w-3 shrink-0" />
                        ) : (
                          <X className="h-3 w-3 shrink-0" />
                        )}
                        <span>{req.label}</span>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>

            <div className="space-y-2">
              <Label
                htmlFor="confirmPassword"
                className="text-sm font-medium text-zinc-300 tracking-wide"
              >
                Confirm Password<span className="text-amber-500 ml-0.5 align-top text-xs">*</span>
              </Label>
              <div className="relative">
                <Input
                  id="confirmPassword"
                  type={showConfirmPassword ? 'text' : 'password'}
                  placeholder="Confirm your password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  autoComplete="new-password"
                  className={`h-11 border-zinc-700 bg-zinc-800/50 text-zinc-100 placeholder:text-zinc-500 pr-11 focus:border-amber-600 focus:ring-amber-600/20 transition-colors ${
                    confirmPassword && !passwordsMatch ? 'border-red-600 focus:border-red-600' : ''
                  }`}
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
              {confirmPassword && !passwordsMatch && (
                <p className="text-xs text-red-400 mt-1.5">Passwords do not match</p>
              )}
              {passwordsMatch && confirmPassword && (
                <p className="text-xs text-emerald-400 flex items-center gap-1.5 mt-1.5">
                  <Check className="h-3 w-3" />
                  Passwords match
                </p>
              )}
            </div>
          </div>
        </div>

        <div className="px-6 pb-6 pt-2">
          <Button
            type="submit"
            className="w-full h-11 bg-amber-600 hover:bg-amber-500 text-white font-medium tracking-wide transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            disabled={isLoading || !canSubmit}
          >
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Creating account...
              </>
            ) : (
              'Create account'
            )}
          </Button>
        </div>
      </form>
    </div>
  )
}

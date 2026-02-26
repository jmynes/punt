'use client'

import { Check, Eye, EyeOff, Loader2, Upload, UserPlus, X } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { signIn } from 'next-auth/react'
import { useCallback, useEffect, useRef, useState } from 'react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  checkIfExportEncrypted,
  fileToBase64,
  isZipContent,
} from '@/hooks/queries/use-database-backup'

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

export function SetupForm() {
  const router = useRouter()
  const [isChecking, setIsChecking] = useState(true)

  // Check if setup is needed
  useEffect(() => {
    fetch('/api/auth/setup')
      .then((res) => res.json())
      .then((data) => {
        if (data.hasUsers) {
          router.replace('/login')
        } else {
          setIsChecking(false)
        }
      })
      .catch(() => {
        setIsChecking(false)
      })
  }, [router])

  if (isChecking) {
    return <div className="h-96 animate-pulse bg-zinc-800/50 rounded-lg" />
  }

  return (
    <Tabs defaultValue="create-admin">
      <TabsList variant="line" className="w-full justify-center gap-4 mb-2">
        <TabsTrigger value="create-admin" className="gap-1.5">
          <UserPlus className="h-4 w-4" />
          Create Admin
        </TabsTrigger>
        <TabsTrigger value="import-backup" className="gap-1.5">
          <Upload className="h-4 w-4" />
          Import Backup
        </TabsTrigger>
      </TabsList>
      <TabsContent value="create-admin">
        <CreateAdminForm />
      </TabsContent>
      <TabsContent value="import-backup">
        <ImportBackupForm />
      </TabsContent>
    </Tabs>
  )
}

function CreateAdminForm() {
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
  const canSubmit =
    username &&
    isValidUsername &&
    name &&
    password &&
    passwordsMatch &&
    allRequirementsMet &&
    isValidEmail

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setIsLoading(true)

    try {
      const res = await fetch('/api/auth/setup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, name, email: email || undefined, password }),
      })

      const data = await res.json()

      if (!res.ok) {
        setError(data.error || 'Setup failed')
        setIsLoading(false)
        return
      }

      // Auto sign in after successful creation
      const signInResult = await signIn('credentials', {
        username,
        password,
        redirect: false,
      })

      if (signInResult?.error) {
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
          <p className="text-sm text-zinc-400">
            Create the first administrator account for your PUNT instance.
          </p>

          {error && (
            <div className="px-4 py-3 rounded-md bg-red-950/50 border border-red-900/50 text-red-400 text-sm font-medium">
              {error}
            </div>
          )}

          <div className="space-y-5">
            <div className="space-y-2">
              <Label
                htmlFor="setup-username"
                className="inline-flex items-center gap-1 text-sm font-medium text-zinc-300 tracking-wide"
              >
                Username<span className="text-amber-500">*</span>
              </Label>
              <Input
                id="setup-username"
                type="text"
                placeholder="admin"
                value={username}
                onChange={(e) => setUsername(e.target.value.toLowerCase())}
                required
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
                htmlFor="setup-name"
                className="inline-flex items-center gap-1 text-sm font-medium text-zinc-300 tracking-wide"
              >
                Display Name<span className="text-amber-500">*</span>
              </Label>
              <Input
                id="setup-name"
                type="text"
                placeholder="Admin"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                className="h-11 border-zinc-700 bg-zinc-800/50 text-zinc-100 placeholder:text-zinc-500 focus:border-amber-600 focus:ring-amber-600/20 transition-colors"
              />
            </div>

            <div className="space-y-2">
              <Label
                htmlFor="setup-email"
                className="text-sm font-medium text-zinc-300 tracking-wide"
              >
                Email
                <span className="ml-2 text-xs font-normal text-zinc-500">(optional)</span>
              </Label>
              <Input
                id="setup-email"
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className={`h-11 border-zinc-700 bg-zinc-800/50 text-zinc-100 placeholder:text-zinc-500 focus:border-amber-600 focus:ring-amber-600/20 transition-colors ${
                  email && !isValidEmail ? 'border-red-600 focus:border-red-600' : ''
                }`}
              />
              {email && !isValidEmail && (
                <p className="text-xs text-red-400 mt-1.5">Please enter a valid email address</p>
              )}
            </div>
          </div>

          <div className="border-t border-zinc-800" />

          <div className="space-y-5">
            <div className="space-y-2">
              <Label
                htmlFor="setup-password"
                className="inline-flex items-center gap-1 text-sm font-medium text-zinc-300 tracking-wide"
              >
                Password<span className="text-amber-500">*</span>
              </Label>
              <div className="relative">
                <Input
                  id="setup-password"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Create a password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
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

              {password && (
                <div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1.5">
                  {passwordRequirements.map((req) => {
                    const met = req.test(password)
                    return (
                      <div
                        key={req.label}
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
                htmlFor="setup-confirm-password"
                className="inline-flex items-center gap-1 text-sm font-medium text-zinc-300 tracking-wide"
              >
                Confirm Password<span className="text-amber-500">*</span>
              </Label>
              <div className="relative">
                <Input
                  id="setup-confirm-password"
                  type={showConfirmPassword ? 'text' : 'password'}
                  placeholder="Confirm your password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
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
                  {showConfirmPassword ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
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
            variant="primary"
            className="w-full h-11 font-medium tracking-wide"
            disabled={isLoading || !canSubmit}
          >
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Creating admin account...
              </>
            ) : (
              'Create admin account'
            )}
          </Button>
        </div>
      </form>
    </div>
  )
}

function ImportBackupForm() {
  const router = useRouter()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [importFile, setImportFile] = useState<File | null>(null)
  const [importFileBase64, setImportFileBase64] = useState<string | null>(null)
  const [isEncrypted, setIsEncrypted] = useState(false)
  const [decryptionPassword, setDecryptionPassword] = useState('')
  const [showDecryptionPassword, setShowDecryptionPassword] = useState(false)
  const [isImporting, setIsImporting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  const handleFileSelect = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setImportFile(file)
    setError(null)
    setSuccess(null)

    const base64 = await fileToBase64(file)
    setImportFileBase64(base64)

    // Check encryption for non-ZIP files
    const isZip = isZipContent(base64)
    if (!isZip) {
      try {
        const text = atob(base64)
        setIsEncrypted(checkIfExportEncrypted(text))
      } catch {
        setIsEncrypted(false)
      }
    } else {
      // ZIP files may contain encrypted backup.json — assume possibly encrypted
      // The server will tell us if password is needed
      setIsEncrypted(false)
    }
  }, [])

  async function handleImport(e: React.FormEvent) {
    e.preventDefault()
    if (!importFileBase64) return

    setError(null)
    setIsImporting(true)

    try {
      const res = await fetch('/api/admin/database/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content: importFileBase64,
          decryptionPassword: decryptionPassword || undefined,
        }),
      })

      const data = await res.json()

      if (!res.ok) {
        // Check if it needs a password
        if (data.error?.includes('encrypted') || data.error?.includes('password')) {
          setIsEncrypted(true)
          setError(data.error)
        } else {
          setError(data.error || 'Import failed')
        }
        setIsImporting(false)
        return
      }

      const total = Object.values(data.counts as Record<string, number>).reduce(
        (sum, count) => sum + count,
        0,
      )
      setSuccess(`Import successful! Restored ${total} records. Redirecting to login...`)

      // Redirect to login after a brief delay
      setTimeout(() => {
        router.push('/login')
      }, 2000)
    } catch {
      setError('An unexpected error occurred')
      setIsImporting(false)
    }
  }

  return (
    <div className="rounded-lg border border-zinc-800 bg-zinc-900/50 backdrop-blur-sm">
      <form onSubmit={handleImport}>
        <div className="p-6 space-y-5">
          <p className="text-sm text-zinc-400">
            Restore from a previous PUNT database export. After importing, sign in with your
            existing credentials.
          </p>

          {error && (
            <div className="px-4 py-3 rounded-md bg-red-950/50 border border-red-900/50 text-red-400 text-sm font-medium">
              {error}
            </div>
          )}

          {success && (
            <div className="px-4 py-3 rounded-md bg-emerald-950/50 border border-emerald-900/50 text-emerald-400 text-sm font-medium">
              {success}
            </div>
          )}

          <div className="space-y-2">
            <Label
              htmlFor="setup-import-file"
              className="inline-flex items-center gap-1 text-sm font-medium text-zinc-300 tracking-wide"
            >
              Backup File<span className="text-amber-500">*</span>
            </Label>
            <Input
              id="setup-import-file"
              type="file"
              accept=".json,.zip"
              ref={fileInputRef}
              onChange={handleFileSelect}
              className="bg-zinc-800 border-zinc-700 text-zinc-100 file:bg-zinc-700 file:text-zinc-200 file:border-0 file:mr-4 file:py-1 file:px-3 file:rounded"
            />
            {importFile && (
              <p className="text-xs text-zinc-500">
                {importFile.name} ({(importFile.size / 1024).toFixed(1)} KB)
              </p>
            )}
          </div>

          {isEncrypted && (
            <div className="space-y-2">
              <Label
                htmlFor="setup-decrypt-password"
                className="inline-flex items-center gap-1 text-sm font-medium text-zinc-300 tracking-wide"
              >
                Decryption Password<span className="text-amber-500">*</span>
              </Label>
              <div className="relative">
                <Input
                  id="setup-decrypt-password"
                  type={showDecryptionPassword ? 'text' : 'password'}
                  placeholder="Enter the backup encryption password"
                  value={decryptionPassword}
                  onChange={(e) => setDecryptionPassword(e.target.value)}
                  className="h-11 border-zinc-700 bg-zinc-800/50 text-zinc-100 placeholder:text-zinc-500 pr-11 focus:border-amber-600 focus:ring-amber-600/20 transition-colors"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="absolute right-0 top-0 h-11 w-11 text-zinc-500 hover:text-zinc-300 hover:bg-transparent"
                  onClick={() => setShowDecryptionPassword(!showDecryptionPassword)}
                >
                  {showDecryptionPassword ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </Button>
              </div>
              <p className="text-xs text-zinc-500">
                This backup was encrypted during export. Enter the password to decrypt it.
              </p>
            </div>
          )}
        </div>

        <div className="px-6 pb-6 pt-2">
          <Button
            type="submit"
            variant="primary"
            className="w-full h-11 font-medium tracking-wide"
            disabled={isImporting || !importFileBase64 || (isEncrypted && !decryptionPassword)}
          >
            {isImporting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Importing...
              </>
            ) : (
              <>
                <Upload className="mr-2 h-4 w-4" />
                Import backup
              </>
            )}
          </Button>
        </div>
      </form>
    </div>
  )
}

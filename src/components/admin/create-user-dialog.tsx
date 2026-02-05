'use client'

import { useMutation, useQueryClient } from '@tanstack/react-query'
import { AlertTriangle, Eye, EyeOff, Loader2, UserPlus } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { isDemoMode } from '@/lib/demo'

export function CreateUserDialog() {
  const [open, setOpen] = useState(false)
  const [username, setUsername] = useState('')
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [isSystemAdmin, setIsSystemAdmin] = useState(false)
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const queryClient = useQueryClient()

  const createUser = useMutation({
    mutationFn: async () => {
      // Demo mode: show info toast and don't submit
      if (isDemoMode()) {
        toast.info('User creation is disabled in demo mode')
        return { demo: true }
      }

      const res = await fetch('/api/admin/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username,
          name,
          email: email || undefined,
          password,
          isSystemAdmin,
          confirmPassword,
        }),
      })
      if (!res.ok) {
        const error = await res.json()
        throw new Error(error.error || 'Failed to create user')
      }
      return res.json()
    },
    onSuccess: (data) => {
      if (data?.demo) {
        handleClose()
        return
      }
      queryClient.invalidateQueries({ queryKey: ['admin', 'users'] })
      toast.success('User created successfully')
      handleClose()
    },
    onError: (error) => {
      toast.error(error.message)
    },
  })

  function handleClose() {
    setOpen(false)
    setUsername('')
    setName('')
    setEmail('')
    setPassword('')
    setShowPassword(false)
    setIsSystemAdmin(false)
    setConfirmPassword('')
    setShowConfirmPassword(false)
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="primary">
          <UserPlus className="h-4 w-4 mr-2" />
          Create User
        </Button>
      </DialogTrigger>
      <DialogContent className="bg-zinc-950 border-zinc-800">
        <DialogHeader>
          <DialogTitle className="text-zinc-100">Create New User</DialogTitle>
          <DialogDescription className="text-zinc-500">
            Add a new user to the system. They will be able to log in immediately.
          </DialogDescription>
        </DialogHeader>

        {/* Using div instead of form to prevent browser password manager detection */}
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="create-user-username" className="text-zinc-300">
              Username<span className="text-amber-500 ml-1">*</span>
            </Label>
            <Input
              id="create-user-username"
              type="text"
              autoComplete="off"
              value={username}
              onChange={(e) => setUsername(e.target.value.toLowerCase())}
              placeholder="johndoe"
              className="border-zinc-700 bg-zinc-800 text-zinc-100"
            />
            <p className="text-xs text-zinc-500">
              3-30 characters, letters, numbers, underscores, and hyphens only.
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="create-user-name" className="text-zinc-300">
              Display Name<span className="text-amber-500 ml-1">*</span>
            </Label>
            <Input
              id="create-user-name"
              type="text"
              autoComplete="off"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="John Doe"
              className="border-zinc-700 bg-zinc-800 text-zinc-100"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="create-user-email" className="text-zinc-300">
              Email
              <span className="text-zinc-500 ml-2 text-xs font-normal">(optional)</span>
            </Label>
            <Input
              id="create-user-email"
              type="text"
              autoComplete="off"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="john@example.com"
              className="border-zinc-700 bg-zinc-800 text-zinc-100"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="create-user-password" className="text-zinc-300">
              Password<span className="text-amber-500 ml-1">*</span>
            </Label>
            <div className="relative">
              <Input
                id="create-user-password"
                type="text"
                autoComplete="off"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="At least 12 characters"
                className={`border-zinc-700 bg-zinc-800 text-zinc-100 pr-10 ${!showPassword ? 'password-mask' : ''}`}
              />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="absolute right-0 top-0 h-full px-3 text-zinc-500 hover:text-zinc-300"
                onClick={() => setShowPassword(!showPassword)}
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </Button>
            </div>
            <p className="text-xs text-zinc-500">
              Must be at least 12 characters with uppercase, lowercase, and a number.
            </p>
          </div>

          <div className="space-y-2">
            <div className="flex items-center space-x-3">
              <Checkbox
                id="isSystemAdmin"
                checked={isSystemAdmin}
                onCheckedChange={(checked) => setIsSystemAdmin(checked === true)}
                className="border-zinc-500 data-[state=checked]:border-amber-500 data-[state=checked]:bg-amber-600"
              />
              <Label htmlFor="isSystemAdmin" className="text-zinc-300 cursor-pointer">
                Make this user a super admin
              </Label>
            </div>
            {isSystemAdmin && (
              <div className="flex items-start gap-2 p-3 rounded-md bg-amber-950/30 border border-amber-900/50">
                <AlertTriangle className="h-4 w-4 text-amber-500 flex-shrink-0 mt-0.5" />
                <p className="text-xs text-amber-200/80">
                  Super admins have full system access including managing all users, projects, and
                  system settings. Only grant this privilege to trusted individuals.
                </p>
              </div>
            )}
          </div>

          <div className="border-t border-zinc-800 pt-4 space-y-2">
            <Label htmlFor="create-user-confirm" className="text-zinc-300">
              Your Password<span className="text-amber-500 ml-1">*</span>
            </Label>
            <div className="relative">
              <Input
                id="create-user-confirm"
                type="text"
                autoComplete="off"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Enter your password to confirm"
                className={`border-zinc-700 bg-zinc-800 text-zinc-100 pr-10 ${!showConfirmPassword ? 'password-mask' : ''}`}
              />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="absolute right-0 top-0 h-full px-3 text-zinc-500 hover:text-zinc-300"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
              >
                {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </Button>
            </div>
            <p className="text-xs text-zinc-500">
              Enter your password to authorize creating this user.
            </p>
          </div>

          <DialogFooter>
            <Button type="button" variant="ghost" onClick={handleClose}>
              Cancel
            </Button>
            <Button
              type="button"
              variant="primary"
              disabled={createUser.isPending || !username || !name || !password || !confirmPassword}
              onClick={() => createUser.mutate()}
            >
              {createUser.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Creating...
                </>
              ) : (
                'Create User'
              )}
            </Button>
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  )
}

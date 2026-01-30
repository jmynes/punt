'use client'

import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Eye, EyeOff, Loader2, UserPlus } from 'lucide-react'
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

        <form
          onSubmit={(e) => {
            e.preventDefault()
            createUser.mutate()
          }}
          className="space-y-4 py-4"
          autoComplete="off"
        >
          <div className="space-y-2">
            <Label htmlFor="username" className="text-zinc-300">
              Username<span className="text-amber-500 ml-1">*</span>
            </Label>
            <Input
              id="username"
              value={username}
              onChange={(e) => setUsername(e.target.value.toLowerCase())}
              placeholder="johndoe"
              required
              className="border-zinc-700 bg-zinc-800 text-zinc-100"
            />
            <p className="text-xs text-zinc-500">
              3-30 characters, letters, numbers, underscores, and hyphens only.
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="name" className="text-zinc-300">
              Display Name<span className="text-amber-500 ml-1">*</span>
            </Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="John Doe"
              required
              className="border-zinc-700 bg-zinc-800 text-zinc-100"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="email" className="text-zinc-300">
              Email
              <span className="text-zinc-500 ml-2 text-xs font-normal">(optional)</span>
            </Label>
            <Input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="john@example.com"
              className="border-zinc-700 bg-zinc-800 text-zinc-100"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="password" className="text-zinc-300">
              Password<span className="text-amber-500 ml-1">*</span>
            </Label>
            <div className="relative">
              <Input
                id="password"
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="At least 12 characters"
                required
                minLength={12}
                className="border-zinc-700 bg-zinc-800 text-zinc-100 pr-10"
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

          <DialogFooter>
            <Button type="button" variant="ghost" onClick={handleClose}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" disabled={createUser.isPending}>
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
        </form>
      </DialogContent>
    </Dialog>
  )
}

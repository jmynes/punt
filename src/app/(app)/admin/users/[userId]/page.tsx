'use client'

import { useQuery, useQueryClient } from '@tanstack/react-query'
import {
  ArrowLeft,
  Calendar,
  Check,
  ChevronsUpDown,
  FolderKanban,
  Mail,
  Shield,
  ShieldOff,
  User,
  UserCheck,
  UserX,
} from 'lucide-react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { useCallback, useEffect, useState } from 'react'
import { toast } from 'sonner'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandList,
} from '@/components/ui/command'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { getTabId } from '@/hooks/use-realtime'
import { cn, getAvatarColor, getInitials } from '@/lib/utils'
import { useAdminUndoStore } from '@/stores/admin-undo-store'

interface ProjectRole {
  id: string
  name: string
  position: number
}

interface ProjectMembership {
  id: string // membership ID
  roleId: string
  role: {
    id: string
    name: string
  }
  project: {
    id: string
    name: string
    key: string
    color: string | null
    roles: ProjectRole[]
  }
}

interface UserDetails {
  id: string
  email: string | null
  name: string
  avatar: string | null
  avatarColor: string | null
  isSystemAdmin: boolean
  isActive: boolean
  createdAt: string
  updatedAt: string
  projects: ProjectMembership[]
  _count: {
    projects: number
  }
}

function RoleSelector({
  membership,
  onRoleChange,
}: {
  membership: ProjectMembership
  onRoleChange: (roleId: string, roleName: string) => void
}) {
  const [open, setOpen] = useState(false)

  const getRoleStyle = (roleName: string) => {
    switch (roleName) {
      case 'Owner':
        return 'border-amber-500/50 text-amber-400'
      case 'Admin':
        return 'border-blue-500/50 text-blue-400'
      default:
        return 'border-zinc-600 text-zinc-400'
    }
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className={cn(
            'w-[110px] justify-between font-normal',
            getRoleStyle(membership.role.name),
          )}
        >
          {membership.role.name}
          <ChevronsUpDown className="ml-2 h-3 w-3 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[140px] p-0" align="end">
        <Command>
          <CommandList>
            <CommandEmpty>No roles found</CommandEmpty>
            <CommandGroup>
              {membership.project.roles.map((role) => (
                <CommandItem
                  key={role.id}
                  value={role.name}
                  onSelect={() => {
                    if (role.id !== membership.roleId) {
                      onRoleChange(role.id, role.name)
                    }
                    setOpen(false)
                  }}
                  className={cn(
                    'cursor-pointer',
                    role.name === 'Owner' && 'text-amber-400',
                    role.name === 'Admin' && 'text-blue-400',
                    role.name === 'Member' && 'text-zinc-400',
                  )}
                >
                  <Check
                    className={cn(
                      'mr-2 h-4 w-4',
                      membership.roleId === role.id ? 'opacity-100' : 'opacity-0',
                    )}
                  />
                  {role.name}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}

export default function AdminUserProfilePage() {
  const params = useParams()
  const queryClient = useQueryClient()
  const userId = params.userId as string
  const { pushMemberRoleChange, undo, redo, canUndo, canRedo } = useAdminUndoStore()

  const {
    data: user,
    isLoading,
    error,
  } = useQuery<UserDetails>({
    queryKey: ['admin', 'users', userId],
    queryFn: async () => {
      const res = await fetch(`/api/admin/users/${userId}`)
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Failed to fetch user')
      }
      return res.json()
    },
  })

  // Helper to perform role change API call
  const performRoleChange = useCallback(
    async (
      membershipId: string,
      projectId: string,
      roleId: string,
      roleName: string,
      isUndo = false,
    ) => {
      const res = await fetch(`/api/projects/${projectId}/members/${membershipId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'X-Tab-Id': getTabId(),
        },
        body: JSON.stringify({ roleId }),
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Failed to update role')
      }

      // Invalidate the cache to get fresh data
      queryClient.invalidateQueries({ queryKey: ['admin', 'users', userId] })

      toast.success(isUndo ? `Role reverted to ${roleName}` : `Role updated to ${roleName}`)
    },
    [queryClient, userId],
  )

  // Handle undo
  const handleUndo = useCallback(async () => {
    const action = undo()
    if (!action) return

    if (action.type === 'memberRoleChange') {
      try {
        await performRoleChange(
          action.member.membershipId,
          action.member.projectId,
          action.member.previousRoleId,
          action.member.previousRoleName,
          true,
        )
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Failed to undo')
        // Re-push the action since undo failed
        pushMemberRoleChange(action.member)
      }
    }
  }, [undo, performRoleChange, pushMemberRoleChange])

  // Handle redo
  const handleRedo = useCallback(async () => {
    const action = redo()
    if (!action) return

    if (action.type === 'memberRoleChange') {
      try {
        await performRoleChange(
          action.member.membershipId,
          action.member.projectId,
          action.member.newRoleId,
          action.member.newRoleName,
          false,
        )
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Failed to redo')
      }
    }
  }, [redo, performRoleChange])

  // Keyboard shortcuts for undo/redo
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0
      const modKey = isMac ? e.metaKey : e.ctrlKey

      if (modKey && e.key === 'z' && !e.shiftKey) {
        e.preventDefault()
        if (canUndo()) {
          handleUndo()
        }
      } else if (modKey && (e.key === 'y' || (e.key === 'z' && e.shiftKey))) {
        e.preventDefault()
        if (canRedo()) {
          handleRedo()
        }
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [canUndo, canRedo, handleUndo, handleRedo])

  const handleToggleAdmin = async () => {
    if (!user) return

    const newValue = !user.isSystemAdmin
    const previousUser = user

    // Optimistic update
    queryClient.setQueryData<UserDetails>(['admin', 'users', userId], (old) =>
      old ? { ...old, isSystemAdmin: newValue } : old,
    )

    try {
      const res = await fetch(`/api/admin/users/${userId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'X-Tab-Id': getTabId(),
        },
        body: JSON.stringify({ isSystemAdmin: newValue }),
      })

      if (!res.ok) {
        // Rollback on error
        queryClient.setQueryData(['admin', 'users', userId], previousUser)
        const data = await res.json()
        throw new Error(data.error || 'Failed to update user')
      }

      // Update user list cache directly
      queryClient.setQueriesData<Array<{ id: string; isSystemAdmin?: boolean }>>(
        { queryKey: ['admin', 'users'], exact: true },
        (oldData) => {
          if (!oldData || !Array.isArray(oldData)) return oldData
          return oldData.map((u) => (u.id === userId ? { ...u, isSystemAdmin: newValue } : u))
        },
      )

      toast.success(
        newValue ? `${user.name} is now an admin` : `${user.name} is no longer an admin`,
      )
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to update user')
    }
  }

  const handleToggleActive = async () => {
    if (!user) return

    const newValue = !user.isActive
    const previousUser = user

    // Optimistic update
    queryClient.setQueryData<UserDetails>(['admin', 'users', userId], (old) =>
      old ? { ...old, isActive: newValue } : old,
    )

    try {
      const res = await fetch(`/api/admin/users/${userId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'X-Tab-Id': getTabId(),
        },
        body: JSON.stringify({ isActive: newValue }),
      })

      if (!res.ok) {
        // Rollback on error
        queryClient.setQueryData(['admin', 'users', userId], previousUser)
        const data = await res.json()
        throw new Error(data.error || 'Failed to update user')
      }

      // Update user list cache directly
      queryClient.setQueriesData<Array<{ id: string; isActive?: boolean }>>(
        { queryKey: ['admin', 'users'], exact: true },
        (oldData) => {
          if (!oldData || !Array.isArray(oldData)) return oldData
          return oldData.map((u) => (u.id === userId ? { ...u, isActive: newValue } : u))
        },
      )

      toast.success(newValue ? `${user.name} has been enabled` : `${user.name} has been disabled`)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to update user')
    }
  }

  const handleRoleChange = async (
    membershipId: string,
    projectId: string,
    newRoleId: string,
    newRoleName: string,
  ) => {
    if (!user) return

    const previousUser = user
    const membership = user.projects.find((p) => p.id === membershipId)
    if (!membership || membership.roleId === newRoleId) return

    const previousRoleId = membership.roleId
    const previousRoleName = membership.role.name

    // Optimistic update
    queryClient.setQueryData<UserDetails>(['admin', 'users', userId], (old) => {
      if (!old) return old
      return {
        ...old,
        projects: old.projects.map((p) =>
          p.id === membershipId
            ? { ...p, roleId: newRoleId, role: { ...p.role, id: newRoleId, name: newRoleName } }
            : p,
        ),
      }
    })

    try {
      const res = await fetch(`/api/projects/${projectId}/members/${membershipId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'X-Tab-Id': getTabId(),
        },
        body: JSON.stringify({ roleId: newRoleId }),
      })

      if (!res.ok) {
        // Rollback on error
        queryClient.setQueryData(['admin', 'users', userId], previousUser)
        const data = await res.json()
        throw new Error(data.error || 'Failed to update role')
      }

      // Push to undo stack
      pushMemberRoleChange({
        membershipId,
        projectId,
        targetUserId: userId,
        userName: user.name,
        previousRoleId,
        previousRoleName,
        newRoleId,
        newRoleName,
      })

      toast.success(`Role updated to ${newRoleName}`, {
        action: {
          label: 'Undo',
          onClick: handleUndo,
        },
      })
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to update role')
    }
  }

  if (isLoading) {
    return (
      <div className="h-full overflow-auto bg-zinc-950">
        <div className="max-w-3xl mx-auto px-6 py-12">
          <div className="animate-pulse space-y-8">
            <div className="h-8 w-48 bg-zinc-800 rounded" />
            <div className="h-32 bg-zinc-800 rounded-lg" />
            <div className="h-48 bg-zinc-800 rounded-lg" />
          </div>
        </div>
      </div>
    )
  }

  if (error || !user) {
    return (
      <div className="h-full overflow-auto bg-zinc-950">
        <div className="max-w-3xl mx-auto px-6 py-12">
          <Button variant="ghost" asChild className="mb-6">
            <Link href="/admin/users">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Users
            </Link>
          </Button>
          <Card className="border-zinc-800 bg-zinc-900/50">
            <CardContent className="py-12 text-center">
              <p className="text-zinc-400">
                {error instanceof Error ? error.message : 'User not found'}
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    )
  }

  const createdDate = new Date(user.createdAt).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })

  const updatedDate = new Date(user.updatedAt).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })

  return (
    <div className="h-full overflow-auto bg-zinc-950">
      {/* Header with gradient accent */}
      <div className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-amber-500/10 via-orange-500/5 to-transparent" />
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-amber-500/5 rounded-full blur-3xl" />
        <div className="absolute top-20 right-1/4 w-64 h-64 bg-orange-500/5 rounded-full blur-3xl" />

        <div className="relative max-w-3xl mx-auto px-6 py-8">
          <Button variant="ghost" asChild className="mb-4 -ml-2">
            <Link href="/admin/users">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Users
            </Link>
          </Button>

          <div className="flex items-center gap-6">
            <Avatar className="h-20 w-20 ring-4 ring-zinc-800">
              <AvatarImage src={user.avatar || undefined} alt={user.name} />
              <AvatarFallback
                className="text-2xl font-semibold text-white"
                style={{ backgroundColor: user.avatarColor || getAvatarColor(user.id) }}
              >
                {getInitials(user.name)}
              </AvatarFallback>
            </Avatar>
            <div>
              <div className="flex items-center gap-3">
                <h1 className="text-2xl font-bold text-zinc-100">{user.name}</h1>
                {user.isSystemAdmin && (
                  <Badge
                    variant="secondary"
                    className="bg-amber-500/20 text-amber-400 border-amber-500/30"
                  >
                    <Shield className="h-3 w-3 mr-1" />
                    Super Admin
                  </Badge>
                )}
                {!user.isActive && (
                  <Badge
                    variant="secondary"
                    className="bg-red-500/20 text-red-400 border-red-500/30"
                  >
                    <UserX className="h-3 w-3 mr-1" />
                    Disabled
                  </Badge>
                )}
              </div>
              <p className="text-zinc-400 mt-1">{user.email || 'No email'}</p>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-6 pb-16 space-y-6">
        {/* User Info */}
        <Card className="border-zinc-800 bg-zinc-900/50">
          <CardHeader className="pb-4">
            <div className="flex items-center gap-2">
              <User className="h-5 w-5 text-amber-500" />
              <CardTitle className="text-zinc-100">User Information</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1">
                <p className="text-sm text-zinc-500">Email</p>
                <div className="flex items-center gap-2">
                  <Mail className="h-4 w-4 text-zinc-500" />
                  <p className="text-zinc-200">{user.email || 'Not set'}</p>
                </div>
              </div>
              <div className="space-y-1">
                <p className="text-sm text-zinc-500">Projects</p>
                <div className="flex items-center gap-2">
                  <FolderKanban className="h-4 w-4 text-zinc-500" />
                  <p className="text-zinc-200">
                    {user._count.projects} project{user._count.projects !== 1 ? 's' : ''}
                  </p>
                </div>
              </div>
              <div className="space-y-1">
                <p className="text-sm text-zinc-500">Joined</p>
                <div className="flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-zinc-500" />
                  <p className="text-zinc-200">{createdDate}</p>
                </div>
              </div>
              <div className="space-y-1">
                <p className="text-sm text-zinc-500">Last Updated</p>
                <div className="flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-zinc-500" />
                  <p className="text-zinc-200">{updatedDate}</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Projects */}
        <Card className="border-zinc-800 bg-zinc-900/50">
          <CardHeader className="pb-4">
            <div className="flex items-center gap-2">
              <FolderKanban className="h-5 w-5 text-amber-500" />
              <CardTitle className="text-zinc-100">Projects</CardTitle>
            </div>
            <CardDescription className="text-zinc-500">
              Projects this user has access to
            </CardDescription>
          </CardHeader>
          <CardContent>
            {user.projects.length === 0 ? (
              <p className="text-zinc-500 text-sm">No project memberships</p>
            ) : (
              <div className="space-y-2">
                {user.projects.map((membership) => (
                  <div
                    key={membership.id}
                    className="flex items-center justify-between p-3 bg-zinc-800/50 rounded-lg"
                  >
                    <Link
                      href={`/projects/${membership.project.key}/board`}
                      className="flex items-center gap-3 hover:opacity-80 transition-opacity"
                    >
                      <div
                        className="w-8 h-8 rounded flex items-center justify-center text-white font-semibold text-sm"
                        style={{ backgroundColor: membership.project.color || '#71717a' }}
                      >
                        {membership.project.key.charAt(0)}
                      </div>
                      <div>
                        <p className="text-zinc-100 font-medium">{membership.project.name}</p>
                        <p className="text-zinc-500 text-sm">{membership.project.key}</p>
                      </div>
                    </Link>
                    <RoleSelector
                      membership={membership}
                      onRoleChange={(newRoleId, newRoleName) =>
                        handleRoleChange(
                          membership.id,
                          membership.project.id,
                          newRoleId,
                          newRoleName,
                        )
                      }
                    />
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Admin Controls */}
        <Card className="border-zinc-800 bg-zinc-900/50">
          <CardHeader className="pb-4">
            <div className="flex items-center gap-2">
              <Shield className="h-5 w-5 text-amber-500" />
              <CardTitle className="text-zinc-100">Admin Controls</CardTitle>
            </div>
            <CardDescription className="text-zinc-500">
              Manage this user's access and permissions
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between p-4 bg-zinc-800/50 rounded-lg">
              <div>
                <p className="font-medium text-zinc-100">Super Admin</p>
                <p className="text-sm text-zinc-400">
                  {user.isSystemAdmin
                    ? 'Has full access to manage all users and settings'
                    : 'Standard user without super admin privileges'}
                </p>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={handleToggleAdmin}
                className={
                  user.isSystemAdmin
                    ? 'border-zinc-600 text-zinc-300 hover:bg-zinc-800'
                    : 'border-amber-500/50 text-amber-400 hover:bg-amber-500/10'
                }
              >
                {user.isSystemAdmin ? (
                  <>
                    <ShieldOff className="h-4 w-4 mr-2" />
                    Remove Super Admin
                  </>
                ) : (
                  <>
                    <Shield className="h-4 w-4 mr-2" />
                    Make Super Admin
                  </>
                )}
              </Button>
            </div>

            <div className="flex items-center justify-between p-4 bg-zinc-800/50 rounded-lg">
              <div>
                <p className="font-medium text-zinc-100">Account Status</p>
                <p className="text-sm text-zinc-400">
                  {user.isActive
                    ? 'User can sign in and access the system'
                    : 'User is blocked from signing in'}
                </p>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={handleToggleActive}
                className={
                  user.isActive
                    ? 'border-red-500/50 text-red-400 hover:bg-red-500/10'
                    : 'border-green-500/50 text-green-400 hover:bg-green-500/10'
                }
              >
                {user.isActive ? (
                  <>
                    <UserX className="h-4 w-4 mr-2" />
                    Disable User
                  </>
                ) : (
                  <>
                    <UserCheck className="h-4 w-4 mr-2" />
                    Enable User
                  </>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

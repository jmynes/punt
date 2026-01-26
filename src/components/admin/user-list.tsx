'use client'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  AlertTriangle,
  ArrowUpDown,
  CheckSquare,
  Eye,
  EyeOff,
  Filter,
  Loader2,
  Minus,
  MoreHorizontal,
  Search,
  Shield,
  ShieldOff,
  Square,
  Trash2,
  UserCheck,
  User as UserIcon,
  Users,
  UserX,
  X,
} from 'lucide-react'
import Link from 'next/link'
import { useCallback, useEffect, useState } from 'react'
import { toast } from 'sonner'

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useCurrentUser } from '@/hooks/use-current-user'
import { getTabId } from '@/hooks/use-realtime'
import { useAdminUndoStore } from '@/stores/admin-undo-store'
import { CreateUserDialog } from './create-user-dialog'

interface User {
  id: string
  name: string
  email: string
  avatar: string | null
  isSystemAdmin: boolean
  isActive: boolean
  createdAt: string
  lastLoginAt: string | null
  _count: { projects: number }
}

type SortField = 'name' | 'lastLoginAt' | 'createdAt'
type SortDir = 'asc' | 'desc'
type RoleFilter = 'all' | 'admin' | 'standard'
type BulkAction = 'disable' | 'enable' | 'makeAdmin' | 'removeAdmin' | null

const sortLabels: Record<SortField, string> = {
  name: 'Name',
  lastLoginAt: 'Last Login',
  createdAt: 'Date Created',
}

export function UserList() {
  const queryClient = useQueryClient()
  const currentUser = useCurrentUser()
  const tabId = getTabId()
  const [deleteUserId, setDeleteUserId] = useState<string | null>(null)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [lastSelectedId, setLastSelectedId] = useState<string | null>(null)
  const [bulkAction, setBulkAction] = useState<BulkAction>(null)

  // Bulk delete confirmation state (requires credentials)
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false)
  const [deleteEmail, setDeleteEmail] = useState('')
  const [deletePassword, setDeletePassword] = useState('')
  const [showDeletePassword, setShowDeletePassword] = useState(false)
  const [deleteError, setDeleteError] = useState('')

  // Undo store
  const {
    pushUserDisable,
    pushUserEnable,
    pushUserMakeAdmin,
    pushUserRemoveAdmin,
    undo,
    redo,
    canUndo,
    canRedo,
  } = useAdminUndoStore()

  // Filter and sort state
  const [search, setSearch] = useState('')
  const [sort, setSort] = useState<SortField>('name')
  const [sortDir, setSortDir] = useState<SortDir>('asc')
  const [roleFilter, setRoleFilter] = useState<RoleFilter>('all')
  const [minProjects, setMinProjects] = useState('')
  const [maxProjects, setMaxProjects] = useState('')

  // Build query string
  const buildQueryString = () => {
    const params = new URLSearchParams()
    if (search) params.set('search', search)
    params.set('sort', sort)
    params.set('sortDir', sortDir)
    if (roleFilter !== 'all') params.set('role', roleFilter)
    if (minProjects) params.set('minProjects', minProjects)
    if (maxProjects) params.set('maxProjects', maxProjects)
    return params.toString()
  }

  const {
    data: users,
    isLoading,
    error,
  } = useQuery<User[]>({
    queryKey: ['admin', 'users', search, sort, sortDir, roleFilter, minProjects, maxProjects],
    queryFn: async () => {
      const queryString = buildQueryString()
      const res = await fetch(`/api/admin/users?${queryString}`)
      if (!res.ok) {
        throw new Error('Failed to fetch users')
      }
      return res.json()
    },
  })

  // Clear selection when users change (e.g., after delete)
  useEffect(() => {
    if (users) {
      const validIds = new Set(users.map((u) => u.id))
      setSelectedIds((prev) => {
        const newSelection = new Set([...prev].filter((id) => validIds.has(id)))
        return newSelection.size !== prev.size ? newSelection : prev
      })
    }
  }, [users])

  const updateUser = useMutation({
    mutationFn: async ({
      userId,
      updates,
      previousUser,
    }: {
      userId: string
      updates: Partial<User>
      previousUser?: User
    }) => {
      const res = await fetch(`/api/admin/users/${userId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', 'X-Tab-Id': tabId },
        body: JSON.stringify(updates),
      })
      if (!res.ok) {
        const error = await res.json()
        throw new Error(error.error || 'Failed to update user')
      }
      const updatedUser = await res.json()
      return { user: updatedUser, updates, previousUser }
    },
    onSuccess: ({ user, updates, previousUser }) => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'users'] })

      // Show toast for admin status changes and track for undo
      if ('isSystemAdmin' in updates && previousUser) {
        const userSnapshot = {
          id: previousUser.id,
          name: previousUser.name,
          email: previousUser.email,
          isSystemAdmin: previousUser.isSystemAdmin,
          isActive: previousUser.isActive,
        }

        if (updates.isSystemAdmin) {
          pushUserMakeAdmin([userSnapshot])
          toast.success(`${user.name} is now an admin (Ctrl+Z to undo)`)
        } else {
          pushUserRemoveAdmin([userSnapshot])
          toast.success(`${user.name} is no longer an admin (Ctrl+Z to undo)`)
        }
      }
    },
    onError: (error) => {
      toast.error(error.message)
    },
  })

  const deleteUser = useMutation({
    mutationFn: async ({ userId, permanent }: { userId: string; permanent: boolean }) => {
      const url = permanent
        ? `/api/admin/users/${userId}?permanent=true`
        : `/api/admin/users/${userId}`
      const res = await fetch(url, { method: 'DELETE' })
      if (!res.ok) {
        const error = await res.json()
        throw new Error(error.error || 'Failed to delete user')
      }
      return res.json()
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'users'] })
      toast.success(data.action === 'deleted' ? 'User permanently deleted' : 'User disabled')
      setDeleteUserId(null)
    },
    onError: (error) => {
      toast.error(error.message)
    },
  })

  // Bulk update mutation
  const bulkUpdateUsers = useMutation({
    mutationFn: async ({ userIds, updates }: { userIds: string[]; updates: Partial<User> }) => {
      // Filter to only users who actually need the change
      let usersToUpdate = users?.filter((u) => userIds.includes(u.id)) || []
      let skipped = 0

      if ('isSystemAdmin' in updates) {
        // Only update users whose admin status differs from the target
        const targetAdminStatus = updates.isSystemAdmin
        const usersNeedingChange = usersToUpdate.filter(
          (u) => u.isSystemAdmin !== targetAdminStatus,
        )
        skipped = usersToUpdate.length - usersNeedingChange.length
        usersToUpdate = usersNeedingChange
      }

      if (usersToUpdate.length === 0) {
        return { succeeded: 0, failed: 0, skipped, updates, actualUsers: [] }
      }

      const results = await Promise.allSettled(
        usersToUpdate.map((user) =>
          fetch(`/api/admin/users/${user.id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json', 'X-Tab-Id': tabId },
            body: JSON.stringify(updates),
          }).then((res) => {
            if (!res.ok) throw new Error('Failed')
            return res.json()
          }),
        ),
      )
      const succeeded = results.filter((r) => r.status === 'fulfilled').length
      const failed = results.filter((r) => r.status === 'rejected').length
      return { succeeded, failed, skipped, updates, actualUsers: usersToUpdate }
    },
    onSuccess: ({ succeeded, failed, skipped, updates, actualUsers }) => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'users'] })

      // Track admin changes for undo
      if ('isSystemAdmin' in updates && succeeded > 0) {
        const userSnapshots = actualUsers.slice(0, succeeded).map((u) => ({
          id: u.id,
          name: u.name,
          email: u.email,
          isSystemAdmin: u.isSystemAdmin,
          isActive: u.isActive,
        }))

        if (updates.isSystemAdmin) {
          pushUserMakeAdmin(userSnapshots)
        } else {
          pushUserRemoveAdmin(userSnapshots)
        }
      }

      // Handle case where all users were already in the target state
      if (succeeded === 0 && skipped > 0) {
        const state =
          'isSystemAdmin' in updates
            ? updates.isSystemAdmin
              ? 'admins'
              : 'non-admins'
            : 'in that state'
        toast.info(
          `All ${skipped} selected user${skipped !== 1 ? 's were' : ' was'} already ${state}`,
        )
        setSelectedIds(new Set())
        setBulkAction(null)
        return
      }

      // Create specific message for admin status changes
      let message: string
      if ('isSystemAdmin' in updates) {
        const action = updates.isSystemAdmin
          ? 'granted admin privileges to'
          : 'removed admin privileges from'
        message = `Successfully ${action} ${succeeded} user${succeeded !== 1 ? 's' : ''}`
      } else {
        message = `Updated ${succeeded} user${succeeded !== 1 ? 's' : ''}`
      }

      const extra =
        skipped > 0 ? ` (${skipped} already ${updates.isSystemAdmin ? 'admin' : 'non-admin'})` : ''

      if (failed === 0) {
        toast.success(`${message}${extra} (Ctrl+Z to undo)`)
      } else {
        toast.warning(`${message}, failed ${failed}`)
      }
      setSelectedIds(new Set())
      setBulkAction(null)
    },
    onError: () => {
      toast.error('Bulk update failed')
      setBulkAction(null)
    },
  })

  // Bulk disable - undoable (only affects currently active users)
  const bulkDisableUsers = useMutation({
    mutationFn: async (userIds: string[]) => {
      // Filter to only users who are currently active
      const usersToDisable = users?.filter((u) => userIds.includes(u.id) && u.isActive) || []
      if (usersToDisable.length === 0) {
        return { succeeded: 0, failed: 0, skipped: userIds.length, actualUsers: [] }
      }

      const results = await Promise.allSettled(
        usersToDisable.map((user) =>
          fetch(`/api/admin/users/${user.id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json', 'X-Tab-Id': tabId },
            body: JSON.stringify({ isActive: false }),
          }).then((res) => {
            if (!res.ok) throw new Error('Failed')
            return res.json()
          }),
        ),
      )
      const succeeded = results.filter((r) => r.status === 'fulfilled').length
      const failed = results.filter((r) => r.status === 'rejected').length
      const skipped = userIds.length - usersToDisable.length
      return { succeeded, failed, skipped, actualUsers: usersToDisable }
    },
    onSuccess: ({ succeeded, failed, skipped, actualUsers }) => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'users'] })

      // Store for undo - only the users that were actually disabled
      if (actualUsers.length > 0 && succeeded > 0) {
        pushUserDisable(
          actualUsers.slice(0, succeeded).map((u) => ({
            id: u.id,
            name: u.name,
            email: u.email,
            isSystemAdmin: u.isSystemAdmin,
            isActive: true, // They were active before
          })),
        )
      }

      if (succeeded === 0 && skipped > 0) {
        toast.info(
          `All ${skipped} selected user${skipped !== 1 ? 's were' : ' was'} already disabled`,
        )
      } else if (failed === 0) {
        const msg = `Disabled ${succeeded} user${succeeded !== 1 ? 's' : ''}`
        const extra = skipped > 0 ? ` (${skipped} already disabled)` : ''
        toast.success(`${msg}${extra} (Ctrl+Z to undo)`)
      } else {
        toast.warning(`Disabled ${succeeded}, failed ${failed}`)
      }
      setSelectedIds(new Set())
      setBulkAction(null)
    },
    onError: () => {
      toast.error('Bulk disable failed')
      setBulkAction(null)
    },
  })

  // Bulk enable - undoable (only affects currently disabled users)
  const bulkEnableUsers = useMutation({
    mutationFn: async (userIds: string[]) => {
      // Filter to only users who are currently disabled
      const usersToEnable = users?.filter((u) => userIds.includes(u.id) && !u.isActive) || []
      if (usersToEnable.length === 0) {
        return { succeeded: 0, failed: 0, skipped: userIds.length, actualUsers: [] }
      }

      const results = await Promise.allSettled(
        usersToEnable.map((user) =>
          fetch(`/api/admin/users/${user.id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json', 'X-Tab-Id': tabId },
            body: JSON.stringify({ isActive: true }),
          }).then((res) => {
            if (!res.ok) throw new Error('Failed')
            return res.json()
          }),
        ),
      )
      const succeeded = results.filter((r) => r.status === 'fulfilled').length
      const failed = results.filter((r) => r.status === 'rejected').length
      const skipped = userIds.length - usersToEnable.length
      return { succeeded, failed, skipped, actualUsers: usersToEnable }
    },
    onSuccess: ({ succeeded, failed, skipped, actualUsers }) => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'users'] })

      // Store for undo - only the users that were actually enabled
      if (actualUsers.length > 0 && succeeded > 0) {
        pushUserEnable(
          actualUsers.slice(0, succeeded).map((u) => ({
            id: u.id,
            name: u.name,
            email: u.email,
            isSystemAdmin: u.isSystemAdmin,
            isActive: false, // They were disabled before
          })),
        )
      }

      if (succeeded === 0 && skipped > 0) {
        toast.info(
          `All ${skipped} selected user${skipped !== 1 ? 's were' : ' was'} already enabled`,
        )
      } else if (failed === 0) {
        const msg = `Enabled ${succeeded} user${succeeded !== 1 ? 's' : ''}`
        const extra = skipped > 0 ? ` (${skipped} already enabled)` : ''
        toast.success(`${msg}${extra} (Ctrl+Z to undo)`)
      } else {
        toast.warning(`Enabled ${succeeded}, failed ${failed}`)
      }
      setSelectedIds(new Set())
      setBulkAction(null)
    },
    onError: () => {
      toast.error('Bulk enable failed')
      setBulkAction(null)
    },
  })

  // Bulk permanent delete - requires credential verification
  const bulkPermanentDeleteUsers = useMutation({
    mutationFn: async ({
      userIds,
      email,
      password,
    }: {
      userIds: string[]
      email: string
      password: string
    }) => {
      // First verify credentials
      const verifyRes = await fetch('/api/auth/verify-credentials', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Tab-Id': tabId },
        body: JSON.stringify({ email, password }),
      })

      if (!verifyRes.ok) {
        const error = await verifyRes.json()
        throw new Error(error.error || 'Invalid credentials')
      }

      // Now delete users permanently
      const results = await Promise.allSettled(
        userIds.map((userId) =>
          fetch(`/api/admin/users/${userId}?permanent=true`, {
            method: 'DELETE',
          }).then((res) => {
            if (!res.ok) throw new Error('Failed')
            return res.json()
          }),
        ),
      )
      const succeeded = results.filter((r) => r.status === 'fulfilled').length
      const failed = results.filter((r) => r.status === 'rejected').length
      return { succeeded, failed }
    },
    onSuccess: ({ succeeded, failed }) => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'users'] })

      if (failed === 0) {
        toast.success(`Permanently deleted ${succeeded} user${succeeded !== 1 ? 's' : ''}`)
      } else {
        toast.warning(`Deleted ${succeeded}, failed ${failed}`)
      }
      setSelectedIds(new Set())
      closeBulkDeleteDialog()
    },
    onError: (error) => {
      setDeleteError(error.message)
    },
  })

  const closeBulkDeleteDialog = () => {
    setBulkDeleteOpen(false)
    setDeleteEmail('')
    setDeletePassword('')
    setShowDeletePassword(false)
    setDeleteError('')
  }

  const openBulkDeleteDialog = () => {
    setDeleteError('')
    setBulkDeleteOpen(true)
  }

  // Handle undo - reverse the last action
  const handleUndo = useCallback(async () => {
    const action = undo()
    if (!action) return

    try {
      let updates: Partial<User>
      let verb: string

      switch (action.type) {
        case 'userDisable':
          updates = { isActive: true }
          verb = 'Re-enabled'
          break
        case 'userEnable':
          updates = { isActive: false }
          verb = 'Re-disabled'
          break
        case 'userMakeAdmin':
          updates = { isSystemAdmin: false }
          verb = 'Removed admin from'
          break
        case 'userRemoveAdmin':
          updates = { isSystemAdmin: true }
          verb = 'Restored admin to'
          break
      }

      await Promise.all(
        action.users.map((user) =>
          fetch(`/api/admin/users/${user.id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json', 'X-Tab-Id': tabId },
            body: JSON.stringify(updates),
          }),
        ),
      )
      queryClient.invalidateQueries({ queryKey: ['admin', 'users'] })

      toast.success(
        `${verb} ${action.users.length} user${action.users.length !== 1 ? 's' : ''} (Ctrl+Y to redo)`,
      )
    } catch {
      toast.error('Failed to undo')
    }
  }, [undo, queryClient, tabId])

  // Handle redo - repeat the action
  const handleRedo = useCallback(async () => {
    const action = redo()
    if (!action) return

    try {
      let updates: Partial<User>
      let verb: string

      switch (action.type) {
        case 'userDisable':
          updates = { isActive: false }
          verb = 'Re-disabled'
          break
        case 'userEnable':
          updates = { isActive: true }
          verb = 'Re-enabled'
          break
        case 'userMakeAdmin':
          updates = { isSystemAdmin: true }
          verb = 'Re-granted admin to'
          break
        case 'userRemoveAdmin':
          updates = { isSystemAdmin: false }
          verb = 'Re-removed admin from'
          break
      }

      await Promise.all(
        action.users.map((user) =>
          fetch(`/api/admin/users/${user.id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json', 'X-Tab-Id': tabId },
            body: JSON.stringify(updates),
          }),
        ),
      )
      queryClient.invalidateQueries({ queryKey: ['admin', 'users'] })

      toast.success(
        `${verb} ${action.users.length} user${action.users.length !== 1 ? 's' : ''} (Ctrl+Z to undo)`,
      )
    } catch {
      toast.error('Failed to redo')
    }
  }, [redo, queryClient, tabId])

  // Keyboard shortcuts for undo/redo
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'z' && !e.shiftKey) {
        e.preventDefault()
        if (canUndo()) handleUndo()
      }
      if ((e.metaKey || e.ctrlKey) && (e.key === 'y' || (e.key === 'z' && e.shiftKey))) {
        e.preventDefault()
        if (canRedo()) handleRedo()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [handleUndo, handleRedo, canUndo, canRedo])

  const userToDelete = deleteUserId ? users?.find((u) => u.id === deleteUserId) : null
  const selectedUsers = users?.filter((u) => selectedIds.has(u.id)) || []

  // Separate current user from other users
  const currentUserData = users?.find((u) => u.id === currentUser?.id)
  const otherUsers = users?.filter((u) => u.id !== currentUser?.id) || []

  const formatDate = (dateString: string | null) => {
    if (!dateString) return 'Never'
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    })
  }

  const hasActiveFilters = search || roleFilter !== 'all' || minProjects || maxProjects

  const clearFilters = () => {
    setSearch('')
    setRoleFilter('all')
    setMinProjects('')
    setMaxProjects('')
  }

  const toggleSortDirection = () => {
    setSortDir(sortDir === 'asc' ? 'desc' : 'asc')
  }

  // Selection helpers
  const handleSelect = (userId: string, shiftKey: boolean) => {
    // Shift-click range selection/deselection
    if (shiftKey && lastSelectedId && users) {
      const userIds = users.map((u) => u.id)
      const lastIndex = userIds.indexOf(lastSelectedId)
      const currentIndex = userIds.indexOf(userId)

      if (lastIndex !== -1 && currentIndex !== -1) {
        const start = Math.min(lastIndex, currentIndex)
        const end = Math.max(lastIndex, currentIndex)
        const rangeIds = userIds.slice(start, end + 1)

        setSelectedIds((prev) => {
          const next = new Set(prev)
          // Check if all in range are selected - if so, deselect them
          const allSelected = rangeIds.every((id) => prev.has(id))
          for (const id of rangeIds) {
            if (allSelected) {
              next.delete(id)
            } else {
              next.add(id)
            }
          }
          return next
        })
        return
      }
    }

    // Normal toggle
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(userId)) {
        next.delete(userId)
      } else {
        next.add(userId)
      }
      return next
    })
    setLastSelectedId(userId)
  }

  const toggleSelect = (userId: string) => {
    handleSelect(userId, false)
  }

  const selectAll = () => {
    if (users) {
      // Exclude current user from select all
      setSelectedIds(new Set(users.filter((u) => u.id !== currentUser?.id).map((u) => u.id)))
    }
  }

  const selectNone = () => {
    setSelectedIds(new Set())
  }

  // Check if all "other" users are selected (excluding current user)
  const selectableUsers = users?.filter((u) => u.id !== currentUser?.id) || []
  const allSelected = selectableUsers.length > 0 && selectedIds.size >= selectableUsers.length
  const someSelected = selectedIds.size > 0 && !allSelected

  // Render a user card
  const renderUserCard = (user: User, isCurrentUser: boolean) => {
    const isSelected = selectedIds.has(user.id)
    return (
      <Card
        key={user.id}
        onMouseDown={(e) => {
          if (e.shiftKey) e.preventDefault()
        }}
        onClick={(e) => handleSelect(user.id, e.shiftKey)}
        className={`border-zinc-800 bg-zinc-900/50 transition-all duration-150 cursor-pointer ${
          isSelected
            ? 'ring-1 ring-amber-500/50 bg-amber-500/5 border-amber-500/30'
            : 'hover:bg-zinc-900/80'
        }`}
      >
        <CardContent className="flex items-center justify-between p-4">
          <div className="flex items-center gap-3">
            <Checkbox
              checked={isSelected}
              onCheckedChange={() => toggleSelect(user.id)}
              onClick={(e) => e.stopPropagation()}
              className="border-zinc-500 data-[state=checked]:border-amber-500 data-[state=checked]:bg-amber-600"
            />
            <Avatar>
              <AvatarImage src={user.avatar || undefined} />
              <AvatarFallback className="bg-zinc-700 text-zinc-300">
                {user.name.charAt(0).toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-medium text-zinc-100">{user.name}</span>
                {isCurrentUser && (
                  <Badge variant="outline" className="border-zinc-500 text-zinc-400 text-xs">
                    You
                  </Badge>
                )}
                {user.isSystemAdmin && (
                  <Badge variant="outline" className="border-amber-500 text-amber-500 text-xs">
                    Admin
                  </Badge>
                )}
                {!user.isActive && (
                  <Badge variant="outline" className="border-red-500 text-red-500 text-xs">
                    Disabled
                  </Badge>
                )}
              </div>
              <span className="text-sm text-zinc-500">{user.email}</span>
            </div>
          </div>

          <div className="flex items-center gap-6">
            <div className="text-right hidden sm:block">
              <div className="text-xs text-zinc-500">Last login</div>
              <div className="text-sm text-zinc-400">{formatDate(user.lastLoginAt)}</div>
            </div>
            <div className="text-right hidden md:block">
              <div className="text-xs text-zinc-500">Created</div>
              <div className="text-sm text-zinc-400">{formatDate(user.createdAt)}</div>
            </div>
            <span className="text-sm text-zinc-500 min-w-[80px] text-right">
              {user._count.projects} project{user._count.projects !== 1 ? 's' : ''}
            </span>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="text-zinc-400 hover:text-zinc-100"
                  onClick={(e) => e.stopPropagation()}
                >
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="bg-zinc-900 border-zinc-800">
                <DropdownMenuItem
                  asChild
                  className="text-zinc-300 focus:text-zinc-100 focus:bg-zinc-800"
                >
                  <Link href={`/admin/users/${user.id}`}>
                    <UserIcon className="h-4 w-4 mr-2" />
                    View profile
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuSeparator className="bg-zinc-800" />
                <DropdownMenuItem
                  onClick={() =>
                    updateUser.mutate({
                      userId: user.id,
                      updates: { isSystemAdmin: !user.isSystemAdmin },
                      previousUser: user,
                    })
                  }
                  className="text-zinc-300 focus:text-zinc-100 focus:bg-zinc-800"
                >
                  {user.isSystemAdmin ? (
                    <>
                      <ShieldOff className="h-4 w-4 mr-2" />
                      Remove admin
                    </>
                  ) : (
                    <>
                      <Shield className="h-4 w-4 mr-2" />
                      Make admin
                    </>
                  )}
                </DropdownMenuItem>
                <DropdownMenuSeparator className="bg-zinc-800" />
                <DropdownMenuItem
                  onClick={() =>
                    updateUser.mutate({
                      userId: user.id,
                      updates: { isActive: !user.isActive },
                    })
                  }
                  className={
                    user.isActive
                      ? 'text-red-400 focus:text-red-300 focus:bg-zinc-800'
                      : 'text-green-400 focus:text-green-300 focus:bg-zinc-800'
                  }
                >
                  {user.isActive ? (
                    <>
                      <UserX className="h-4 w-4 mr-2" />
                      Disable user
                    </>
                  ) : (
                    <>
                      <UserCheck className="h-4 w-4 mr-2" />
                      Enable user
                    </>
                  )}
                </DropdownMenuItem>
                <DropdownMenuSeparator className="bg-zinc-800" />
                <DropdownMenuItem
                  onClick={() => setDeleteUserId(user.id)}
                  className="text-red-400 focus:text-red-300 focus:bg-zinc-800"
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Delete permanently
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </CardContent>
      </Card>
    )
  }

  // Bulk action handlers
  const handleBulkAction = (action: BulkAction) => {
    if (!action || selectedIds.size === 0) return
    setBulkAction(action)
  }

  const confirmBulkAction = () => {
    const ids = [...selectedIds]
    switch (bulkAction) {
      case 'disable':
        bulkDisableUsers.mutate(ids)
        break
      case 'enable':
        bulkEnableUsers.mutate(ids)
        break
      case 'makeAdmin':
        bulkUpdateUsers.mutate({ userIds: ids, updates: { isSystemAdmin: true } })
        break
      case 'removeAdmin':
        bulkUpdateUsers.mutate({ userIds: ids, updates: { isSystemAdmin: false } })
        break
    }
  }

  const handleBulkDelete = () => {
    if (!deleteEmail || !deletePassword) {
      setDeleteError('Please enter your email and password')
      return
    }
    if (deleteEmail !== currentUser?.email) {
      setDeleteError('Email does not match your account')
      return
    }
    bulkPermanentDeleteUsers.mutate({
      userIds: [...selectedIds],
      email: deleteEmail,
      password: deletePassword,
    })
  }

  const getBulkActionDescription = () => {
    const count = selectedIds.size
    switch (bulkAction) {
      case 'disable':
        return `Disable ${count} user${count !== 1 ? 's' : ''}? They won't be able to log in. This action can be undone.`
      case 'enable':
        return `Enable ${count} user${count !== 1 ? 's' : ''}? They will be able to log in again.`
      case 'makeAdmin':
        return `Grant admin privileges to ${count} user${count !== 1 ? 's' : ''}?`
      case 'removeAdmin':
        return `Remove admin privileges from ${count} user${count !== 1 ? 's' : ''}?`
      default:
        return ''
    }
  }

  return (
    <div className="flex-1 flex flex-col overflow-hidden min-h-0">
      {/* Header */}
      <div className="flex items-center justify-between py-6 flex-shrink-0">
        <div className="flex items-center gap-3">
          <Users className="h-6 w-6 text-amber-500" />
          <h1 className="text-2xl font-semibold text-zinc-100">
            Users {users && <span className="text-zinc-500">– {users.length}</span>}
          </h1>
        </div>
        <CreateUserDialog />
      </div>

      {/* Search and filters toolbar - fixed */}
      <div className="flex flex-col gap-3 mb-4 flex-shrink-0">
        <div className="flex flex-wrap gap-3">
          {/* Search */}
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-500" />
            <Input
              placeholder="Search by name or email..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 bg-zinc-900 border-zinc-800 text-zinc-100 placeholder:text-zinc-500"
            />
          </div>

          {/* Sort dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="outline"
                className="border-zinc-800 bg-zinc-900 text-zinc-300 hover:bg-zinc-800 hover:text-zinc-100"
              >
                <ArrowUpDown className="h-4 w-4 mr-2" />
                {sortLabels[sort]}
                <span className="ml-1 text-zinc-500">({sortDir === 'asc' ? 'A-Z' : 'Z-A'})</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="bg-zinc-900 border-zinc-800">
              <DropdownMenuLabel className="text-zinc-400">Sort by</DropdownMenuLabel>
              <DropdownMenuRadioGroup value={sort} onValueChange={(v) => setSort(v as SortField)}>
                <DropdownMenuRadioItem
                  value="name"
                  className="text-zinc-300 focus:text-zinc-100 focus:bg-zinc-800"
                >
                  Name
                </DropdownMenuRadioItem>
                <DropdownMenuRadioItem
                  value="lastLoginAt"
                  className="text-zinc-300 focus:text-zinc-100 focus:bg-zinc-800"
                >
                  Last Login
                </DropdownMenuRadioItem>
                <DropdownMenuRadioItem
                  value="createdAt"
                  className="text-zinc-300 focus:text-zinc-100 focus:bg-zinc-800"
                >
                  Date Created
                </DropdownMenuRadioItem>
              </DropdownMenuRadioGroup>
              <DropdownMenuSeparator className="bg-zinc-800" />
              <DropdownMenuItem
                onClick={toggleSortDirection}
                className="text-zinc-300 focus:text-zinc-100 focus:bg-zinc-800"
              >
                {sortDir === 'asc' ? 'Sort Descending' : 'Sort Ascending'}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Role filter */}
          <Select value={roleFilter} onValueChange={(v) => setRoleFilter(v as RoleFilter)}>
            <SelectTrigger className="w-[140px] border-zinc-800 bg-zinc-900 text-zinc-300">
              <SelectValue placeholder="All roles" />
            </SelectTrigger>
            <SelectContent className="bg-zinc-900 border-zinc-800">
              <SelectItem
                value="all"
                className="text-zinc-300 focus:text-zinc-100 focus:bg-zinc-800"
              >
                All Users
              </SelectItem>
              <SelectItem
                value="admin"
                className="text-zinc-300 focus:text-zinc-100 focus:bg-zinc-800"
              >
                Admins
              </SelectItem>
              <SelectItem
                value="standard"
                className="text-zinc-300 focus:text-zinc-100 focus:bg-zinc-800"
              >
                Standard
              </SelectItem>
            </SelectContent>
          </Select>

          {/* Projects filter */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="outline"
                className={`border-zinc-800 bg-zinc-900 text-zinc-300 hover:bg-zinc-800 hover:text-zinc-100 ${
                  minProjects || maxProjects ? 'border-indigo-500' : ''
                }`}
              >
                <Filter className="h-4 w-4 mr-2" />
                Projects
                {(minProjects || maxProjects) && (
                  <Badge variant="secondary" className="ml-2 bg-indigo-500/20 text-indigo-300">
                    {minProjects || '0'}-{maxProjects || '*'}
                  </Badge>
                )}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="bg-zinc-900 border-zinc-800 p-3 w-[200px]">
              <div className="space-y-3">
                <div>
                  <label htmlFor="min-projects-filter" className="text-xs text-zinc-500 mb-1 block">
                    Min Projects
                  </label>
                  <Input
                    id="min-projects-filter"
                    type="number"
                    min="0"
                    value={minProjects}
                    onChange={(e) => setMinProjects(e.target.value)}
                    placeholder="0"
                    className="bg-zinc-800 border-zinc-700 text-zinc-100"
                  />
                </div>
                <div>
                  <label htmlFor="max-projects-filter" className="text-xs text-zinc-500 mb-1 block">
                    Max Projects
                  </label>
                  <Input
                    id="max-projects-filter"
                    type="number"
                    min="0"
                    value={maxProjects}
                    onChange={(e) => setMaxProjects(e.target.value)}
                    placeholder="Any"
                    className="bg-zinc-800 border-zinc-700 text-zinc-100"
                  />
                </div>
              </div>
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Clear filters */}
          {hasActiveFilters && (
            <Button
              variant="ghost"
              size="icon"
              onClick={clearFilters}
              className="text-zinc-400 hover:text-zinc-100"
              title="Clear all filters"
            >
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>

        {/* Active filters summary */}
        {hasActiveFilters && (
          <div className="flex items-center gap-2 text-sm text-zinc-500">
            <span>Showing {users?.length ?? 0} users</span>
            {search && (
              <Badge variant="outline" className="border-zinc-700 text-zinc-400">
                Search: {search}
              </Badge>
            )}
            {roleFilter !== 'all' && (
              <Badge variant="outline" className="border-zinc-700 text-zinc-400">
                {roleFilter === 'admin' ? 'Admins only' : 'Standard only'}
              </Badge>
            )}
            {(minProjects || maxProjects) && (
              <Badge variant="outline" className="border-zinc-700 text-zinc-400">
                Projects: {minProjects || '0'} - {maxProjects || 'any'}
              </Badge>
            )}
          </div>
        )}
      </div>

      {/* Select all row */}
      {users && users.length > 0 && (
        <div className="flex items-center gap-3 mb-3 px-1 flex-shrink-0">
          <button
            type="button"
            onClick={allSelected ? selectNone : selectAll}
            className="flex items-center gap-2 text-sm text-zinc-400 hover:text-zinc-200 transition-colors"
          >
            {allSelected ? (
              <CheckSquare className="h-4 w-4 text-amber-500" />
            ) : someSelected ? (
              <Minus className="h-4 w-4 text-amber-500" />
            ) : (
              <Square className="h-4 w-4" />
            )}
            <span>
              {selectedIds.size > 0 ? `${selectedIds.size} selected` : 'Select all other Users'}
            </span>
          </button>
          {selectedIds.size > 0 && (
            <button
              type="button"
              onClick={selectNone}
              className="text-sm text-zinc-500 hover:text-zinc-300 transition-colors"
            >
              Clear
            </button>
          )}
        </div>
      )}

      {/* User list - scrollable container */}
      <div className="flex-1 overflow-y-auto min-h-0">
        {isLoading ? (
          <div className="space-y-3">
            {[...Array(3)].map((_, i) => (
              <div key={`skeleton-${i}`} className="h-20 bg-zinc-800/50 rounded-lg animate-pulse" />
            ))}
          </div>
        ) : error ? (
          <div className="text-center py-8 text-red-400">
            Failed to load users. Please try again.
          </div>
        ) : !users?.length ? (
          <div className="text-center py-8 text-zinc-500">
            {hasActiveFilters
              ? 'No users match your filters.'
              : 'No users found. Create your first user above.'}
          </div>
        ) : (
          <div className="space-y-2">
            {/* Current user section */}
            {currentUserData && (
              <>
                {renderUserCard(currentUserData, true)}
                {otherUsers.length > 0 && (
                  <div className="flex items-center gap-3 py-3">
                    <div className="flex-1 h-px bg-zinc-800" />
                    <span className="text-xs text-zinc-600 uppercase tracking-wider">
                      Other Users
                    </span>
                    <div className="flex-1 h-px bg-zinc-800" />
                  </div>
                )}
              </>
            )}
            {/* Other users */}
            {otherUsers.map((user) => renderUserCard(user, false))}
          </div>
        )}
      </div>

      {/* Floating bulk action bar */}
      {selectedIds.size > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 animate-in slide-in-from-bottom-4 fade-in duration-200">
          <div className="flex items-center gap-2 px-4 py-3 bg-zinc-900 border border-zinc-700 rounded-xl shadow-2xl shadow-black/50">
            <span className="text-sm text-zinc-300 font-medium pr-2 border-r border-zinc-700">
              {selectedIds.size} selected
            </span>

            <Button
              variant="ghost"
              size="sm"
              onClick={() => handleBulkAction('makeAdmin')}
              className="text-zinc-300 hover:text-amber-400 hover:bg-amber-500/10"
            >
              <Shield className="h-4 w-4 mr-1.5" />
              Make Admin
            </Button>

            <Button
              variant="ghost"
              size="sm"
              onClick={() => handleBulkAction('removeAdmin')}
              className="text-zinc-300 hover:text-zinc-100 hover:bg-zinc-800"
            >
              <ShieldOff className="h-4 w-4 mr-1.5" />
              Remove Admin
            </Button>

            <div className="w-px h-6 bg-zinc-700" />

            <Button
              variant="ghost"
              size="sm"
              onClick={() => handleBulkAction('enable')}
              className="text-zinc-300 hover:text-green-400 hover:bg-green-500/10"
            >
              <UserCheck className="h-4 w-4 mr-1.5" />
              Enable
            </Button>

            <Button
              variant="ghost"
              size="sm"
              onClick={() => handleBulkAction('disable')}
              className="text-zinc-300 hover:text-red-400 hover:bg-red-500/10"
            >
              <UserX className="h-4 w-4 mr-1.5" />
              Disable
            </Button>

            <Button
              variant="ghost"
              size="sm"
              onClick={openBulkDeleteDialog}
              className="text-zinc-300 hover:text-red-400 hover:bg-red-500/10"
            >
              <Trash2 className="h-4 w-4 mr-1.5" />
              Delete
            </Button>

            <div className="w-px h-6 bg-zinc-700" />

            <Button
              variant="ghost"
              size="sm"
              onClick={selectNone}
              className="text-zinc-400 hover:text-zinc-100"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      {/* Delete confirmation dialog */}
      <AlertDialog open={!!deleteUserId} onOpenChange={(open) => !open && setDeleteUserId(null)}>
        <AlertDialogContent className="bg-zinc-900 border-zinc-800">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-zinc-100">Delete User Permanently?</AlertDialogTitle>
            <AlertDialogDescription className="text-zinc-400">
              Are you sure you want to permanently delete{' '}
              <strong className="text-zinc-200">{userToDelete?.name}</strong> ({userToDelete?.email}
              )? This action cannot be undone and will remove all their data.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="border-zinc-700 text-zinc-300 hover:bg-zinc-800">
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() =>
                deleteUserId && deleteUser.mutate({ userId: deleteUserId, permanent: true })
              }
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              Delete Permanently
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Bulk action confirmation dialog */}
      <AlertDialog open={!!bulkAction} onOpenChange={(open) => !open && setBulkAction(null)}>
        <AlertDialogContent className="bg-zinc-900 border-zinc-800">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-zinc-100">
              {bulkAction === 'disable' && 'Disable Users'}
              {bulkAction === 'enable' && 'Enable Users'}
              {bulkAction === 'makeAdmin' && 'Grant Admin Privileges'}
              {bulkAction === 'removeAdmin' && 'Remove Admin Privileges'}
            </AlertDialogTitle>
            <AlertDialogDescription className="text-zinc-400">
              {getBulkActionDescription()}
            </AlertDialogDescription>
            {selectedUsers.length <= 8 && (
              <div className="mt-3 flex flex-wrap gap-2">
                {selectedUsers.map((user) => (
                  <Badge key={user.id} variant="outline" className="border-zinc-700 text-zinc-300">
                    {user.name}
                  </Badge>
                ))}
              </div>
            )}
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="border-zinc-700 text-zinc-300 hover:bg-zinc-800">
              Cancel
            </AlertDialogCancel>
            <Button
              onClick={confirmBulkAction}
              className={
                bulkAction === 'disable'
                  ? 'bg-red-600 hover:bg-red-700 text-white'
                  : bulkAction === 'makeAdmin'
                    ? 'bg-amber-600 hover:bg-amber-700 text-white'
                    : 'bg-zinc-600 hover:bg-zinc-700 text-white'
              }
            >
              Confirm
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Bulk delete confirmation dialog with credential verification */}
      <Dialog open={bulkDeleteOpen} onOpenChange={(open) => !open && closeBulkDeleteDialog()}>
        <DialogContent className="bg-zinc-900 border-zinc-800 sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-zinc-100 flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-red-500" />
              Permanently Delete {selectedIds.size} User{selectedIds.size !== 1 ? 's' : ''}
            </DialogTitle>
            <DialogDescription className="text-zinc-400">
              This action <strong className="text-red-400">cannot be undone</strong>. All user data
              will be permanently removed from the system.
            </DialogDescription>
          </DialogHeader>

          {selectedUsers.length <= 6 && (
            <div className="flex flex-wrap gap-2 py-2">
              {selectedUsers.map((user) => (
                <Badge
                  key={user.id}
                  variant="outline"
                  className="border-red-500/30 text-red-300 bg-red-500/10"
                >
                  {user.name}
                </Badge>
              ))}
            </div>
          )}

          <div className="space-y-4 py-2">
            <p className="text-sm text-zinc-400">
              To confirm deletion, enter your admin credentials:
            </p>

            <div className="space-y-2">
              <Label htmlFor="delete-email" className="text-zinc-300">
                Your Email
              </Label>
              <Input
                id="delete-email"
                type="email"
                value={deleteEmail}
                onChange={(e) => {
                  setDeleteEmail(e.target.value)
                  setDeleteError('')
                }}
                placeholder={currentUser?.email || 'admin@example.com'}
                autoComplete="off"
                className="border-zinc-700 bg-zinc-800 text-zinc-100"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="delete-password" className="text-zinc-300">
                Your Password
              </Label>
              <div className="relative">
                <Input
                  id="delete-password"
                  type={showDeletePassword ? 'text' : 'password'}
                  value={deletePassword}
                  onChange={(e) => {
                    setDeletePassword(e.target.value)
                    setDeleteError('')
                  }}
                  placeholder="Enter your password"
                  autoComplete="off"
                  className="border-zinc-700 bg-zinc-800 text-zinc-100 pr-10"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="absolute right-0 top-0 h-full px-3 text-zinc-500 hover:text-zinc-300"
                  onClick={() => setShowDeletePassword(!showDeletePassword)}
                >
                  {showDeletePassword ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </Button>
              </div>
            </div>

            {deleteError && (
              <p className="text-sm text-red-400 flex items-center gap-2">
                <AlertTriangle className="h-4 w-4" />
                {deleteError}
              </p>
            )}
          </div>

          <DialogFooter>
            <Button
              variant="ghost"
              onClick={closeBulkDeleteDialog}
              className="text-zinc-300 hover:bg-zinc-800"
            >
              Cancel
            </Button>
            <Button
              onClick={handleBulkDelete}
              disabled={bulkPermanentDeleteUsers.isPending || !deleteEmail || !deletePassword}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              {bulkPermanentDeleteUsers.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Deleting...
                </>
              ) : (
                'Delete Permanently'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

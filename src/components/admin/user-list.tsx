'use client'

import { useState, useEffect, useCallback } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  MoreHorizontal,
  Shield,
  ShieldOff,
  UserX,
  UserCheck,
  Trash2,
  Search,
  ArrowUpDown,
  Filter,
  X,
  CheckSquare,
  Square,
  Minus,
  Undo2,
  Redo2,
} from 'lucide-react'
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
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Checkbox } from '@/components/ui/checkbox'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuLabel,
} from '@/components/ui/dropdown-menu'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useAdminUndoStore } from '@/stores/admin-undo-store'

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
type BulkAction = 'delete' | 'disable' | 'enable' | 'makeAdmin' | 'removeAdmin' | null

const sortLabels: Record<SortField, string> = {
  name: 'Name',
  lastLoginAt: 'Last Login',
  createdAt: 'Date Created',
}

export function UserList() {
  const queryClient = useQueryClient()
  const [deleteUserId, setDeleteUserId] = useState<string | null>(null)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [bulkAction, setBulkAction] = useState<BulkAction>(null)

  // Undo store
  const { pushUserDelete, undo, redo, canUndo, canRedo } = useAdminUndoStore()

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

  const { data: users, isLoading, error } = useQuery<User[]>({
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
      const validIds = new Set(users.map(u => u.id))
      setSelectedIds(prev => {
        const newSelection = new Set([...prev].filter(id => validIds.has(id)))
        return newSelection.size !== prev.size ? newSelection : prev
      })
    }
  }, [users])

  const updateUser = useMutation({
    mutationFn: async ({
      userId,
      updates,
    }: {
      userId: string
      updates: Partial<User>
    }) => {
      const res = await fetch(`/api/admin/users/${userId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      })
      if (!res.ok) {
        const error = await res.json()
        throw new Error(error.error || 'Failed to update user')
      }
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'users'] })
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
    mutationFn: async ({
      userIds,
      updates,
    }: {
      userIds: string[]
      updates: Partial<User>
    }) => {
      const results = await Promise.allSettled(
        userIds.map(userId =>
          fetch(`/api/admin/users/${userId}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(updates),
          }).then(res => {
            if (!res.ok) throw new Error('Failed')
            return res.json()
          })
        )
      )
      const succeeded = results.filter(r => r.status === 'fulfilled').length
      const failed = results.filter(r => r.status === 'rejected').length
      return { succeeded, failed }
    },
    onSuccess: ({ succeeded, failed }) => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'users'] })
      if (failed === 0) {
        toast.success(`Updated ${succeeded} user${succeeded !== 1 ? 's' : ''}`)
      } else {
        toast.warning(`Updated ${succeeded}, failed ${failed}`)
      }
      setSelectedIds(new Set())
      setBulkAction(null)
    },
    onError: () => {
      toast.error('Bulk update failed')
      setBulkAction(null)
    },
  })

  // Bulk disable (soft delete) - undoable
  const bulkDisableUsers = useMutation({
    mutationFn: async (userIds: string[]) => {
      const results = await Promise.allSettled(
        userIds.map(userId =>
          fetch(`/api/admin/users/${userId}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ isActive: false }),
          }).then(res => {
            if (!res.ok) throw new Error('Failed')
            return res.json()
          })
        )
      )
      const succeeded = results.filter(r => r.status === 'fulfilled').length
      const failed = results.filter(r => r.status === 'rejected').length
      return { succeeded, failed, userIds }
    },
    onSuccess: ({ succeeded, failed, userIds }) => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'users'] })

      // Store for undo
      const disabledUsers = users?.filter(u => userIds.includes(u.id)) || []
      if (disabledUsers.length > 0) {
        pushUserDelete(disabledUsers.map(u => ({
          id: u.id,
          name: u.name,
          email: u.email,
          isSystemAdmin: u.isSystemAdmin,
          isActive: true, // They were active before
        })))
      }

      if (failed === 0) {
        toast.success(`Disabled ${succeeded} user${succeeded !== 1 ? 's' : ''} (Ctrl+Z to undo)`)
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

  // Bulk delete (soft delete) - undoable
  const bulkSoftDeleteUsers = useMutation({
    mutationFn: async (userIds: string[]) => {
      const results = await Promise.allSettled(
        userIds.map(userId =>
          fetch(`/api/admin/users/${userId}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ isActive: false }),
          }).then(res => {
            if (!res.ok) throw new Error('Failed')
            return res.json()
          })
        )
      )
      const succeeded = results.filter(r => r.status === 'fulfilled').length
      const failed = results.filter(r => r.status === 'rejected').length
      return { succeeded, failed, userIds }
    },
    onSuccess: ({ succeeded, failed, userIds }) => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'users'] })

      // Store for undo
      const deletedUsers = users?.filter(u => userIds.includes(u.id)) || []
      if (deletedUsers.length > 0) {
        pushUserDelete(deletedUsers.map(u => ({
          id: u.id,
          name: u.name,
          email: u.email,
          isSystemAdmin: u.isSystemAdmin,
          isActive: true,
        })))
      }

      if (failed === 0) {
        toast.success(`Deleted ${succeeded} user${succeeded !== 1 ? 's' : ''} (Ctrl+Z to undo)`)
      } else {
        toast.warning(`Deleted ${succeeded}, failed ${failed}`)
      }
      setSelectedIds(new Set())
      setBulkAction(null)
    },
    onError: () => {
      toast.error('Bulk delete failed')
      setBulkAction(null)
    },
  })

  // Handle undo - re-enable disabled users
  const handleUndo = useCallback(async () => {
    const action = undo()
    if (!action || action.type !== 'userDelete') return

    try {
      await Promise.all(
        action.users.map(user =>
          fetch(`/api/admin/users/${user.id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ isActive: true }),
          })
        )
      )
      queryClient.invalidateQueries({ queryKey: ['admin', 'users'] })
      toast.success(`Restored ${action.users.length} user${action.users.length !== 1 ? 's' : ''} (Ctrl+Y to redo)`)
    } catch {
      toast.error('Failed to undo')
    }
  }, [undo, queryClient])

  // Handle redo - disable users again
  const handleRedo = useCallback(async () => {
    const action = redo()
    if (!action || action.type !== 'userDelete') return

    try {
      await Promise.all(
        action.users.map(user =>
          fetch(`/api/admin/users/${user.id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ isActive: false }),
          })
        )
      )
      queryClient.invalidateQueries({ queryKey: ['admin', 'users'] })
      toast.success(`Re-disabled ${action.users.length} user${action.users.length !== 1 ? 's' : ''} (Ctrl+Z to undo)`)
    } catch {
      toast.error('Failed to redo')
    }
  }, [redo, queryClient])

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

  const userToDelete = deleteUserId ? users?.find(u => u.id === deleteUserId) : null
  const selectedUsers = users?.filter(u => selectedIds.has(u.id)) || []

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
  const toggleSelect = (userId: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev)
      if (next.has(userId)) {
        next.delete(userId)
      } else {
        next.add(userId)
      }
      return next
    })
  }

  const selectAll = () => {
    if (users) {
      setSelectedIds(new Set(users.map(u => u.id)))
    }
  }

  const selectNone = () => {
    setSelectedIds(new Set())
  }

  const allSelected = users && users.length > 0 && selectedIds.size === users.length
  const someSelected = selectedIds.size > 0 && !allSelected

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
        bulkUpdateUsers.mutate({ userIds: ids, updates: { isActive: true } })
        break
      case 'makeAdmin':
        bulkUpdateUsers.mutate({ userIds: ids, updates: { isSystemAdmin: true } })
        break
      case 'removeAdmin':
        bulkUpdateUsers.mutate({ userIds: ids, updates: { isSystemAdmin: false } })
        break
      case 'delete':
        bulkSoftDeleteUsers.mutate(ids)
        break
    }
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
      case 'delete':
        return `Delete ${count} user${count !== 1 ? 's' : ''}? They will be disabled and won't be able to log in. This action can be undone with Ctrl+Z.`
      default:
        return ''
    }
  }

  return (
    <div className="flex-1 flex flex-col overflow-hidden min-h-0">
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
              <Button variant="outline" className="border-zinc-800 bg-zinc-900 text-zinc-300 hover:bg-zinc-800 hover:text-zinc-100">
                <ArrowUpDown className="h-4 w-4 mr-2" />
                {sortLabels[sort]}
                <span className="ml-1 text-zinc-500">({sortDir === 'asc' ? 'A-Z' : 'Z-A'})</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="bg-zinc-900 border-zinc-800">
              <DropdownMenuLabel className="text-zinc-400">Sort by</DropdownMenuLabel>
              <DropdownMenuRadioGroup value={sort} onValueChange={(v) => setSort(v as SortField)}>
                <DropdownMenuRadioItem value="name" className="text-zinc-300 focus:text-zinc-100 focus:bg-zinc-800">
                  Name
                </DropdownMenuRadioItem>
                <DropdownMenuRadioItem value="lastLoginAt" className="text-zinc-300 focus:text-zinc-100 focus:bg-zinc-800">
                  Last Login
                </DropdownMenuRadioItem>
                <DropdownMenuRadioItem value="createdAt" className="text-zinc-300 focus:text-zinc-100 focus:bg-zinc-800">
                  Date Created
                </DropdownMenuRadioItem>
              </DropdownMenuRadioGroup>
              <DropdownMenuSeparator className="bg-zinc-800" />
              <DropdownMenuItem onClick={toggleSortDirection} className="text-zinc-300 focus:text-zinc-100 focus:bg-zinc-800">
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
              <SelectItem value="all" className="text-zinc-300 focus:text-zinc-100 focus:bg-zinc-800">
                All Users
              </SelectItem>
              <SelectItem value="admin" className="text-zinc-300 focus:text-zinc-100 focus:bg-zinc-800">
                Admins
              </SelectItem>
              <SelectItem value="standard" className="text-zinc-300 focus:text-zinc-100 focus:bg-zinc-800">
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
                  <label className="text-xs text-zinc-500 mb-1 block">Min Projects</label>
                  <Input
                    type="number"
                    min="0"
                    value={minProjects}
                    onChange={(e) => setMinProjects(e.target.value)}
                    placeholder="0"
                    className="bg-zinc-800 border-zinc-700 text-zinc-100"
                  />
                </div>
                <div>
                  <label className="text-xs text-zinc-500 mb-1 block">Max Projects</label>
                  <Input
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

          {/* Undo/Redo buttons */}
          <div className="flex gap-1">
            <Button
              variant="ghost"
              size="icon"
              onClick={handleUndo}
              disabled={!canUndo()}
              className="text-zinc-400 hover:text-zinc-100 disabled:opacity-30"
              title="Undo (Ctrl+Z)"
            >
              <Undo2 className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={handleRedo}
              disabled={!canRedo()}
              className="text-zinc-400 hover:text-zinc-100 disabled:opacity-30"
              title="Redo (Ctrl+Y)"
            >
              <Redo2 className="h-4 w-4" />
            </Button>
          </div>

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
            {search && <Badge variant="outline" className="border-zinc-700 text-zinc-400">Search: {search}</Badge>}
            {roleFilter !== 'all' && <Badge variant="outline" className="border-zinc-700 text-zinc-400">{roleFilter === 'admin' ? 'Admins only' : 'Standard only'}</Badge>}
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
              {selectedIds.size > 0
                ? `${selectedIds.size} selected`
                : 'Select all'}
            </span>
          </button>
          {selectedIds.size > 0 && (
            <button
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
              <div key={i} className="h-20 bg-zinc-800/50 rounded-lg animate-pulse" />
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
            {users.map((user) => {
              const isSelected = selectedIds.has(user.id)
              return (
                <Card
                  key={user.id}
                  className={`border-zinc-800 bg-zinc-900/50 transition-all duration-150 ${
                    isSelected
                      ? 'ring-1 ring-amber-500/50 bg-amber-500/5 border-amber-500/30'
                      : 'hover:bg-zinc-900/80'
                  }`}
                >
                  <CardContent className="flex items-center justify-between p-4">
                    <div className="flex items-center gap-3">
                      {/* Checkbox */}
                      <Checkbox
                        checked={isSelected}
                        onCheckedChange={() => toggleSelect(user.id)}
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
                          <Button variant="ghost" size="icon" className="text-zinc-400 hover:text-zinc-100">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="bg-zinc-900 border-zinc-800">
                          <DropdownMenuItem
                            onClick={() =>
                              updateUser.mutate({
                                userId: user.id,
                                updates: { isSystemAdmin: !user.isSystemAdmin },
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
            })}
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
              onClick={() => handleBulkAction('delete')}
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
              Are you sure you want to permanently delete <strong className="text-zinc-200">{userToDelete?.name}</strong> ({userToDelete?.email})?
              This action cannot be undone and will remove all their data.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="border-zinc-700 text-zinc-300 hover:bg-zinc-800">
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteUserId && deleteUser.mutate({ userId: deleteUserId, permanent: true })}
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
              {bulkAction === 'delete' && 'Delete Users'}
            </AlertDialogTitle>
            <AlertDialogDescription className="text-zinc-400">
              {getBulkActionDescription()}
            </AlertDialogDescription>
            {selectedUsers.length <= 8 && (
              <div className="mt-3 flex flex-wrap gap-2">
                {selectedUsers.map(user => (
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
            <AlertDialogAction
              onClick={confirmBulkAction}
              className={
                bulkAction === 'delete' || bulkAction === 'disable'
                  ? 'bg-red-600 hover:bg-red-700 text-white'
                  : bulkAction === 'makeAdmin'
                  ? 'bg-amber-600 hover:bg-amber-700 text-white'
                  : 'bg-zinc-600 hover:bg-zinc-700 text-white'
              }
            >
              {bulkAction === 'delete' ? 'Delete' : 'Confirm'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
